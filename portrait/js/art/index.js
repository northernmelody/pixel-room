import { SPRITES } from './sprites.generated.js';

const SEASONS = new Set(['spring', 'summer', 'autumn', 'winter']);

const DEFINITIONS = {
  wardrobe: ['wardrobe', '衣柜'],
  bed: ['bed:cover', '床（含枕头、被子与腊肠狗抱枕）', { options: { blanket: ['cover', 'made', 'messy'] } }],
  nightstand: ['nightstand:off', '床头柜与台灯', { options: { lampOn: 'boolean' } }],
  guitar: ['guitar', '木吉他'],
  wallClock: ['wallClock', '挂钟'],
  'plush-boba': ['plush-boba', '珍珠奶茶挂件'],
  'plush-avocado': ['plush-avocado', '牛油果挂件'],
  'plush-bunny': ['plush-bunny', '白兔挂件'],
  'plush-orange': ['plush-orange', '橙色玩偶挂件'],
  'plush-octopus': ['plush-octopus', '粉色章鱼挂件'],
  'plush-ramen': ['plush-ramen', '拉面挂件'],
  'window-bedroom': ['window-bedroom:spring:day', '卧室窗户', { options: { season: [...SEASONS], night: 'boolean' } }],
  'window-workspace': ['window-workspace:spring:day', '工作区窗户', { options: { season: [...SEASONS], night: 'boolean' } }],
  'window-bathroom': ['window-bathroom:spring:day', '卫生间窗户', { options: { season: [...SEASONS], night: 'boolean' } }],
  'window-kitchen': ['window-kitchen:spring:day', '厨房窗户', { options: { season: [...SEASONS], night: 'boolean' } }],
  bookshelf: ['bookshelf:spring', '书架（含两本信件书）', { options: { season: [...SEASONS] } }],
  giraffePoster: ['giraffePoster', '长颈鹿海报'],
  socket: ['socket', '插座与线缆'],
  desk: ['desk:off:4', '书桌组合（含显示器、键盘、杯子与台灯）', { options: { lampOn: 'boolean', cup: [0, 1, 2, 3, 4] } }],
  chair: ['chair', '木椅'],
  bedroomRug: ['bedroomRug', '卧室地毯'],
  workspaceRug: ['workspaceRug', '工作区地毯'],
  shower: ['shower', '淋浴间与花洒'],
  vanity: ['vanity', '洗手台'],
  roundMirror: ['roundMirror', '圆镜'],
  toilet: ['toilet', '马桶'],
  towel: ['towel', '毛巾与毛巾架'],
  fridge: ['fridge', '冰箱'],
  kitchenCabinets: ['kitchenCabinets', '厨房吊柜'],
  kitchenCounter: ['kitchenCounter', '厨房台柜、灶台与水槽'],
  tableStools: ['tableStools', '餐桌与两只凳子'],
  potRack: ['potRack', '锅具挂架'],
  spiceShelf: ['spiceShelf', '调料架'],
  kitchenPlant: ['kitchenPlant:spring', '厨房盆栽', { options: { season: [...SEASONS] } }],
  catBowl: ['catBowl:3', '猫粮碗', { options: { bowl: [0, 1, 2, 3] } }],
  dogBowl: ['dogBowl:3', '狗粮碗', { options: { dogBowl: [0, 1, 2, 3] } }],
  dogBed: ['dogBed', '狗窝'],
  package: ['package', '快递箱'],
  exteriorDoor: ['exteriorDoor', '户外木门'],
  ac: ['ac', '空调', { seasonal: 'summer' }],
  fan: ['fan', '风扇', { seasonal: 'summer' }],
  kitchenFan: ['kitchenFan', '厨房小风扇', { seasonal: 'summer' }],
  heater: ['heater', '暖气片', { seasonal: 'winter' }],
  humidifier: ['humidifier', '加湿器', { seasonal: 'winter' }],
  kettle: ['kettle', '保温壶', { seasonal: 'winter' }],
  'collectible-figurine': ['collectible-figurine', '金色小雕像'],
  'collectible-mug': ['collectible-mug', '彩色杯子'],
  'collectible-painting': ['collectible-painting', '蓝色挂画'],
  'collectible-plant': ['collectible-plant', '桌面小盆栽'],
  'collectible-vase': ['collectible-vase', '小花瓶'],
  human: ['human:stand', '人物（站立）', { options: { reaction: ['stand', 'wave0', 'wave1', 'wave2', 'nod0', 'nod1', 'startle', 'lookback', 'lookup'], shower: 'boolean' } }],
  cat: ['cat:idle', '橘猫（静态）', { options: { mood: ['idle', 'pet1', 'pet2', 'pet3', 'pet4', 'walkaway'] } }],
  dog: ['dog:sit', '腊肠狗（坐姿）', { options: { mood: ['sit', 'bark'] } }]
};

