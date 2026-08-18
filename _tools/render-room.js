/* 临时：渲染整层（x0-320, y40-140）为 PNG，便于查看布局 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..');

function makeCtx(w, h) {
  const buf = Buffer.alloc(w * h * 4);
  const px = (x, y, r, g, b, a) => {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    if (a === undefined || a >= 1) { buf[i] = r; buf[i+1] = g; buf[i+2] = b; buf[i+3] = 255; }
    else {
      const na = a, oa = buf[i+3] / 255;
      const outA = na + oa * (1 - na);
      if (outA <= 0) return;
      buf[i] = Math.round((r * na + buf[i] * oa * (1 - na)) / outA);
      buf[i+1] = Math.round((g * na + buf[i+1] * oa * (1 - na)) / outA);
      buf[i+2] = Math.round((b * na + buf[i+2] * oa * (1 - na)) / outA);
      buf[i+3] = Math.round(outA * 255);
    }
  };
  const parseColor = (c) => {
    if (typeof c === 'string') {
      if (c[0] === '#') {
        const n = parseInt(c.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
      }
      const m = c.match(/rgba?\(\s*(\d+)[^\d]*(\d+)[^\d]*(\d+)(?:[^\d]*(\d+(?:\.\d+)?))?/);
      if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
    }
    return [255, 0, 255, 1];
  };
  const ctx = {
    w, h, buf, imageSmoothingEnabled: true,
    fillStyle: '#000', strokeStyle: '#000', globalAlpha: 1,
    fillRect(x, y, fw, fh) {
      const [r, g, b, a] = parseColor(this.fillStyle);
      const alpha = a * this.globalAlpha;
      x = Math.floor(x); y = Math.floor(y); fw = Math.floor(fw); fh = Math.floor(fh);
      for (let yy = y; yy < y + fh; yy++) for (let xx = x; xx < x + fw; xx++) px(xx, yy, r, g, b, alpha);
    },
    clearRect(x, y, fw, fh) {
      x = Math.floor(x); y = Math.floor(y); fw = Math.floor(fw); fh = Math.floor(fh);
      for (let yy = y; yy < y + fh; yy++) for (let xx = x; xx < x + fw; xx++) {
        const i = (yy * w + xx) * 4; buf[i] = buf[i+1] = buf[i+2] = 0; buf[i+3] = 0;
      }
    },
    setTransform() {}, save() {}, restore() {}, translate() {}, scale() {}, rotate() {},
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {},
    rect() {}, arc() {}, drawImage() {}, measureText: () => ({ width: 0 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    fillText() {}, strokeText() {}
  };
  return ctx;
}

const canvasLike = {
  width: 320, height: 180, style: {}, getContext: () => makeCtx(320, 180),
  addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 180 }),
  clientWidth: 320
};
const sandbox = {
  window: { PixelRoom: {} },
  document: { getElementById: () => canvasLike, createElement: () => canvasLike, addEventListener() {}, readyState: 'complete' },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  performance: { now: () => Date.now() },
  console, Date, Math, JSON, setTimeout, clearTimeout, requestAnimationFrame() {}
};
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });

load('js/config.js');
const P = sandbox.window.PixelRoom;
P.Storage = {
  state: {
    items: {}, lamps: { ceiling: [false, false, false, false], touched: false, nightLamp: false, deskLamp: false },
    settings: { anim: true }, dogSeed: 0, petToday: 0, petTotal: 0
  },
  save() {}
};
P.Time = {
  now: () => ({ hour: 12, hourInt: 12, min: 0, sec: 0 }),
  astro: () => ({ night: false }),
  season: () => ({ id: 'summer' }),
  getSchedule: () => ({ id: 'work' })
};
P.Character = { pos: () => ({ x: 147, dir: -1 }), screenMode: () => 'coding' };
P.Cat = {};
P.Lighting = { drawWindowBackdrop() {} };
P.Weather = { get: () => ({}) };
P.WeatherEffects = {};
P.UI = {};
P.Audio = {};
P.Interaction = {};
load('js/roomLayout.js');

const ctx = makeCtx(320, 180);
const st = { season: { id: 'summer' }, tp: P.Time.now(), weather: {}, activity: { id: 'work' } };
P.RoomLayout.drawHouse(ctx, st);

const outFile = process.argv[2] || '_shots/room.png';
const SC = 4;
const rx = 0, ry = 40, rw = 320, rh = 100;
const ow = rw * SC, oh = rh * SC;
const out = Buffer.alloc(ow * oh * 4);
for (let gy = 0; gy < oh; gy++) {
  for (let gx = 0; gx < ow; gx++) {
    const si = ((ry + (gy / SC | 0)) * 320 + (rx + (gx / SC | 0))) * 4;
    const di = (gy * ow + gx) * 4;
    out[di] = ctx.buf[si]; out[di+1] = ctx.buf[si+1]; out[di+2] = ctx.buf[si+2]; out[di+3] = 255;
  }
}
function crc32(buf) { let c, t = new Int32Array(256); for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } let crc = -1; for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ t[(crc ^ buf[i]) & 255]; return (crc ^ -1) >>> 0; }
function chunk(type, dataBuf) {
  const len = Buffer.alloc(4); len.writeUInt32BE(dataBuf.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), dataBuf]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(ow, 0); ihdr.writeUInt32BE(oh, 4);
ihdr[8] = 8; ihdr[9] = 6;
const stride = ow * 4;
const rawOut = Buffer.alloc(oh * (stride + 1));
for (let y = 0; y < oh; y++) { rawOut[y * (stride + 1)] = 0; out.copy(rawOut, y * (stride + 1) + 1, y * stride, (y + 1) * stride); }
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(rawOut, { level: 6 })),
  chunk('IEND', Buffer.alloc(0))
]);
fs.writeFileSync(outFile, png);
console.log('saved ' + outFile + ' ' + ow + 'x' + oh);
