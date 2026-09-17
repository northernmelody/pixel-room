/* Real-browser check for the horizontal /classic/ entry, which had a broken script path.
 * Usage: node _tools/check-classic.cjs [url]
 * Drives headless Chrome over CDP with no dependencies and keeps its profile in the repository. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const port = 9334;
const profile = path.join(root, '_tools/.chrome-profile-classic');
const page = process.argv[2] || 'http://127.0.0.1:8138/classic/';
const outIndex = process.argv.indexOf('--out');
const outFile = outIndex > -1 ? path.resolve(root, process.argv[outIndex + 1]) : path.join(root, '_shots/classic-entry-check.png');

const chromePath = [
  path.join(process.env.ProgramFiles || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
  path.join(process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)', 'Google/Chrome/Application/chrome.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe')
].find(candidate => candidate && fs.existsSync(candidate));
if (!chromePath) throw new Error('Chrome not found');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const endpoint = suffix => `http://127.0.0.1:${port}${suffix}`;

async function waitForEndpoint() {
  for (let i = 0; i < 100; i++) {
    try { const response = await fetch(endpoint('/json/version')); if (response.ok) return; } catch { /* keep waiting */ }
    await sleep(200);
  }
  throw new Error('Chrome did not expose the CDP endpoint');
}

function connect(wsUrl) {
  const pending = new Map(); let nextId = 1; const events = [];
  const socket = new WebSocket(wsUrl);
  const ready = new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = event => reject(new Error('CDP socket error: ' + (event.message || 'unknown'))); });
  socket.onmessage = message => {
    const payload = JSON.parse(message.data);
    if (payload.id && pending.has(payload.id)) { const { resolve, reject } = pending.get(payload.id); pending.delete(payload.id); payload.error ? reject(new Error(JSON.stringify(payload.error))) : resolve(payload.result); return; }
    if (payload.method === 'Runtime.exceptionThrown') events.push('EXCEPTION ' + (payload.params.exceptionDetails.exception?.description || payload.params.exceptionDetails.text));
    if (payload.method === 'Runtime.consoleAPICalled' && payload.params.type === 'error') events.push('CONSOLE ' + payload.params.args.map(arg => arg.value ?? arg.description).join(' '));
    if (payload.method === 'Log.entryAdded' && payload.params.entry.level === 'error') events.push('LOG ' + payload.params.entry.url + ' ' + payload.params.entry.text);
  };
  const send = async (method, params = {}) => {
    await ready;
    const id = nextId++;
    const result = new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      setTimeout(() => { if (pending.delete(id)) reject(new Error('CDP timeout: ' + method)); }, 20000);
    });
    socket.send(JSON.stringify({ id, method, params }));
    return result;
  };
  return { send, ready, events, close: () => socket.close() };
}

(async () => {
  fs.mkdirSync(profile, { recursive: true });
  const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--remote-debugging-port=' + port, '--remote-allow-origins=*', '--user-data-dir=' + profile, '--window-size=1440,900', 'about:blank'
  ], { stdio: 'ignore' });
  let client;
  const failures = [];
  const check = (ok, message) => { console.log((ok ? 'PASS ' : 'FAIL ') + message); if (!ok) failures.push(message); };
  try {
    await waitForEndpoint();
    const tab = await (await fetch(endpoint('/json/new?' + encodeURIComponent(page)), { method: 'PUT' })).json();
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
    for (let i = 0; i < 100; i++) {
      if (await evaluate("document.readyState==='complete' && !!window.PixelRoom && !!window.PixelRoom.UI")) break;
      await sleep(200);
    }
    check(await evaluate("!!(window.PixelRoom && window.PixelRoom.UI)"), 'js/ui.js loads and defines PixelRoom.UI');
    check(await evaluate("!!(window.PixelRoom && window.PixelRoom.LifeUI)"), 'js/lifeUI.js loads and defines PixelRoom.LifeUI');
    check(await evaluate("!!document.querySelector('.life-hover')"), 'LifeUI.init ran (hover layer exists)');
    const clock = await evaluate("document.querySelector('#beijing-time').textContent");
    check(/^\d{2}:\d{2}:\d{2}$/.test(clock) && clock !== '--:--:--', 'Clock shows a real time: ' + clock);
    await sleep(1500);
    const clock2 = await evaluate("document.querySelector('#beijing-time').textContent");
    check(clock2 !== clock, 'Clock advances, so the main loop is running (' + clock + ' -> ' + clock2 + ')');
    check(await evaluate("(()=>{const c=document.querySelector('#scene'),d=c.getContext('2d').getImageData(600,200,64,64).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i])n++;return n>500;})()"), 'Scene canvas is rendered, not blank');
    check(await evaluate("(()=>{const p=document.querySelector('#settings-panel');document.querySelector('#settings-btn').click();return !p.classList.contains('hidden');})()"), 'Settings panel opens (js/ui.js wiring works)');
    check(await evaluate("(()=>{const p=document.querySelector('#settings-panel');document.querySelector('#settings-btn').click();return p.classList.contains('hidden');})()"), 'Settings panel closes again');
    check(client.events.length === 0, 'No page errors' + (client.events.length ? ': ' + client.events.join(' | ') : ''));
    const shot = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, Buffer.from(shot.data, 'base64'));
    console.log('screenshot ' + path.relative(root, outFile).replaceAll('\\', '/'));
    console.log(failures.length ? 'FAIL ' + failures.length + ' check(s)' : 'ALL PASS');
    if (failures.length) process.exitCode = 1;
  } finally {
    if (client) client.close();
    chrome.kill();
  }
})().catch(error => { console.error(String(error.stack || error)); process.exitCode = 1; });
