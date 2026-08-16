/* PNG analyzer for pixel-room screenshots (no deps: zlib builtin) */
const fs = require('fs');
const zlib = require('zlib');

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not png');
  let off = 8, w = 0, h = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8) throw new Error('bitDepth ' + bitDepth);
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0;
  if (!bpp) throw new Error('colorType ' + colorType);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
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
        const pr = pa <= pb && pa <= pc ? left : pb <= pc ? up : ul;
        a = (v + pr) & 255;
      }
      cur[x] = a;
    }
    for (let x = 0; x < w; x++) {
      const s = x * bpp;
      out[(y * w + x) * 4] = cur[s];
      out[(y * w + x) * 4 + 1] = colorType === 0 ? cur[s] : cur[s + 1];
      out[(y * w + x) * 4 + 2] = colorType === 0 ? cur[s] : cur[s + 2];
      out[(y * w + x) * 4 + 3] = colorType === 6 ? cur[s + 3] : 255;
    }
    prev = cur;
  }
  return { w, h, data: out };
}

function px(data, w, x, y) { const i = (y * w + x) * 4; return [data[i], data[i+1], data[i+2], data[i+3]]; }

const mode = process.argv[2], file = process.argv[3];
const img = decodePng(fs.readFileSync(file));
const { w, h, data } = img;

if (mode === 'ascii') {
  const cols = Number(process.argv[4] || 120), rows = Number(process.argv[5] || 68);
  const chars = ' .:-=+*#%@';
  for (let gy = 0; gy < rows; gy++) {
    let line = '';
    for (let gx = 0; gx < cols; gx++) {
      let r = 0, g = 0, b = 0, n = 0;
      const x0 = Math.floor(gx * w / cols), x1 = Math.floor((gx + 1) * w / cols);
      const y0 = Math.floor(gy * h / rows), y1 = Math.floor((gy + 1) * h / rows);
      for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
        const c = px(data, w, x, y); r += c[0]; g += c[1]; b += c[2]; n++;
      }
      r /= n; g /= n; b /= n;
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      line += chars[Math.min(chars.length - 1, Math.floor(lum / 256 * chars.length))];
    }
    console.log(line);
  }
} else if (mode === 'region') {
  const rx = Number(process.argv[4]), ry = Number(process.argv[5]), rw = Number(process.argv[6]), rh = Number(process.argv[7]);
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) {
    const c = px(data, w, x, y); r += c[0]; g += c[1]; b += c[2]; n++;
  }
  r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
  console.log('avg rgb(' + r + ',' + g + ',' + b + ')  hex=#' + r.toString(16).padStart(2,'0') + g.toString(16).padStart(2,'0') + b.toString(16).padStart(2,'0'));
} else if (mode === 'crop') {
  // crop-ascii: node analyze-png.js crop file lx ly lw lh cellW cellH [OX OY SC]
  const OX = Number(process.argv[9] || 147.5625), OY = Number(process.argv[10] || 12), SC = Number(process.argv[11] || 3.02774);
  const lx = Number(process.argv[4]), ly = Number(process.argv[5]), lw = Number(process.argv[6]), lh = Number(process.argv[7]);
  const cw = Number(process.argv[8]); // logical px per cell (e.g. 1 or 2)
  const chars = ' .:-=+*#%@';
  const cols = Math.ceil(lw / cw), rows = Math.ceil(lh / cw);
  for (let gy = 0; gy < rows; gy++) {
    let line = '';
    for (let gx = 0; gx < cols; gx++) {
      let r = 0, g = 0, b = 0, n = 0;
      const x0 = Math.round(OX + (lx + gx * cw) * SC), x1 = Math.round(OX + (lx + (gx + 1) * cw) * SC);
      const y0 = Math.round(OY + (ly + gy * cw) * SC), y1 = Math.round(OY + (ly + (gy + 1) * cw) * SC);
      for (let y = y0; y < y1 && y < h; y++) for (let x = x0; x < x1 && x < w; x++) {
        const c = px(data, w, x, y); r += c[0]; g += c[1]; b += c[2]; n++;
      }
      if (!n) { line += '?'; continue; }
      r /= n; g /= n; b /= n;
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      line += chars[Math.min(chars.length - 1, Math.floor(lum / 256 * chars.length))];
    }
    console.log(line);
  }
} else if (mode === 'lregion') {
  // logical pixel coords -> screenshot coords (canvas letterboxed in 1264x569 viewport)
  const OX = Number(process.argv[8] || 147.5625), OY = Number(process.argv[9] || 12), SC = Number(process.argv[10] || 3.02774);
  const rx = Math.round(OX + Number(process.argv[4]) * SC), ry = Math.round(OY + Number(process.argv[5]) * SC);
  const rw = Math.max(1, Math.round(Number(process.argv[6]) * SC)), rh = Math.max(1, Math.round(Number(process.argv[7]) * SC));
  let r = 0, g = 0, b = 0, n = 0;
  const x1 = Math.min(w, rx + rw), y1 = Math.min(h, ry + rh);
  for (let y = ry; y < y1; y++) for (let x = rx; x < x1; x++) {
    const c = px(data, w, x, y); r += c[0]; g += c[1]; b += c[2]; n++;
  }
  if (!n) { console.log('empty region'); process.exit(0); }
  r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
  console.log('logical (' + process.argv[4] + ',' + process.argv[5] + ',' + process.argv[6] + 'x' + process.argv[7] + ') -> avg rgb(' + r + ',' + g + ',' + b + ')  hex=#' + r.toString(16).padStart(2,'0') + g.toString(16).padStart(2,'0') + b.toString(16).padStart(2,'0'));
} else if (mode === 'grid') {
  const cols = Number(process.argv[4] || 80), rows = Number(process.argv[5] || 45);
  const lines = [];
  for (let gy = 0; gy < rows; gy++) {
    let line = [];
    const y0 = Math.floor(gy * h / rows), y1 = Math.floor((gy + 1) * h / rows);
    for (let gx = 0; gx < cols; gx++) {
      let r = 0, g = 0, b = 0, n = 0;
      const x0 = Math.floor(gx * w / cols), x1 = Math.floor((gx + 1) * w / cols);
      for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
        const c = px(data, w, x, y); r += c[0]; g += c[1]; b += c[2]; n++;
      }
      line.push(Math.round(r/n) + ',' + Math.round(g/n) + ',' + Math.round(b/n));
    }
    lines.push(line.join('|'));
  }
  console.log(lines.join('\n'));
}
