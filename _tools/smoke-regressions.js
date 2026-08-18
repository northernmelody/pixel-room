/* 针对 2026-08-18 审查修复的确定性回归测试：
 * 1) 快递按离线天数推进并迁移旧 opened 存档；
 * 2) 自动灯光 23:00 后关闭、手动覆盖跨日失效；
 * 3) 高处猫使用当前 y 命中。 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const failed = [];
function assert(cond, msg) { if (!cond) failed.push(msg); }

function load(ctx, file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
}

function baseContext(randomValue) {
  const testMath = Object.create(Math);
  testMath.random = () => randomValue;
  const ctx = {
    window: { PixelRoom: {}, addEventListener() {} },
    document: { getElementById: () => null, createElement: () => ({}), addEventListener() {}, readyState: 'loading' },
    location: { search: '' }, localStorage: null,
    performance: { now: () => 0 }, console, Date, Math: testMath, JSON,
    setTimeout: (fn) => { fn(); return 1; }, clearTimeout() {}, requestAnimationFrame() {}, confirm: () => false
  };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  load(ctx, 'js/config.js');
  return ctx;
}

function storageState(overrides) {
  return Object.assign({
    v: 1,
    lamps: { ceiling: [false, false, false, false], deskLamp: false, nightLamp: false, touched: false },
    sound: false, volume: 60, petTotal: 0, petDay: '', petToday: 0,
    settings: { particles: true, stars: true, anim: true },
    items: { date: '2026-8-10', cup: 0, blanket: 'messy', bowl: 0, dogBowl: 0, dishes: 0,
      collectibles: [], pkg: { state: 'arrived', date: '2026-8-10', openIn: 2, item: null, cooldown: 0 } }
  }, overrides || {});
}

// 离线 8 天：openIn=2 应完成拆箱，而不是只减到 1。
{
  const ctx = baseContext(0.99);
  let persisted = storageState();
  ctx.localStorage = { getItem: () => JSON.stringify(persisted), setItem: (k, v) => { persisted = JSON.parse(v); }, removeItem() {} };
  const P = ctx.window.PixelRoom;
  P.Time = { now: () => ({ year: 2026, month: 8, day: 18, hour: 12 }) };
  load(ctx, 'js/storage.js');
  P.Storage.load();
  P.Storage.ensureDaily();
  const it = P.Storage.state.items;
  assert(it.pkg.state === 'none', 'offline package should be opened after elapsed days');
  assert(it.collectibles.length === 1, 'opened package should create one collectible');
  assert(it.bowl === 3 && it.dogBowl === 3, 'pet bowls should refill after a day change');
}

// 旧 opened 存档应迁移到收藏列表。
{
  const ctx = baseContext(0.99);
  const old = storageState();
  old.items.date = '2026-8-17';
  old.items.pkg = { state: 'opened', date: '2026-8-16', openIn: 0, item: 'plant' };
  ctx.localStorage = { getItem: () => JSON.stringify(old), setItem() {}, removeItem() {} };
  const P = ctx.window.PixelRoom;
  P.Time = { now: () => ({ year: 2026, month: 8, day: 18, hour: 12 }) };
  load(ctx, 'js/storage.js');
  P.Storage.load();
  P.Storage.ensureDaily();
  assert(P.Storage.state.items.collectibles.indexOf('plant') >= 0, 'legacy opened item should migrate');
  assert(P.Storage.state.items.pkg.state === 'none', 'legacy package should return to reusable state');
}

// 灯光：22:00 自动亮、23:00 后自动灭；昨日手动覆盖在次日清除。
{
  const ctx = baseContext(0);
  const P = ctx.window.PixelRoom;
  let tp = { year: 2026, month: 8, day: 18, hour: 22, hourInt: 22, min: 0 };
  P.Time = {
    now: () => tp,
    getSchedule: () => ({ id: 'leisure' }),
    season: () => ({ id: 'summer' }),
    astro: (value) => ({ sunElev: value.hour >= 7.5 && value.hour < 19 ? 1 : -1, night: !(value.hour >= 7.5 && value.hour < 19) })
  };
  P.Storage = { state: {
    lamps: { ceiling: [false, false, false, false], deskLamp: false, nightLamp: false, touched: false, touchedDate: '' },
    settings: { anim: true }, items: {}
  }, save() {} };
  P.Character = { sleepInfo: () => null, mealFood: () => null, guitarTaken: () => false };
  load(ctx, 'js/lighting.js');
  load(ctx, 'js/roomLayout.js');
  P.Lighting.initDailyRandom();
  assert(P.RoomLayout.lights()[1].on === true, 'workspace ceiling should auto-light at 22:00');
  tp = { year: 2026, month: 8, day: 18, hour: 23.1, hourInt: 23, min: 6 };
  P.Lighting.checkAutoLights();
  assert(P.RoomLayout.lights().every(l => !l.on), 'all effective lights should be off after cutoff');
  P.Storage.state.lamps = { ceiling: [true, true, true, true], deskLamp: true, nightLamp: true, touched: true, touchedDate: '2026-8-18' };
  tp = { year: 2026, month: 8, day: 19, hour: 20, hourInt: 20, min: 0 };
  P.Lighting.checkAutoLights();
  assert(P.Storage.state.lamps.touched === false, 'manual lamp override should expire across days');
  assert(P.RoomLayout.lights()[1].on === true, 'automatic evening lighting should resume next day');
}

// 高处猫：点击当前支撑面附近应命中；旧的地面坐标不应命中。
{
  const ctx = baseContext(0.5);
  const P = ctx.window.PixelRoom;
  let clickHandler = null, pets = 0;
  const canvas = {
    addEventListener: (type, fn) => { if (type === 'click') clickHandler = fn; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 })
  };
  P.Time = { now: () => ({ year: 2026, month: 8, day: 18 }) };
  P.RoomLayout = { hits: () => [] };
  P.Cat = { pos: () => ({ x: 100, y: 56, dir: 1 }), pet: () => { pets++; } };
  P.Dog = { pos: () => ({ x: 250 }), interact: () => 'bark' };
  P.Character = { pos: () => ({ x: 250 }), reactRandom() {} };
  P.Audio = { ui() {} }; P.UI = { toast() {} };
  load(ctx, 'js/interaction.js');
  P.Interaction.init(canvas);
  clickHandler({ clientX: 100 * 4, clientY: 50 * 4 });
  assert(pets === 1, 'cat should be clickable at its elevated support surface');
  clickHandler({ clientX: 100 * 4, clientY: 124 * 4 });
  assert(pets === 1, 'empty floor below an elevated cat should not trigger pet');
}

if (failed.length) {
  console.error('SMOKE FAILED:\n - ' + failed.join('\n - '));
  process.exit(1);
}
console.log('SMOKE OK: offline package progression/migration, daily lamp policy, elevated cat hit test');
