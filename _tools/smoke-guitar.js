/* 冒烟测试：在 Node VM 中加载 songs.js + character.js（及 config.js），
 * 验证吉他弹唱状态机（v2：吉他由小人放回原处）：
 *   1. 工作时段点击吉他 → startGuitar()='ok'
 *   2. go（走到吉他旁 x=64）→ pick（0.8s 后 taken=true，墙上吉他隐藏）
 *   3. carry（抱着吉他走到床边 x=27）→ sit → sing
 *   4. sing：逐句歌词按 tempo 推进（g.line 0→6），每句弹像素音符（notes>0）
 *   5. 唱完总时长（tempo×行数+endHold）→ put（床边放下）→ back（抱回吉他位）→
 *      place（靠墙放回，place 开始时 taken=false 墙上吉他恢复）→ 结束
 *   6. 结束后 activity='__guitar_done' → 下一次 update 重新同步回工作（work → x=147）
 *   7. 睡觉（睡在床上 02:00）→ startGuitar()='sleep'
 *   8. 淋浴时段（22:10）→ 可触发（洗漱可弹）
 *   9. 弹唱进行中再点 → startGuitar()='busy'
 *   10. 休闲时段（19:30）→ 可弹，且结束后恢复触发前的休闲活动（不换项）
 *   11. 连唱两首 → 不连续重复（chooseSong 过滤 lastSongId） */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const audioCalls = [];
const lyricCalls = [];
const sandbox = {
  window: { PixelRoom: {} },
  document: { getElementById: () => null, createElement: () => null, addEventListener() {}, readyState: 'complete' },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  performance: { now: () => Date.now() },
  console, Date, Math, JSON, setTimeout, clearTimeout,
  requestAnimationFrame() {}
};
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);

function load(file) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  vm.runInContext(code, sandbox, { filename: file });
}

load('js/config.js');
const P = sandbox.window.PixelRoom;

// ---- 可控时间 stub ----
let curHour = 10.0; // 工作时段
P.Time = {
  now: () => ({ hour: curHour, hourInt: Math.floor(curHour), min: Math.floor((curHour % 1) * 60), sec: 0, weekday: 1, month: 6, day: 10, year: 2026 }),
  getSchedule: (tp) => {
    const h = tp ? tp.hour : curHour;
    if (h >= 0 && h < 7.5) return { id: 'sleep', name: '睡觉', from: 0, to: 7.5 };
    if (h >= 7.5 && h < 8) return { id: 'wash', name: '洗漱', from: 7.5, to: 8 };
    if (h >= 8 && h < 8.5) return { id: 'breakfast', name: '早餐', from: 8, to: 8.5 };
    if (h >= 8.5 && h < 12) return { id: 'work', name: '工作', from: 8.5, to: 12 };
    if (h >= 22 && h < 22.5) return { id: 'wash', name: '洗漱', from: 22, to: 22.5 };
    if (h >= 22.5 && h < 24) return { id: 'sleep', name: '睡觉', from: 22.5, to: 24 };
    return { id: 'leisure', name: '休闲', from: 19, to: 22 };
  },
  isFreelance: () => false,
  season: () => ({ id: 'summer', k: 0.5, name: '夏' })
};
P.Storage = { state: { items: {}, settings: { anim: true }, lamps: {} }, save() {} };
P.Audio = { flush() {}, keyboard() {}, eat() {}, bark() {}, ui() {}, guitar() { audioCalls.push('guitar'); }, pluck(f) { audioCalls.push('pluck:' + Math.round(f)); } };
P.Cat = { perchId: () => null, endPlay() {}, playWithHuman() {}, isSleeping: () => false };
P.UI = {
  toast() {},
  showLyric(title, line) { lyricCalls.push({ title: title, line: line }); },
  hideLyric() { lyricCalls.push({ hide: true }); }
};

load('js/songs.js');
load('js/character.js');
const Char = P.Character;

const failed = [];
function assert(cond, msg) { if (!cond) failed.push(msg); }

sandbox.Math.random = () => 0.42;   // 选中 SONGS[1] = river_dream（7 行，tempo 2.2，endHold 3.0）
Char.init();
let dbg = Char._debug();
assert(dbg.activity === 'work', 'init at 10:00 -> work, got ' + dbg.activity);
assert(P.Songs.length === 3, 'SONGS should have 3 songs, got ' + P.Songs.length);

