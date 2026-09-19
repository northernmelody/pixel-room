/* Viewport regression for the portrait page: forces real layout widths through CDP
 * emulation (Chrome on Windows ignores --window-size for page layout) and checks that
 * the caption, the clock and the canvas stay inside the frame without page overflow.
 * Usage: node portrait/tools/viewport-check.cjs [url] [--shots] */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const port = 9340;
const profile = path.join(root, '_tools/.chrome-viewport');
const base = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://127.0.0.1:8138/portrait/?d=2026-09-17&t=16:30';
const wantShots = process.argv.includes('--shots');
const VIEWPORTS = [[320, 568], [375, 812], [390, 844], [430, 932], [1440, 900]];

const chromePath = [
  path.join(process.env.ProgramFiles || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
  path.join(process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)', 'Google/Chrome/Application/chrome.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe')
].find(candidate => candidate && fs.existsSync(candidate));
if (!chromePath) throw new Error('Chrome not found');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const endpoint = suffix => `http://127.0.0.1:${port}${suffix}`;

function connect(wsUrl) {
  const pending = new Map(); let nextId = 1; const events = [];
  const socket = new WebSocket(wsUrl);
  const ready = new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = () => reject(new Error('CDP socket error')); });
  socket.onmessage = message => {
    const payload = JSON.parse(message.data);
    if (payload.id && pending.has(payload.id)) { const { resolve, reject } = pending.get(payload.id); pending.delete(payload.id); payload.error ? reject(new Error(JSON.stringify(payload.error))) : resolve(payload.result); return; }
    if (payload.method === 'Runtime.exceptionThrown') events.push('EXCEPTION ' + (payload.params.exceptionDetails.exception?.description || payload.params.exceptionDetails.text));
    if (payload.method === 'Log.entryAdded' && payload.params.entry.level === 'error') events.push('LOG ' + payload.params.entry.url + ' ' + payload.params.entry.text);
  };
  const send = async (method, params = {}) => {
    await ready;
    const id = nextId++;
    const result = new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); setTimeout(() => { if (pending.delete(id)) reject(new Error('CDP timeout: ' + method)); }, 20000); });
    socket.send(JSON.stringify({ id, method, params }));
    return result;
  };
  return { send, ready, events, close: () => socket.close() };
}

const PROBE = `(()=>{
  const doc=document.documentElement, frame=document.querySelector('.scene-frame').getBoundingClientRect();
  const bar=document.querySelector('.scene-caption').getBoundingClientRect();
  const label=document.querySelector('#scene-caption'), labelBox=label.getBoundingClientRect();
  const clock=document.querySelector('#clock'), clockBox=clock.getBoundingClientRect();
  return JSON.stringify({
    innerWidth: innerWidth,
    scrollWidth: doc.scrollWidth,
    text: label.textContent,
    parts: label.textContent.split(' · ').length,
    frame: {left:frame.left, right:frame.right, width:frame.width},
    bar: {left:bar.left, right:bar.right},
    label: {left:labelBox.left, right:labelBox.right, clipped: label.scrollWidth > label.clientWidth + 1},
    clock: {text: clock.textContent, left: clockBox.left, right: clockBox.right, visible: clockBox.width > 0 && clockBox.height > 0 && getComputedStyle(clock).visibility === 'visible'},
    canvasDrawn: (()=>{const c=document.querySelector('#house'),d=c.getContext('2d').getImageData(Math.floor(c.width/2),Math.floor(c.height/2),24,24).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i])n++;return n>200;})()
  });
})()`;

(async () => {
  fs.mkdirSync(profile, { recursive: true });
  const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--remote-debugging-port=' + port, '--remote-allow-origins=*', '--user-data-dir=' + profile, 'about:blank'
  ], { stdio: 'ignore' });
  let client; const failures = [];
  const check = (ok, message) => { console.log((ok ? 'PASS ' : 'FAIL ') + message); if (!ok) failures.push(message); };
  try {
    for (let i = 0; i < 100; i++) { try { if ((await fetch(endpoint('/json/version'))).ok) break; } catch {} await sleep(200); }
    const tab = await (await fetch(endpoint('/json/new?' + encodeURIComponent(base)), { method: 'PUT' })).json();
    client = connect(tab.webSocketDebuggerUrl);
    await client.ready;
    await client.send('Runtime.enable');
    await client.send('Log.enable');
    await client.send('Page.enable');
    const evaluate = async expression => {
      const result = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error('Page evaluation failed: ' + (result.exceptionDetails.exception?.description || result.exceptionDetails.text));
      return result.result?.value;
    };
    for (const [width, height] of VIEWPORTS) {
      await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
      await evaluate('location.reload()');
      for (let i = 0; i < 100; i++) { if (await evaluate('!!window.PortraitPreview')) break; await sleep(200); }
      await sleep(900);
      const info = JSON.parse(await evaluate(PROBE));
      const tag = width + 'x' + height;
      check(Math.abs(info.innerWidth - width) <= 1, tag + ': layout width is ' + info.innerWidth);
      check(info.scrollWidth <= info.innerWidth + 1, tag + ': no horizontal page overflow (' + info.scrollWidth + ')');
      check(info.parts === 3 && info.text.endsWith(info.text.split(' · ')[2]) && info.text.split(' · ')[2].length > 0, tag + ': caption shows the behaviour "' + info.text + '"');
      check(info.label.left >= info.bar.left - 1 && info.label.right <= info.bar.right + 1, tag + ': caption stays inside the bar');
      check(info.clock.visible && info.clock.right <= info.frame.right + 1 && info.clock.left >= info.frame.left, tag + ': clock visible inside the frame (' + info.clock.text + ' at ' + Math.round(info.clock.left) + '..' + Math.round(info.clock.right) + ')');
      check(info.canvasDrawn, tag + ': canvas rendered');
      if (wantShots) {
        const shot = await client.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(root, `_shots/viewport-${width}x${height}.png`), Buffer.from(shot.data, 'base64'));
      }
    }
    check(client.events.length === 0, 'No page errors' + (client.events.length ? ': ' + client.events.join(' | ') : ''));
    console.log(failures.length ? 'FAIL ' + failures.length + ' check(s)' : 'ALL PASS');
    if (failures.length) process.exitCode = 1;
  } finally {
    if (client) client.close();
    chrome.kill();
  }
})().catch(error => { console.error(String(error.stack || error)); process.exitCode = 1; });
