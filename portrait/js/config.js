export const CONFIG = Object.freeze({
  width: 216,
  height: 450,
  pixel: 4,
  storageKey: 'pixel-room-portrait-save-v1',
  actorStorageKey: 'pixel-room-portrait-actor-v1',
  lifeStorageKey: 'pixel-room-portrait-life-v1',
  worldStorageKey: 'pixel-room-portrait-world-v1',
  letterStorageKey: 'pixel-room-portrait-letters-v1',
  stage: 'S6'
});
export const SEASONS = Object.freeze({ spring: '春', summer: '夏', autumn: '秋', winter: '冬' });
export const ROOMS = Object.freeze([
  { id: 'bedroom', name: '卧室', floor: 2, x: 10, y: 65, w: 160, h: 85, base: 150, warm: true },
  { id: 'workspace', name: '工作区', floor: 1, x: 10, y: 162, w: 90, h: 86, base: 248, warm: false },
  { id: 'bathroom', name: '卫生间', floor: 1, x: 104, y: 162, w: 66, h: 86, base: 248, warm: false },
  { id: 'kitchen', name: '厨房', floor: 0, x: 10, y: 260, w: 160, h: 86, base: 346, warm: true }
]);

// Floor portals are shared by the route graph and future action adapters.
export const PORTALS = Object.freeze([
  { id: 'bedroom.stairs', floor: 2, x: 173, y: 150 },
  { id: 'workspace.door', floor: 1, x: 100, y: 248 },
  { id: 'bathroom.door', floor: 1, x: 170, y: 248 },
  { id: 'middle.stairs', floor: 1, x: 173, y: 248 },
  { id: 'kitchen.stairs', floor: 0, x: 173, y: 346 }
]);

// Garden geometry shared by rendering, navigation, and autonomous life.
export const GARDEN = Object.freeze({ groundY:365, pathY:419, swingX:78, swingY:419 });