// ---- 1. 工作时段点击吉他 ----
const ret = Char.startGuitar();
assert(ret === 'ok', 'startGuitar during work -> ok, got ' + ret);
dbg = Char._debug();
assert(dbg.guitar && dbg.guitar.phase === 'go', 'phase should be go after start');
assert(Char.guitarActive(), 'guitarActive() true');
assert(dbg.guitar && dbg.guitar.song === 'river_dream', 'random song = river_dream, got ' + (dbg.guitar || {}).song);
assert(dbg.guitar && dbg.guitar.restore === 'work', 'restore snapshot = work');

// ---- 2-5. 推进到会话结束（分阶段验证，含放回流程） ----
const phasesSeen = {};
let takenSeenDuring = false;
let maxLineSeen = -1;
let maxNotesSeen = 0;
let singStartedAt = -1, singDuration = 0;
let placeTakenFalseSeen = false;
let t = 0;

const step = function () {
  Char.update(0.05);
  t += 0.05;
  const g = Char._debug().guitar;
  if (g) {
    phasesSeen[g.phase] = true;
    if (g.taken) takenSeenDuring = true;
    if (g.line > maxLineSeen) maxLineSeen = g.line;
    if (g.notes > maxNotesSeen) maxNotesSeen = g.notes;
    if (g.phase === 'sing' && singStartedAt < 0) singStartedAt = t;
    if (g.phase === 'sing') singDuration = t - singStartedAt;
    if (g.phase === 'place' && !g.taken) placeTakenFalseSeen = true;  // 放回时墙上吉他恢复
  }
};

for (let i = 0; i < 1600 && Char.guitarActive(); i++) { step(); }
const firstSongDur = singDuration;   // 记录第一首歌的弹唱时长（后续测试会覆盖变量）

dbg = Char._debug();
['go','pick','carry','sit','sing','put','back','place'].forEach(function (p) {
  assert(!!phasesSeen[p], 'phase ' + p + ' seen');
});
assert(takenSeenDuring, 'guitar taken observed during song (wall guitar hidden)');
assert(placeTakenFalseSeen, 'taken=false during place (wall guitar restored by character)');
assert(!Char.guitarActive(), 'guitarActive() false after finish');
assert(!Char.guitarTaken(), 'guitarTaken() false after finish');
assert(maxLineSeen === 6, '7 lyric lines advanced (g.line 0..6), got max=' + maxLineSeen);
assert(maxNotesSeen > 0, 'pixel notes spawned during sing (max=' + maxNotesSeen + ')');
assert(singDuration > 18 && singDuration < 19.5, 'sing duration ≈ 7×2.2+3.0=18.4s, got ' + singDuration.toFixed(1));
assert(audioCalls.indexOf('guitar') >= 0, 'guitar strum played at sing start');
assert(audioCalls.filter(function (a) { return a.indexOf('pluck') === 0; }).length === 6, '6 plucks for 6 line changes, got ' + audioCalls.filter(function (a) { return a.indexOf('pluck') === 0; }).length);
assert(Math.abs(dbg.x - 64) < 1, 'character ended back at guitar spot x=64, got x=' + dbg.x);
// DOM 歌词面板：7 行按序显示 + 结束隐藏
const songLyrics = lyricCalls.filter(function (c) { return !c.hide; });
assert(songLyrics.length === 7, 'showLyric called 7 times, got ' + songLyrics.length);
assert(songLyrics[0] && songLyrics[0].title === '河岸', 'lyric title = 河岸, got ' + (songLyrics[0] || {}).title);
assert(songLyrics[0] && songLyrics[0].line === '过了很久终于我愿抬头看', 'first line correct, got ' + (songLyrics[0] || {}).line);
assert(songLyrics[6] && songLyrics[6].line === '你看', 'last line = 你看, got ' + (songLyrics[6] || {}).line);
assert(lyricCalls.length === 8 && lyricCalls[7].hide, 'hideLyric called at end');
// ---- 6. 结束后重新同步回工作（x=147） ----
dbg = Char._debug();
assert(dbg.activity === '__guitar_done', 'activity sentinel set after song, got ' + dbg.activity);
for (let i = 0; i < 2000 && Char._debug().activity !== 'work'; i++) { Char.update(0.05); }
dbg = Char._debug();
assert(dbg.activity === 'work', 're-synced back to work, got ' + dbg.activity);
for (let i = 0; i < 4000 && Math.abs(Char._debug().x - 147) > 1; i++) { Char.update(0.05); }
dbg = Char._debug();
assert(Math.abs(dbg.x - 147) < 1, 'character walked back to work x=147, got x=' + dbg.x);

