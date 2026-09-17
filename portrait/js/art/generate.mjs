import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');

function recorder() {
  const commands = [];
  const marks = Object.create(null);
  const stack = [];
  let tx = 0, ty = 0, sx = 1, sy = 1, style = '#000', alpha = 1;
  let pathPoints = [];
  const ctx = {
    commands, marks,
    __mark(name) { marks[name] = commands.length; },
    save() { stack.push([tx, ty, sx, sy, style, alpha]); },
    restore() { [tx, ty, sx, sy, style, alpha] = stack.pop() || [0, 0, 1, 1, '#000', 1]; },
    translate(x, y) { tx += x * sx; ty += y * sy; },
    scale(x, y) { sx *= x; sy *= y; },
    beginPath() { pathPoints = []; },
    closePath() {},
    moveTo(x, y) { pathPoints.push([tx + x * sx, ty + y * sy]); },
    lineTo(x, y) { pathPoints.push([tx + x * sx, ty + y * sy]); },
    fill() {
      if (pathPoints.length >= 3) commands.push(['p', pathPoints.map(p => [round(p[0]), round(p[1])]), encodeStyle(style), alpha]);
    },
    fillRect(x, y, w, h) {
      let rx = tx + x * sx, ry = ty + y * sy, rw = w * sx, rh = h * sy;
      if (rw < 0) { rx += rw; rw = -rw; }
      if (rh < 0) { ry += rh; rh = -rh; }
      if (rw > 0 && rh > 0) commands.push(['r', round(rx), round(ry), round(rw), round(rh), encodeStyle(style), alpha]);
    },
    createLinearGradient(x0, y0, x1, y1) {
      return { kind: 'linear', args: [tx + x0 * sx, ty + y0 * sy, tx + x1 * sx, ty + y1 * sy], stops: [], addColorStop(at, color) { this.stops.push([at, color]); } };
    },
    drawImage() {}, fillText() {}, measureText() { return { width: 0 }; },
    set fillStyle(v) { style = v; }, get fillStyle() { return style; },
    set globalAlpha(v) { alpha = Number(v); }, get globalAlpha() { return alpha; },
    font: '', textBaseline: ''
  };
  return ctx;
}

function round(n) { return Math.round(n * 1000) / 1000; }
function encodeStyle(value) {
  if (!value || typeof value === 'string') return value || '#000';
  if (value.kind === 'linear') return { g: 'linear', a: value.args.map(round), s: value.stops };
  return '#000';
}