function variantKeys(id) {
  if (id === 'human') return ['human:stand', 'human:wave0', 'human:wave1', 'human:wave2', 'human:nod0', 'human:nod1', 'human:startle', 'human:lookback', 'human:lookup', 'human:shower'];
  if (id === 'cat') return ['cat:idle', 'cat:pet1', 'cat:pet2', 'cat:pet3', 'cat:pet4', 'cat:walkaway'];
  if (id === 'dog') return ['dog:sit', 'dog:bark'];
  if (id === 'bed') return ['bed:cover', 'bed:made', 'bed:messy'];
  if (id === 'nightstand') return ['nightstand:off', 'nightstand:on'];
  if (id === 'desk') return Object.keys(SPRITES).filter(key => key.startsWith('desk:'));
  if (id === 'bookshelf' || id === 'kitchenPlant') return [...SEASONS].map(s => `${id}:${s}`);
  if (id === 'catBowl' || id === 'dogBowl') return [0, 1, 2, 3].map(n => `${id}:${n}`);
  if (id.startsWith('window-')) {
    return [...SEASONS].flatMap(s => [`${id}:${s}:day`, `${id}:${s}:night`]);
  }
  return [DEFINITIONS[id][0]];
}

export const ITEM_META = Object.freeze(Object.fromEntries(Object.entries(DEFINITIONS).map(([id, [baseKey, label, extra = {}]]) => {
  const variants = variantKeys(id).map(key => SPRITES[key]);
  return [id, Object.freeze({
    width: Math.max(...variants.map(v => v.width)),
    height: Math.max(...variants.map(v => v.height)),
    defaultWidth: SPRITES[baseKey].width,
    defaultHeight: SPRITES[baseKey].height,
    // Draw offset of the base variant; actor variants share one union box so poses never shift.
    anchorX: SPRITES[baseKey].anchorX ?? 0,
    anchorY: SPRITES[baseKey].anchorY ?? 0,
    label,
    ...extra
  })];
})));

/**
 * Draw one extracted item with the top-left of its visible pixel bounding box at x/y.
 * Coordinates are logical pixels; callers choose their own display scaling.
 */
export function drawItem(ctx, id, x, y, options = {}) {
  if (!ctx || typeof ctx.fillRect !== 'function') throw new TypeError('drawItem requires a CanvasRenderingContext2D-like context');
  if (!ITEM_META[id]) throw new RangeError(`Unknown Pixel Room item id: ${id}`);
  const sprite = SPRITES[resolveVariant(id, options)];
  if (!sprite) throw new RangeError(`Missing generated variant for Pixel Room item: ${id}`);

  ctx.save();
  ctx.translate(x, y);
  const inheritedAlpha = Number.isFinite(ctx.globalAlpha) ? ctx.globalAlpha : 1;
  if ('imageSmoothingEnabled' in ctx) ctx.imageSmoothingEnabled = false;
  for (const command of sprite.commands) drawCommand(ctx, command, inheritedAlpha);
  ctx.restore();
  return { width: sprite.width, height: sprite.height };
}

export function getItemMeta(id, options = {}) {
  if (!ITEM_META[id]) return null;
  const sprite = SPRITES[resolveVariant(id, options)];
  return Object.freeze({ ...ITEM_META[id], width: sprite.width, height: sprite.height });
}

export const ITEM_IDS = Object.freeze(Object.keys(ITEM_META));

export function resolveItemVariant(id, options = {}) {
  if (!ITEM_META[id]) throw new RangeError(`Unknown Pixel Room item id: ${id}`);
  return resolveVariant(id, options);
}

function resolveVariant(id, options) {
  const season = SEASONS.has(options.season) ? options.season : 'spring';
  if (id === 'human') return options.shower ? 'human:shower' : `human:${options.reaction || 'stand'}`;
  if (id === 'cat') return `cat:${options.mood || 'idle'}`;
  if (id === 'dog') return `dog:${options.mood || 'sit'}`;
  if (id === 'bed') {
    const blanket = ['cover', 'made', 'messy'].includes(options.blanket) ? options.blanket : 'cover';
    return `bed:${blanket}`;
  }
  if (id === 'nightstand') return `nightstand:${options.lampOn ? 'on' : 'off'}`;
  if (id === 'desk') return `desk:${options.lampOn ? 'on' : 'off'}:${clampInt(options.cup, 0, 4, 4)}`;
  if (id === 'bookshelf' || id === 'kitchenPlant') return `${id}:${season}`;
  if (id === 'catBowl') return `catBowl:${clampInt(options.bowl, 0, 3, 3)}`;
  if (id === 'dogBowl') return `dogBowl:${clampInt(options.dogBowl, 0, 3, 3)}`;
  if (id.startsWith('window-')) return `${id}:${season}:${options.night ? 'night' : 'day'}`;
  return DEFINITIONS[id][0];
}

function clampInt(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
}

function drawCommand(ctx, command, inheritedAlpha) {
  const type = command[0];
  const alpha = command[type === 'r' ? 6 : 3];
  const style = command[type === 'r' ? 5 : 2];
  ctx.globalAlpha = inheritedAlpha * (Number.isFinite(alpha) ? alpha : 1);
  ctx.fillStyle = materializeStyle(ctx, style);
  if (type === 'r') {
    ctx.fillRect(command[1], command[2], command[3], command[4]);
    return;
  }
  ctx.beginPath();
  command[1].forEach(([px, py], index) => index ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
  ctx.closePath();
  ctx.fill();
}

function materializeStyle(ctx, style) {
  if (!style || typeof style === 'string') return style || '#000';
  const gradient = ctx.createLinearGradient(...style.a);
  style.s.forEach(([offset, color]) => gradient.addColorStop(offset, color));
  return gradient;
}
