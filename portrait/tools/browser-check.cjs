/* Real-browser check for the portrait page: drives headless Chrome over CDP with no dependencies.
 * Usage: node portrait/tools/browser-check.cjs [page] [--out <png>]
 * Keeps the browser profile inside the repository so the check stays workspace-local. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const port = 9333;
const profile = path.join(root, '_tools/.chrome-profile-portrait');
const page = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://127.0.0.1:8138/portrait/tests/browser.html';
const outIndex = process.argv.indexOf('--out');
const outFile = outIndex > -1 ? path.resolve(root, process.argv[outIndex + 1]) : path.join(root, '_shots/portrait-browser-check.png');
const timeoutMs = 300000;

const chromePath = [
  path.join(process.env.ProgramFiles || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
  path.join(process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)', 'Google/Chrome/Application/chrome.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe')
].find(candidate => candidate && fs.existsSync(candidate));
if (!chromePath) throw new Error('Chrome not found; pass a path via CHROME_PATH');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const endpoint = path => `http://127.0.0.1:${port}${path}`;

async function waitForEndpoint() {
  for (let i = 0; i < 100; i++) {
    try { const response = await fetch(endpoint('/json/version')); if (response.ok) return response.json(); } catch { /* keep waiting */ }
    await sleep(200);
  }
  throw new Error('Chrome did not expose the CDP endpoint');
}

function connect(wsUrl) {
  const pending = new Map(); let nextId = 1;
  const events = [];
  const socket = new WebSocket(wsUrl);
  const ready = new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = event => reject(new Error('CDP socket error: ' + (event.message || 'unknown'))); });
  socket.onmessage = message => {
    const payload = JSON.parse(message.data);
    if (payload.id && pending.has(payload.id)) { const { resolve, reject } = pending.get(payload.id); pending.delete(payload.id); payload.error ? reject(new Error(JSON.stringify(payload.error))) : resolve(payload.result); return; }
    if (payload.method === 'Runtime.exceptionThrown') events.push('EXCEPTION ' + (payload.params.exceptionDetails.exception?.description || payload.params.exceptionDetails.text));
    if (payload.method === 'Runtime.consoleAPICalled' && payload.params.type === 'error') events.push('CONSOLE ' + payload.params.args.map(arg => arg.value ?? arg.description).join(' '));
    if (payload.method === 'Log.entryAdded' && payload.params.entry.level === 'error') events.push('LOG ' + payload.params.entry.text);
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

const evaluate = async (client, expression) => {
  const result = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error('Page evaluation failed: ' + (result.exceptionDetails.exception?.description || result.exceptionDetails.text));
  return result.result?.value;
};

(async () => {
  fs.mkdirSync(profile, { recursive: true });
  const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--remote-debugging-port=' + port, '--remote-allow-origins=*', '--user-data-dir=' + profile, '--window-size=430,932', 'about:blank'
  ], { stdio: 'ignore' });
  let client;
  try {
    await waitForEndpoint();
    console.log('cdp ready on ' + port);
    const tab = await (await fetch(endpoint('/json/new?' + encodeURIComponent(page)), { method: 'PUT' })).json();
    console.log('tab opened: ' + page);
    client = connect(tab.webSocketDebuggerUrl);
    await client.ready;
    await client.send('Runtime.enable');
    await client.send('Log.enable');
    await client.send('Page.enable');
    for (let i = 0; i < 100; i++) {
      if (await evaluate(client, "document.body.dataset.testReady==='1'")) break;
      await sleep(200);
    }
    console.log('test page ready, clicking #run');
    await evaluate(client, "document.querySelector('#run').click(); 'clicked'");
    const started = Date.now();
    let text = '';
    while (Date.now() - started < timeoutMs) {
      text = await evaluate(client, "document.querySelector('#results').textContent") || '';
      if (text.includes('ALL PASS') || text.includes('FAIL ')) break;
      await sleep(2000);
    }
    console.log('--- results ---');
    console.log(text.trim() || '(no result produced)');
    if (client.events.length) { console.log('--- page errors ---'); client.events.forEach(entry => console.log(entry)); }
    const shot = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, Buffer.from(shot.data, 'base64'));
    console.log('screenshot ' + path.relative(root, outFile).replaceAll('\\', '/'));
    if (!text.includes('ALL PASS')) process.exitCode = 1;
  } finally {
    if (client) client.close();
    chrome.kill();
  }
})().catch(error => { console.error(String(error.stack || error)); process.exitCode = 1; });
