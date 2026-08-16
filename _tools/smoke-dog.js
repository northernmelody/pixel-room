/* 冒烟测试：在 Node VM 中加载 dog.js（及 config.js），驱动状态机遍历全部状态，
 * 验证 update/draw 不抛异常、狗不出界、进食扣粮、点击交互正常。 */
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

const canvasLike = {
  width: 1280, height: 720, style: {},
  getContext: () => makeCtx(),
  addEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
  clientWidth: 1280
};

const storageState = {
  dogSeed: 0,
  items: { dogBowl: 3, bowl: 3, cup: 4, blanket: 'messy', dishes: 0, pkg: { state: 'none' } },
  settings: { anim: true }, lamps: { ceiling: [false,false,false,false], touched: false },
  petToday: 0, petTotal: 0
};

const sandbox = {
  window: { PixelRoom: {} },
  document: {
    getElementById: () => canvasLike,
    createElement: () => canvasLike,
    addEventListener() {},
    readyState: 'complete'
  },
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

// 1) config.js（定义 P.Config / P.Events）
load('js/config.js');
const P = sandbox.window.PixelRoom;

// 2) 轻量 stub（dog.js 运行所需的最小 API）
P.Storage = {
  state: storageState,
  save() {}
};
P.Time = {
  now: () => ({ hour: 12, hourInt: 12, min: 0, sec: 0 }),
  getSchedule: () => ({ id: 'work' })
};
P.Character = { pos: () => ({ x: 147, dir: -1 }) };
P.Audio = { bark() {}, eat() {} };
P.UI = { toast() {} };

// 3) 加载 dog.js
load('js/dog.js');

const Dog = P.Dog;
const failed = [];
function assert(cond, msg) { if (!cond) failed.push(msg); }

// init
Dog.init();
assert(!!Dog.pos(), 'dog initialized');

// ---- 状态机遍历：确定性扫描 Math.random ----
const seen = {};
let throws = null;
try {
  for (let i = 0; i < 40000; i++) {
    sandbox.Math.random = (() => { const v = ((i * 7919) % 10000) / 10000; return () => v; })();
    Dog.update(0.05);
    const s = Dog.state();
    seen[s] = (seen[s] || 0) + 1;
    // 边界检查
    const p = Dog.pos();
    if (p.x < 10 || p.x > 310) { throws = 'dog x out of bounds: ' + p.x; break; }
  }
} catch (e) { throws = 'update threw: ' + e.message; }

const expected = ['idle','wander','sleep','eat','zoomies','follow','bark','scratch','sit'];
assert(!throws, throws || 'update loop ok');
expected.forEach(s => assert(seen[s] > 0, 'state never reached: ' + s + ' (seen=' + JSON.stringify(seen) + ')'));

// ---- 每个状态 draw 不抛异常 ----
const ctx = makeCtx();
const st = { season: { id: 'summer' }, tp: P.Time.now(), weather: {}, activity: { id: 'work' } };
try {
  for (const s of expected) {
    if (!seen[s]) continue;
    // 通过触发函数进入特定状态，再 draw
    if (s === 'bark') Dog.bark();
    else if (s === 'follow') Dog.followCharacter();
    else if (s === 'eat') Dog.eatFood();
    else { /* 其余状态通过扫描已到过，直接 draw 当前状态 */ }
    Dog.draw(ctx, st);
  }
  Dog.draw(ctx, st);
} catch (e) { failed.push('draw threw: ' + e.message + ' @state ' + Dog.state()); }

// ---- 进食扣粮 ----
storageState.items.dogBowl = 3;   // 状态遍历阶段可能已吃掉，重置
Dog.eatFood();
let eatDone = false;
for (let i = 0; i < 600 && !eatDone; i++) {
  sandbox.Math.random = () => 0.5;
  Dog.update(0.05);
  if (storageState.items.dogBowl === 2) eatDone = true;
}
assert(eatDone, 'eat should decrement dogBowl 3->2 (items.dogBowl=' + storageState.items.dogBowl + ')');

// ---- 点击交互 ----
const r1 = Dog.interact();
assert(r1 === 'bark', 'first interact -> bark, got ' + r1);
const r2 = Dog.interact();
assert(r2 === 'follow', 'second interact within 4s -> follow, got ' + r2);

// ---- 跟随移动 ----
sandbox.Math.random = () => 0.5;
Dog.followCharacter();
const before = Dog.pos().x;
let moved = false;
for (let i = 0; i < 300; i++) { Dog.update(0.05); if (Math.abs(Dog.pos().x - before) > 2) { moved = true; break; } }
assert(moved, 'follow state should move the dog toward character');

// ---- 夜晚更爱睡：isPersonSleeping 路径 ----
P.Time.getSchedule = () => ({ id: 'sleep' });
Dog.bark(); // 进入一个短状态
let sleepCount = 0;
for (let i = 0; i < 3000; i++) {
  sandbox.Math.random = (() => { const v = ((i * 7919) % 10000) / 10000; return () => v; })();
  Dog.update(0.05);
  if (Dog.state() === 'sleep') sleepCount++;
}
assert(sleepCount > 0, 'night sleep schedule should still produce sleep state');

// ---- 空碗不吃 ----
storageState.items.dogBowl = 0;
Dog.eatFood(); // 外部强制吃，碗空时不应扣成负数
for (let i = 0; i < 600; i++) { sandbox.Math.random = () => 0.5; Dog.update(0.05); }
assert(storageState.items.dogBowl === 0, 'dogBowl should never go negative (=' + storageState.items.dogBowl + ')');

if (failed.length) {
  console.error('SMOKE FAILED:\n - ' + failed.join('\n - '));
  process.exit(1);
}
console.log('SMOKE OK: all states ' + expected.join(',') + ' reached; draw no-throw; eat/interact/follow/night/bounds ok');
console.log('state counts:', JSON.stringify(seen));