// ---- 7. 睡在床上拒绝 ----
curHour = 2.0;
sandbox.Math.random = () => 0.9;
Char.init();
dbg = Char._debug();
assert(dbg.activity === 'sleep' && dbg.pose === 'sleep', 'init at 02:00 -> sleeping in bed');
assert(Char.startGuitar() === 'sleep', 'startGuitar while asleep -> sleep, got ' + Char.startGuitar());

// ---- 8. 淋浴时段可触发 ----
curHour = 22.1;
Char.init();
dbg = Char._debug();
assert(dbg.activity === 'wash' && dbg.pose === 'shower', 'init at 22:10 -> wash/shower, got ' + dbg.activity + '/' + dbg.pose);
assert(Char.startGuitar() === 'ok', 'startGuitar while showering -> ok (洗漱可弹), got ' + Char.startGuitar());

// ---- 9. 弹唱中再点 → busy ----
curHour = 10.0;
Char.init();
assert(Char.startGuitar() === 'ok', 'restart during work -> ok');
assert(Char.startGuitar() === 'busy', 'second startGuitar while singing -> busy, got ' + Char.startGuitar());

// ---- 10. 休闲时段可弹 + 结束后恢复原活动 ----
curHour = 19.5;
Char.init();
for (let i = 0; i < 3; i++) { Char.update(0.05); }   // 让 leisureUpdate 选定休闲活动
dbg = Char._debug();
assert(dbg.activity === 'leisure', 'init at 19:30 -> leisure');
const leisureBefore = dbg.leisureAct;
assert(leisureBefore !== null, 'leisure activity picked, got ' + leisureBefore);
assert(Char.startGuitar() === 'ok', 'startGuitar during leisure -> ok');
// 跑完一首歌
for (let i = 0; i < 1600 && Char.guitarActive(); i++) { step(); }
dbg = Char._debug();
assert(dbg.activity === 'leisure', 'after leisure song -> still leisure, got ' + dbg.activity);
assert(dbg.leisureAct === leisureBefore, 'leisure activity restored (' + leisureBefore + '), got ' + dbg.leisureAct);
// 走回休闲位
const spot = { game: 147, read: 27, exercise: 96, play_cat: 99, look_out: 63, phone: 27 }[leisureBefore];
for (let i = 0; i < 4000 && Math.abs(Char._debug().x - spot) > 0.5; i++) { Char.update(0.05); }
dbg = Char._debug();
assert(Math.abs(dbg.x - spot) < 1, 'character walked back to leisure spot x=' + spot + ', got x=' + dbg.x);

// ---- 11. 连唱两首不连续重复 ----
curHour = 10.0;
Char.init();
assert(Char.startGuitar() === 'ok', 'song A start ok');
const songA = Char._debug().guitar.song;
for (let i = 0; i < 1600 && Char.guitarActive(); i++) { step(); }
assert(Char.startGuitar() === 'ok', 'song B start ok');
const songB = Char._debug().guitar.song;
assert(songA !== songB, 'consecutive songs differ (A=' + songA + ' B=' + songB + ')');
assert(Char._debug().lastSongId === songB, 'lastSongId tracked = ' + songB);

if (failed.length) {
  console.error('SMOKE FAILED:\n - ' + failed.join('\n - '));
  process.exit(1);
}
console.log('SMOKE OK: go→pick→carry→sit→sing(7 lines,' + firstSongDur.toFixed(1) + 's,notes=' + maxNotesSeen + ')→put→back→place(taken=false)→done;');
console.log('  re-sync to work x=147; sleep refused; shower OK; busy refused; leisure restore=' + leisureBefore + '; no-repeat A=' + songA + ' B=' + songB);
console.log('final debug:', JSON.stringify(Char._debug()));
