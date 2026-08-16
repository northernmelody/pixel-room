/* 冒烟测试：在 Node VM 中加载 character.js（及 config.js），驱动小人状态机，
 * 验证：餐前必定先到冰箱取食材（fridgePhase go→open→done）、
 *      开门期间 fridgeOpen() 返回正确开度、随后走到餐桌吃饭。 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function makeCtx() {
  const ctx = {
    globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000',
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: () => ({ width: 0 })
  };
  ['fillRect','clearRect','save','restore','translate','scale','rotate',
   'beginPath','moveTo','lineTo','closePath','fill','stroke','drawImage',
   'setTransform','fillText','strokeText','arc','rect'].forEach(m => { ctx[m] = () => {}; });
  return ctx;
}

const storageState = {
  items: { dogBowl: 3, bowl: 3, cup: 4, blanket: 'messy', dishes: 0, pkg: { state: 'none' } },
  settings: { anim: true }, lamps: { ceiling: [false,false,false,false], touched: false },
  petToday: 0, petTotal: 0
};

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
let curHour = 7.6; // 洗漱中
P.Time = {
  now: () => ({ hour: curHour, hourInt: Math.floor(curHour), min: Math.floor((curHour % 1) * 60), sec: 0, weekday: 1, month: 6, day: 10, year: 2026 }),
  getSchedule: () => {
    if (curHour >= 8 && curHour < 8.5) return { id: 'breakfast', name: '早餐', from: 8, to: 8.5 };
    if (curHour >= 7.5 && curHour < 8) return { id: 'wash', name: '洗漱', from: 7.5, to: 8 };
    if (curHour >= 8.5 && curHour < 12) return { id: 'work', name: '工作', from: 8.5, to: 12 };
    return { id: 'sleep', name: '睡觉', from: 0, to: 7.5 };
  },
  isFreelance: () => false,
  season: () => ({ id: 'summer', k: 0.5, name: '夏' })
};
P.Storage = { state: storageState, save() {} };
P.Audio = { flush() {}, keyboard() {}, eat() {}, bark() {} };

load('js/character.js');
const Char = P.Character;

const failed = [];
function assert(cond, msg) { if (!cond) failed.push(msg); }

sandbox.Math.random = () => 0.42;
Char.init();
let dbg = Char._debug();
assert(dbg.activity === 'wash', 'init during wash -> activity wash, got ' + dbg.activity);

// ---- 模拟：洗漱 → 早餐（8:00） ----
// 先把洗漱流程跑完（washSeq 0→5）
let t = 0;
for (let i = 0; i < 30000 && Char._debug().washSeq !== null; i++) {
  Char.update(0.05);
  t += 0.05;
  if (t > 60) break;
}
dbg = Char._debug();
assert(dbg.washSeq === null || dbg.washSeq === 5, 'wash sequence should finish (washSeq=' + dbg.washSeq + ')');

// 进入早餐时段
curHour = 8.0;
let arrivedFridge = false, opened = false, doneFridge = false, atTable = false, mealFood = null;
let doorOpenP = null, doorOpenSeen = 0;
t = 0;
for (let i = 0; i < 120000 && !atTable; i++) {
  Char.update(0.05);
  t += 0.05;
  dbg = Char._debug();
  if (dbg.fridgePhase === 'go' && !dbg.moving) { /* 在冰箱前等待开门 */ }
  if (dbg.fridgePhase === 'open') {
    opened = true;
    const fo = Char.fridgeOpen();
    if (fo && fo.open) {
      doorOpenSeen++;
      if (doorOpenP === null && fo.p >= 0.9) doorOpenP = 'full';
      if (doorOpenP === null && fo.p > 0.01 && fo.p < 0.9) doorOpenP = 'partial';
    }
  }
  if (dbg.fridgePhase === 'done') doneFridge = true;
  if (dbg.pose === 'fridge' && Math.abs(dbg.x - 262) < 1) arrivedFridge = true;
  if (dbg.pose === 'eat' && Math.abs(dbg.x - 248) < 1) {
    atTable = true;
    mealFood = dbg.mealFood;
  }
  if (t > 90) break;
}
dbg = Char._debug();
assert(arrivedFridge, 'character should reach fridge x=262 (x=' + dbg.x + ' pose=' + dbg.pose + ' phase=' + dbg.fridgePhase + ')');
assert(opened, 'fridgePhase should enter open (phase=' + dbg.fridgePhase + ')');
assert(doorOpenSeen > 0, 'fridgeOpen() should report open during phase open');
assert(doorOpenP === 'full' || doorOpenP === 'partial', 'fridgeOpen().p should reach partial/full (last=' + doorOpenP + ')');
assert(doneFridge, 'fridgePhase should reach done');
assert(atTable, 'character should arrive at table x=248 to eat');
assert(!!mealFood, 'mealFood should be picked at table (mealFood=' + mealFood + ')');

// ---- 直接从餐时初始化（页面在早餐时段打开） ----
curHour = 8.2;
sandbox.Math.random = () => 0.9;
Char.init();
dbg = Char._debug();
assert(dbg.activity === 'breakfast', 'init at 8.2 -> breakfast');
assert(dbg.fridgePhase === 'go' && !dbg.moving, 'init at meal -> fridgePhase=go, not moving');
opened = false;
for (let i = 0; i < 1000; i++) {
  Char.update(0.05);
  if (Char._debug().fridgePhase === 'open') { opened = true; break; }
}
assert(opened, 'page load during meal -> fridge door opens immediately (phase=' + Char._debug().fridgePhase + ')');

if (failed.length) {
  console.error('SMOKE FAILED:\n - ' + failed.join('\n - '));
  process.exit(1);
}
console.log('SMOKE OK: wash->breakfast fridge flow go→open(openP ' + doorOpenP + ')→done→table, mealFood=' + mealFood);
console.log('final debug:', JSON.stringify(Char._debug()));
