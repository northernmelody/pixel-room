/* crop region from screenshot PNG and upscale (nearest) — for visual inspection */
'use strict';
const fs = require('fs');
const zlib = require('zlib');
const src = process.argv[2], dst = process.argv[3];
// region in screenshot px: lx ly w h, scale factor
const lx = Number(process.argv[4]), ly = Number(process.argv[5]);
const w = Number(process.argv[6]), h = Number(process.argv[7]);
const SC = Number(process.argv[8] || 4);

function decodePng(buf) {
  let off = 8; const idat = []; let W = 0, H = 0, bitDepth = 0, colorType = 0;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { W = data.readUInt32BE(0); H = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = W * bpp;
  const out = Buffer.alloc(W * H * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < H; y++) {
    const f = raw[y * (stride + 1)];
    const rowStart = y * (stride + 1) + 1;
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const v = raw[rowStart + x];
      let a = v;
      const left = x >= bpp ? cur[x - bpp] : 0;
      const up = prev[x];
      const ul = x >= bpp ? prev[x - bpp] : 0;
      if (f === 1) a = (v + left) & 255;
      else if (f === 2) a = (v + up) & 255;
      else if (f === 3) a = (v + ((left + up) >> 1)) & 255;
      else if (f === 4) {
        const p = left + up - ul, pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - ul);
        a = (v + (pa <= pb && pa <= pc ? left : pb <= pc ? up : ul)) & 255;
      }
      cur[x] = a;
    }
    for (let x = 0; x < W; x++) {
      const s = x * bpp;
      out[(y * W + x) * 4] = cur[s];
      out[(y * W + x) * 4 + 1] = colorType === 0 ? cur[s] : cur[s + 1];
      out[(y * W + x) * 4 + 2] = colorType === 0 ? cur[s] : cur[s + 2];
      out[(y * W + x) * 4 + 3] = colorType === 6 ? cur[s + 3] : 255;
    }
    prev = cur;
  }
  return { W, H, data: out };
}
const img = decodePng(fs.readFileSync(src));
const { W, H, data } = img;
const ow = w * SC, oh = h * SC;
const out = Buffer.alloc(ow * oh * 4);
for (let gy = 0; gy < oh; gy++) {
  for (let gx = 0; gx < ow; gx++) {
    const sx = lx + Math.floor(gx / SC);
    const sy = ly + Math.floor(gy / SC);
    const si = (sy * W + sx) * 4;
    const di = (gy * ow + gx) * 4;
    if (sx >= 0 && sx < W && sy >= 0 && sy < H) {
      out[di] = data[si]; out[di+1] = data[si+1]; out[di+2] = data[si+2]; out[di+3] = 255;
    }
  }
}
// encode PNG
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
for (let y = 0; y < oh; y++) {
  rawOut[y * (stride + 1)] = 0;
  out.copy(rawOut, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(rawOut, { level: 6 })),
  chunk('IEND', Buffer.alloc(0))
]);
fs.writeFileSync(dst, png);
console.log('saved ' + dst + ' ' + ow + 'x' + oh);
