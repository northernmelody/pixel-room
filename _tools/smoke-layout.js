/* 阶段一布局/加载回归：验证不等宽房间连续覆盖画布、交互区域随新地板移动，
 * 且聊天背景不会在首屏或其他电脑画面中提前请求。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const failed = [];
function assert(cond, message) { if (!cond) failed.push(message); }

let imageCount = 0;
let requestedSrc = '';
function FakeImage() {
  imageCount++;
  this.complete = false;
  this.naturalWidth = 0;
  this.naturalHeight = 0;
}
Object.defineProperty(FakeImage.prototype, 'src', {
  set(value) { requestedSrc = value; },
  get() { return requestedSrc; }
});

const sandbox = {
  window: { PixelRoom: {} },
  document: { addEventListener() {}, readyState: 'loading' },
  location: { search: '' },
  console, Date, Math, JSON, Image: FakeImage,
  performance: { now: () => 0 },
  requestAnimationFrame() {}, setTimeout, clearTimeout
};
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
}

load('js/config.js');
const P = sandbox.window.PixelRoom;
P.Storage = {
  state: {
    items: {}, settings: { anim: true },
    lamps: { ceiling: [false, false, false, false], deskLamp: false, nightLamp: false, touched: false }
  },
  save() {}
};
P.Time = {
  now: () => ({ year: 2026, month: 9, day: 10, hour: 12, hourInt: 12, min: 0 }),
  season: () => ({ id: 'autumn' }),
  astro: () => ({ night: false })
};
P.Lighting = { drawWindowBackdrop() {} };
P.Character = {
  screenMode: () => 'coding', guitarTaken: () => false,
  fridgeOpen: () => null, mealFood: () => null, leisureAct: () => null
};
P.Cat = { perchId: () => null };

load('js/roomLayout.js');

const C = P.Config;
const rooms = C.ROOM_BOUNDS;
assert(rooms.length === 4, 'expected four room bounds');
assert(rooms[0].x === 0, 'first room should start at x=0');
for (let i = 1; i < rooms.length; i++) {
  assert(rooms[i].x === rooms[i - 1].x + rooms[i - 1].w, 'room bounds should be contiguous at index ' + i);
}
assert(rooms[rooms.length - 1].x + rooms[rooms.length - 1].w === C.LOGICAL_W, 'room bounds should cover the full canvas');
assert(rooms[1].w > rooms[0].w && rooms[2].w < rooms[3].w, 'workspace should be emphasized and bathroom compact');

const hits = P.RoomLayout.hits();
const monitor = P.RoomLayout.monitorRect();
const computerHit = hits.find(hit => hit.type === 'computer');
assert(computerHit && computerHit.y < monitor.y && computerHit.y + computerHit.h > monitor.y + monitor.h, 'computer hit box should wrap the shifted monitor');
assert(monitor.y === 102, 'monitor should follow the new floor baseline (y=' + monitor.y + ')');

const ctx = {
  fillStyle: '#000', font: '', textBaseline: 'top', globalAlpha: 1,
  fillRect() {}, drawImage() {}, fillText() {}, save() {}, restore() {}, translate() {},
  measureText: () => ({ width: 0 }),
  createLinearGradient: () => ({ addColorStop() {} }),
  createRadialGradient: () => ({ addColorStop() {} })
};

P.RoomLayout.drawMonitorContent(ctx, 'coding', 0, 0, 0, 200, 100);
assert(imageCount === 0, 'chat background should not load for the initial/coding screen');
P.RoomLayout.drawMonitorContent(ctx, 'chat', 0, 0, 0, 200, 100);
assert(imageCount === 1, 'chat background should load once when chat is first shown');
assert(requestedSrc === 'assets/chat-bg.jpg', 'chat should request the optimized JPG asset');
P.RoomLayout.drawMonitorContent(ctx, 'chat', 1, 0, 0, 200, 100);
assert(imageCount === 1, 'chat background should be reused after the first request');

if (failed.length) {
  console.error('SMOKE FAILED:\n - ' + failed.join('\n - '));
  process.exit(1);
}
console.log('SMOKE OK: unequal room bounds, shifted hit boxes, and lazy chat background loading');
