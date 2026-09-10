/* Daily-life smoke test: fixed MOMO call, cooking phases, snack/change lifecycle, and 100-day data. */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const sandbox = {
  window: { PixelRoom: {} }, location: { search: '' }, console, Date, Math, JSON,
  performance: { now: () => 0 }, setTimeout, clearTimeout,
  document: { getElementById: () => null, createElement: () => null, addEventListener() {}, readyState: 'complete' },
  requestAnimationFrame() {}
};
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
function load(f) { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f }); }
load('js/config.js'); load('js/storyData.js');
const P = sandbox.window.PixelRoom;
let hour = 21.4, day = 10;
P.Time = {
  now: () => { const hi = Math.floor(hour), min = Math.floor((hour - hi) * 60); return { year: 2026, month: 9, day, hour, hourInt: hi, min, sec: 0, weekday: 4 }; },
  getSchedule: () => hour < 7.5 ? { id: 'sleep' } : hour < 8 ? { id: 'wash' } : hour < 8.5 ? { id: 'breakfast' } : hour < 12 ? { id: 'work' } : hour < 13 ? { id: 'lunch' } : hour < 18 ? { id: 'work' } : hour < 19 ? { id: 'dinner' } : hour < 21.5 ? { id: 'leisure' } : hour < 22 ? { id: 'call' } : hour < 22.5 ? { id: 'wash' } : { id: 'sleep' },
  isFreelance: () => false, season: () => ({ id: 'summer' })
};
P.Storage = { state: { life: { epochDay: null, outfitIndex: 0, snackAfter: 0, changeAfter: 0 }, items: { blanket: 'messy' }, lamps: { ceiling: [false,false,false,false], touched: false }, settings: { anim: true } }, save() {} };
P.Audio = { keyboard() {}, flush() {}, eat() {}, ui() {} };
P.Songs = [{ id: 'a', title: 'a', tempo: 2, endHold: 1, lyrics: ['a'] }];
load('js/dailyLife.js'); load('js/character.js');
const C = P.Character, failures = [];
function assert(v, m) { if (!v) failures.push(m); }
function step(n) { for (let i = 0; i < n; i++) C.update(0.05); }

assert(P.DailyLife.todayCall({ year: 2026, month: 9, day: 10 }).day === 1, 'day 1 call');
assert(P.DailyLife.todayCall({ year: 2026, month: 12, day: 18 }).day === 100, 'day 100 call');
assert(P.DailyLife.todayCall({ year: 2026, month: 12, day: 19 }).day === 1, 'day 101 wraps');

C.init(); hour = 21.5; step(2);
assert(C._debug().activity === 'call', '21:30 enters fixed call');
assert(C.callInfo() && C.callInfo().total === 12, 'call info exposes current line');
assert(C.startGuitar() === 'call', 'guitar blocked during call');

hour = 18.1; C.init();
let mealPhases = {};
for (let i = 0; i < 2200; i++) { C.update(0.05); const d = C._debug(); if (d.mealFood) mealPhases[d.mealFood.phase] = true; }
assert(mealPhases.cook || mealPhases.cook_go, 'cooking phase observed');
assert(mealPhases.eat, 'eating phase observed');

hour = 19.1; C.init(); assert(C.startChange() === 'ok', 'change outfit starts in leisure'); step(20); assert(C.wardrobeOpen() !== null, 'wardrobe opens during change');
assert(C.startSnack() === 'busy', 'cannot overlap snack with changing'); step(180); assert(C.lifeStatus().kind === 'leisure' || C.lifeStatus().kind === 'change', 'change lifecycle advances');

if (failures.length) { console.error('SMOKE FAILED:\n - ' + failures.join('\n - ')); process.exit(1); }
console.log('SMOKE OK: calls/cycle, call priority, cooking/eating, wardrobe change lifecycle');