function boundsOf(command) {
  if (command[0] === 'r') return [command[1], command[2], command[1] + command[3], command[2] + command[4]];
  const xs = command[1].map(p => p[0]), ys = command[1].map(p => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

function crop(commands, label, extra = {}) {
  if (!commands.length) throw new Error(`No drawing commands for ${label}`);
  const bs = commands.map(boundsOf);
  const left = Math.floor(Math.min(...bs.map(b => b[0])));
  const top = Math.floor(Math.min(...bs.map(b => b[1])));
  const right = Math.ceil(Math.max(...bs.map(b => b[2])));
  const bottom = Math.ceil(Math.max(...bs.map(b => b[3])));
  const shifted = commands.map(command => {
    if (command[0] === 'r') return ['r', round(command[1] - left), round(command[2] - top), command[3], command[4], shiftStyle(command[5], left, top), command[6]];
    return ['p', command[1].map(p => [round(p[0] - left), round(p[1] - top)]), shiftStyle(command[2], left, top), command[3]];
  });
  return { width: right - left, height: bottom - top, label, ...extra, commands: shifted };
}

function shiftStyle(style, left, top) {
  if (!style || typeof style === 'string') return style;
  return { ...style, a: [style.a[0] - left, style.a[1] - top, style.a[2] - left, style.a[3] - top] };
}

function makeContext() {
  const sandbox = {
    console, Math, Date, setTimeout, clearTimeout,
    performance: { now: () => 0 },
    location: { search: '' }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/config.js'), 'utf8'), sandbox, { filename: 'config.js' });
  const P = sandbox.PixelRoom;
  P.Storage = { state: { items: {}, lamps: { touched: true, touchedDate: '2026-01-01', ceiling: [false, false, false, false] } }, save() {} };
  P.Time = {
    now: () => ({ year: 2026, month: 1, day: 1, hour: 12 }),
    astro: () => ({ night: false }), season: () => ({ id: 'spring' }),
    isFreelance: () => false, getSchedule: () => ({ id: 'work' })
  };
  P.DailyLife = null;
  P.Character = {
    wardrobeOpen: () => null, guitarTaken: () => false, fridgeOpen: () => null,
    mealFood: () => null, leisureAct: () => null, screenMode: () => 'coding',
    pos: () => ({ x: 100, y: 128 }), sleepState: () => ({ sleeping: false })
  };
  P.Cat = { perchId: () => null };
  P.Lighting = { drawWindowBackdrop(ctx, st, x, y, w, h) {
    ctx.fillStyle = st.night ? '#101a3a' : (st.season.id === 'winter' ? '#bcd8ee' : '#7cc0f5');
    ctx.fillRect(x, y, w, h);
    if (st.night) {
      ctx.fillStyle = '#e8ecf8'; ctx.fillRect(x + w - 5, y + 3, 3, 3);
      ctx.fillStyle = '#101a3a'; ctx.fillRect(x + w - 5, y + 3, 1, 1);
    } else {
      ctx.fillStyle = '#fff6d8'; ctx.fillRect(x + w - 5, y + 3, 3, 3);
    }
  } };
  return sandbox;
}

function injectRoom(source) {
  const replacements = [
    ['    const R = FURN.bedroom.rug;', "    ctx.__mark && ctx.__mark('bedroomRug');\n    const R = FURN.bedroom.rug;"],
    ['    const W2 = FURN.workspace.rug;', "    ctx.__mark && ctx.__mark('workspaceRug');\n    const W2 = FURN.workspace.rug;"],
    ['    const cl = R.clock;', "    ctx.__mark && ctx.__mark('clock');\n    const cl = R.clock;"],
    ['    drawPlushWall(ctx);', "    ctx.__mark && ctx.__mark('clockEnd');\n    drawPlushWall(ctx);"],
    ['    const p = R.poster;', "    ctx.__mark && ctx.__mark('poster');\n    const p = R.poster;"],
    ['    const s = R.socket;', "    ctx.__mark && ctx.__mark('socket');\n    const s = R.socket;"],
    ['    const m = R.mirror;', "    ctx.__mark && ctx.__mark('mirror');\n    const m = R.mirror;"],
    ['    const t = R.towel;', "    ctx.__mark && ctx.__mark('towel');\n    const t = R.towel;"],
    ['    const pr = R.potRack;', "    ctx.__mark && ctx.__mark('potRack');\n    const pr = R.potRack;"],
    ['    const sh = R.wallShelf;', "    ctx.__mark && ctx.__mark('spiceShelf');\n    const sh = R.wallShelf;"]
  ];
  for (const [from, to] of replacements) {
    if (!source.includes(from)) throw new Error(`Room source marker missing: ${from}`);
    source = source.replace(from, to);
  }
  const hook = `
  P.__RoomArt = {
    wardrobe: drawWardrobe, bookshelf: drawBookshelf, counter: drawCounterGroup,
    fridge: drawFridge, cabinets: drawKitchenCabinets, vanity: drawVanityGroup,
    toilet: drawToilet, shower: drawShower, guitar: drawGuitar,
    bed: drawBed, nightstand: drawNightstand, desk: drawDeskGroup,
    chair: drawChair, table: drawTableGroup, plant: drawPlant,
    windowStatic: drawWindowStatic, windowDynamic: drawWindowDynamic, rugs: drawRugs,
    bedroomDecor: drawBedroomDecor, workspaceDecor: drawWorkspaceDecor,
    bathroomDecor: drawBathroomDecor, kitchenDecor: drawKitchenDecor,
    catBowl: drawCatBowl, dogBowl: drawDogBowl, dogBed: drawDogBed,
    package: drawPackage, exteriorDoor: drawExteriorDoor,
    seasonStatic: drawSeasonItemsStatic, seasonDynamic: drawSeasonItemsDynamic,
    monitorContent: drawMonitorContent, collectibles: PKG_ITEMS,
    plush(ctx, key) { drawPlushCell(ctx, key, 20, 20); },
    deskWithoutChair(ctx, st) { const saved = drawChair; drawChair = function () {}; try { drawDeskGroup(ctx, st); } finally { drawChair = saved; } },
    counterWithoutPlant(ctx, st) { const saved = drawPlant; drawPlant = function () {}; try { drawCounterGroup(ctx, st); } finally { drawPlant = saved; } },
    furn: FURN
  };
`;
  const anchor = '  P.RoomLayout = {';
  if (!source.includes(anchor)) throw new Error('Room export anchor missing');
  return source.replace(anchor, hook + '\n' + anchor);
}

function injectBeforeExport(source, anchor, hook) {
  if (!source.includes(anchor)) throw new Error(`Export anchor missing: ${anchor}`);
  return source.replace(anchor, hook + '\n' + anchor);
}

const sandbox = makeContext();
vm.runInContext(injectRoom(fs.readFileSync(path.join(root, 'js/roomLayout.js'), 'utf8')), sandbox, { filename: 'roomLayout.js' });
vm.runInContext(injectBeforeExport(
  fs.readFileSync(path.join(root, 'js/character.js'), 'utf8'),
  '  P.Character = {',
  `  P.__CharacterArt = { stand(ctx) { drawStand(ctx, 30, 1, { shirt: '#4a7bd0', pants: '#3a3f55' }, 0); } };`
), sandbox, { filename: 'character.js' });
vm.runInContext(injectBeforeExport(
  fs.readFileSync(path.join(root, 'js/cat.js'), 'utf8'),
  '  P.Cat = {',
  `  P.__CatArt = { idle(ctx) { drawCat(ctx, 30, 30, 1, PALETTES[0], 'idle', 0); } };`
), sandbox, { filename: 'cat.js' });
vm.runInContext(injectBeforeExport(
  fs.readFileSync(path.join(root, 'js/dog.js'), 'utf8'),
  '  P.Dog = {',
  `  P.__DogArt = { sit(ctx) {
    // The portrait sprite uses a compact pixel silhouette, so keep the original
    // palette and semantics while giving the dachshund a more recognizable,
    // elongated body. This is portrait-only; the horizontal art stays intact.
    ctx.fillStyle = '#8B5A2B';
    ctx.fillRect(2, 8, 19, 7);   // long body
    ctx.fillRect(0, 10, 4, 4);   // tail
    ctx.fillRect(19, 6, 8, 7);   // neck and head
    ctx.fillRect(21, 3, 4, 4);   // ear
    ctx.fillStyle = '#C49A6C';
    ctx.fillRect(5, 12, 13, 2);   // belly highlight
    ctx.fillStyle = '#5C3A1E';
    ctx.fillRect(4, 14, 3, 4);    // rear leg
    ctx.fillRect(16, 14, 3, 4);   // front leg
    ctx.fillRect(3, 17, 4, 1);
    ctx.fillRect(16, 17, 4, 1);
    ctx.fillRect(22, 4, 2, 2);    // ear detail
    ctx.fillStyle = '#1A1A1A';
    ctx.fillRect(24, 7, 2, 2);    // eye
    ctx.fillRect(26, 9, 2, 2);    // nose
    ctx.fillStyle = '#3a2418';
    ctx.fillRect(20, 12, 3, 1);   // muzzle shadow
    ctx.fillStyle = '#cc3333';
    ctx.fillRect(19, 12, 2, 1);   // collar
    ctx.fillStyle = '#ffd05a';
    ctx.fillRect(21, 13, 1, 1);
  } };`
), sandbox, { filename: 'dog.js' });

const P = sandbox.PixelRoom;
const A = P.__RoomArt;
const sprites = Object.create(null);
const st = (season = 'spring', night = false) => ({ season: { id: season }, night, tp: {}, activity: { id: 'work' } });

function add(key, label, draw, extra = {}) {
  const ctx = recorder();
  draw(ctx);
  sprites[key] = crop(ctx.commands, label, extra);
}

function addMarked(key, label, fn, from, to) {
  const ctx = recorder();
  fn(ctx);
  const a = ctx.marks[from];
  const b = to ? ctx.marks[to] : ctx.commands.length;
  if (a == null || b == null) throw new Error(`Missing mark range ${from}..${to || 'end'}`);
  sprites[key] = crop(ctx.commands.slice(a, b), label);
}

add('wardrobe', '衣柜', c => A.wardrobe(c, st()));
for (const season of ['spring', 'summer', 'autumn', 'winter']) {
  add(`bookshelf:${season}`, '书架（含两本信件书）', c => A.bookshelf(c, st(season)), { season });
}
add('kitchenCounter', '厨房台柜、灶台和水槽', c => A.counterWithoutPlant(c, st()));
add('fridge', '冰箱', c => A.fridge(c, st()));
add('kitchenCabinets', '厨房吊柜', c => A.cabinets(c, st()));
add('vanity', '浴室洗手台', c => A.vanity(c, st()));
add('toilet', '马桶', c => A.toilet(c, st()));
add('shower', '淋浴间和花洒', c => A.shower(c, st()));
add('guitar', '木吉他', c => A.guitar(c, st()));
for (const blanket of ['cover', 'made', 'messy']) {
  P.Storage.state.items.blanket = blanket;
  add(`bed:${blanket}`, '床、枕头、被子和腊肠狗抱枕', c => A.bed(c, st()), { blanket });
}
for (const lampOn of [false, true]) {
  P.Storage.state.lamps.nightLamp = lampOn;
  add(`nightstand:${lampOn ? 'on' : 'off'}`, '床头柜和台灯', c => A.nightstand(c, st()), { lampOn });
}
for (const lampOn of [false, true]) for (let cup = 0; cup <= 4; cup++) {
  P.Storage.state.lamps.deskLamp = lampOn;
  P.Storage.state.items.cup = cup;
  add(`desk:${lampOn ? 'on' : 'off'}:${cup}`, '书桌、显示器、键盘、杯子和台灯', c => {
    A.deskWithoutChair(c, st());
    const m = A.furn.workspace.monitor;
    A.monitorContent(c, 'coding', 0, m.x + 1, m.y + 2, m.w - 2, m.h - 6);
  }, { lampOn, cup });
}
add('chair', '木椅', c => A.chair(c, st()));
add('tableStools', '餐桌和两只凳子', c => A.table(c, st()));
addMarked('bedroomRug', '卧室地毯', c => A.rugs(c, st()), 'bedroomRug', 'workspaceRug');
addMarked('workspaceRug', '工作区地毯', c => A.rugs(c, st()), 'workspaceRug');
for (const season of ['spring', 'summer', 'autumn', 'winter']) {
  add(`kitchenPlant:${season}`, '厨房盆栽', c => A.plant(c, 30, 30, season), { season });
}

for (const [room, index] of [['bedroom', 0], ['workspace', 1], ['bathroom', 2], ['kitchen', 3]]) {
  for (const season of ['spring', 'summer', 'autumn', 'winter']) for (const night of [false, true]) {
    add(`window-${room}:${season}:${night ? 'night' : 'day'}`, `${room} 窗户`, c => {
      A.windowStatic(c, st(season, night), index);
      A.windowDynamic(c, st(season, night), index);
    }, { season, night });
  }
}

addMarked('wallClock', '挂钟', c => A.bedroomDecor(c, st()), 'clock', 'clockEnd');
addMarked('giraffePoster', '长颈鹿海报', c => A.workspaceDecor(c, st()), 'poster', 'socket');
addMarked('socket', '插座和线缆', c => A.workspaceDecor(c, st()), 'socket');
addMarked('roundMirror', '圆镜', c => A.bathroomDecor(c, st()), 'mirror', 'towel');
addMarked('towel', '毛巾和毛巾架', c => A.bathroomDecor(c, st()), 'towel');
addMarked('potRack', '锅具挂架', c => A.kitchenDecor(c, st()), 'potRack', 'spiceShelf');
addMarked('spiceShelf', '调料架', c => A.kitchenDecor(c, st()), 'spiceShelf');

for (const plush of ['boba', 'avocado', 'bunny', 'orange', 'octopus', 'ramen']) {
  add(`plush-${plush}`, `${plush} 像素挂件`, c => A.plush(c, plush), { plush });
}

for (let bowl = 0; bowl <= 3; bowl++) {
  P.Storage.state.items.bowl = bowl;
  add(`catBowl:${bowl}`, '猫粮碗', c => A.catBowl(c, st()), { bowl });
  P.Storage.state.items.dogBowl = bowl;
  add(`dogBowl:${bowl}`, '狗粮碗', c => A.dogBowl(c, st()), { bowl });
}
add('dogBed', '狗窝', c => A.dogBed(c, st()));
P.Storage.state.items.pkg = { state: 'arrived' };
add('package', '快递箱', c => A.package(c, st()));
add('exteriorDoor', '户外木门', c => A.exteriorDoor(c));

for (const season of ['summer', 'winter']) {
  const c = recorder();
  A.seasonStatic(c, st(season));
  A.seasonDynamic(c, st(season), 0);
  if (season === 'summer') {
    const ac = A.furn.bedroom.acSpot, fan = A.furn.workspace.fanSpot;
    sprites.ac = crop(select(c.commands, [ac.x - 1, ac.y - 2, ac.x + ac.w + 1, ac.y + ac.h + 1]), '空调');
    sprites.fan = crop(select(c.commands, [fan.x - 2, fan.y - 2, fan.x + fan.w, fan.y + fan.h + 1]), '风扇');
    const kitchenFanX = P.Config.mapLegacyX(302);
    sprites.kitchenFan = crop(select(c.commands, [kitchenFanX, 96, kitchenFanX + 2, 98]), '厨房小风扇');
  } else {
    const heater = A.furn.bedroom.heaterSpot, humid = A.furn.workspace.humidSpot;
    sprites.heater = crop(select(c.commands, [heater.x - 1, heater.y - 5, heater.x + heater.w + 1, heater.y + heater.h + 1]), '暖气片');
    sprites.humidifier = crop(select(c.commands, [humid.x - 1, humid.y - 5, humid.x + humid.w + 1, humid.y + humid.h + 1]), '加湿器');
    const kx = P.Config.mapLegacyX(256), ky = 106 + (P.Config.FLOOR_Y - P.Config.LEGACY_FLOOR_Y);
    sprites.kettle = crop(select(c.commands, [kx - 1, ky - 3, kx + 5, ky + 5]), '保温壶');
  }
}

function select(commands, box) {
  return commands.filter(command => {
    const b = boundsOf(command);
    return b[2] > box[0] && b[0] < box[2] && b[3] > box[1] && b[1] < box[3];
  });
}

for (const id of ['figurine', 'mug', 'painting', 'plant', 'vase']) {
  add(`collectible-${id}`, `收藏品 ${id}`, c => A.collectibles[id](c), { collectible: id });
}
add('human', '人物（站立）', c => P.__CharacterArt.stand(c));
add('cat', '橘猫（静态）', c => P.__CatArt.idle(c));
add('dog', '腊肠狗（坐姿）', c => P.__DogArt.sit(c));

const output = `// Generated from the original Canvas drawing functions by generate.mjs.\n` +
  `// Do not hand-edit; regenerate after intentional source-art changes.\n` +
  `export const SPRITES = ${JSON.stringify(sprites)};\n`;
fs.writeFileSync(path.join(here, 'sprites.generated.js'), output);

const summary = Object.fromEntries(Object.entries(sprites).map(([id, sprite]) => [id, `${sprite.width}x${sprite.height}`]));
console.log(JSON.stringify(summary, null, 2));
