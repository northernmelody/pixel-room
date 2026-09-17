// Capture once; subsequent runs check the protected horizontal application.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const target = path.join(root, 'portrait/artifacts/baseline.json');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
const files = [path.join(root, 'classic/index.html'), ...['js', 'css', 'assets'].flatMap(dir => walk(path.join(root, dir)))];
const hashes = Object.fromEntries(files.map(file => [path.relative(root, file).replaceAll('\\', '/'), crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
if (process.argv.includes('--capture')) {
  if (fs.existsSync(target)) throw new Error('Baseline already exists; refusing to overwrite evidence.');
  const sandbox = { window: { PixelRoom: {} } };
  vm.createContext(sandbox);
  ['storyData.js', 'songs.js'].forEach(file => vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), sandbox));
  const data = sandbox.window.PixelRoom;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify({ capturedAt: new Date().toISOString(), commit: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), files: hashes }, null, 2) + '\n');
  const contentDir = path.join(root, 'portrait/js/content');
  fs.mkdirSync(contentDir, { recursive: true });
  fs.writeFileSync(path.join(contentDir, 'index.js'), '// Snapshot of original storyData.js and songs.js; source hashes in artifacts/baseline.json.\nexport const STORY = ' + JSON.stringify(data.StoryData, null, 2) + ';\nexport const SONGS = ' + JSON.stringify(data.Songs, null, 2) + ';\n');
  console.log('Captured ' + files.length + ' original files and unchanged narrative content.');
} else {
  const before = JSON.parse(fs.readFileSync(target, 'utf8'));
  const changed = Object.keys(before.files).filter(file => before.files[file] !== hashes[file]);
  if (changed.length) throw new Error('Protected original files changed: ' + changed.join(', '));
  console.log('PASS: ' + files.length + ' original files unchanged.');
}
