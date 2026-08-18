/* ============================================================
 * storage.js —— localStorage 存档（无需注册）
 * ============================================================ */
(function () {
  'use strict';
  const P = window.PixelRoom; if (!P) return;
  const C = P.Config;

  const DEFAULTS = {
    v: 1,
    lamps: { ceiling: [false, false, false, false], deskLamp: false, nightLamp: false, touched: false, touchedDate: '' },
    sound: false,          // 默认静音
    volume: 60,
    petTotal: 0,
    petDay: '',            // yyyy-mm-dd
    petToday: 0,
    settings: { particles: true, stars: true, anim: true },
    catSeed: (Math.random() * 5) | 0,
    dogSeed: (Math.random() * 3) | 0,   // 腊肠狗毛色（0 棕 / 1 黑 / 2 奶油）
    // ---- 物品动态变化（按日期记录，跨天自动更新）----
    items: {
      date: '',             // 最近一次跨天更新日期 yyyy-mm-dd
      cup: 0,               // 咖啡杯液面 0-4（工作前满杯）
      blanket: 'cover',     // 被子：cover 睡觉盖身 / made 睡前铺好 / messy 白天乱糟糟
      bowl: 3,              // 猫粮碗 0-3（3=满）
      dogBowl: 3,           // 狗粮碗 0-3（3=满）
      dishes: 0,            // 水槽里的碗 0/1
      collectibles: [],     // 已拆出的快递小物件（最多 5 种）
      pkg: { state: 'none', date: '', openIn: 0, item: null, cooldown: 0 } // 快递箱 none/arrived；opened 为旧存档迁移态
    }
  };

  const PKG_ITEM_IDS = ['figurine', 'mug', 'painting', 'plant', 'vase'];

  let state = JSON.parse(JSON.stringify(DEFAULTS));
  let saveTimer = null;

  function merge(base, saved) {
    if (!saved || typeof saved !== 'object') return base;
    const out = JSON.parse(JSON.stringify(base));
    for (const k in saved) {
      if (k === 'settings' || k === 'lamps') {
        out[k] = Object.assign({}, out[k], saved[k]);
      } else if (k === 'items') {
        out[k] = Object.assign({}, out[k], saved[k] || {});
        out[k].pkg = Object.assign({}, out[k].pkg, (saved[k] && saved[k].pkg) || {});
      } else if (saved[k] !== undefined && saved[k] !== null) {
        out[k] = saved[k];
      }
    }
    return out;
  }

  function dateKey(tp) { return tp.year + '-' + tp.month + '-' + tp.day; }

  function dayNumber(key) {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(key || '');
    return m ? Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000) : null;
  }

  function addCollectible(items, id) {
    if (!id || PKG_ITEM_IDS.indexOf(id) < 0) return;
    if (!Array.isArray(items.collectibles)) items.collectibles = [];
    if (items.collectibles.indexOf(id) < 0) items.collectibles.push(id);
  }

  function openPackage(items, pkg) {
    const remaining = PKG_ITEM_IDS.filter(function (id) { return items.collectibles.indexOf(id) < 0; });
    const pool = remaining.length ? remaining : PKG_ITEM_IDS;
    addCollectible(items, pool[(Math.random() * pool.length) | 0]);
    pkg.state = 'none';
    pkg.date = '';
    pkg.openIn = 0;
    pkg.item = null;
    pkg.cooldown = 2; // 拆开后至少隔两天再出现下一件
  }

  function save(immediate) {
    if (saveTimer) clearTimeout(saveTimer);
    const doSave = function () {
      try { localStorage.setItem(C.STORAGE_KEY, JSON.stringify(state)); } catch (e) { console.warn(e); }
    };
    if (immediate) doSave(); else saveTimer = setTimeout(doSave, 400);
  }

  // 跨天更新：猫粮续满 / 快递箱出现与拆开；按真实经过天数逐日推进
  function ensureDaily() {
    const tp = P.Time.now();
    const today = dateKey(tp);
    const items = state.items;
    if (items.date === today) return;
    if (!Array.isArray(items.collectibles)) items.collectibles = [];
    const previousDay = dayNumber(items.date);
    const currentDay = dayNumber(today);
    const elapsedDays = previousDay === null || currentDay === null ? 1 : Math.max(1, Math.min(3650, currentDay - previousDay));
    // 猫粮碗/狗粮碗：第二天早上自动续满
    items.bowl = 3;
    items.dogBowl = 3;
    // 兼容旧存档：过去的 opened/item 转成永久小物件，再进入下一轮快递周期。
    const pkg = items.pkg;
    if (pkg.state === 'opened') {
      addCollectible(items, pkg.item);
      pkg.state = 'none';
      pkg.item = null;
      pkg.cooldown = 2;
    }
    for (let day = 0; day < elapsedDays; day++) {
      if (pkg.state === 'arrived') {
        pkg.openIn = Math.max(0, Number(pkg.openIn) || 0) - 1;
        if (pkg.openIn <= 0) openPackage(items, pkg);
      } else if ((pkg.cooldown || 0) > 0) {
        pkg.cooldown--;
      } else if (Math.random() < 0.29) {
        pkg.state = 'arrived';
        pkg.date = today;
        pkg.openIn = 1 + ((Math.random() * 3) | 0); // 后续 1-3 个跨日更新后拆开
      }
    }
    items.date = today;
    save();
  }

  // 按当前时刻刷新时变物品（咖啡杯/被子/水槽碗），写入存档保持跨页一致
  function syncItems() {
    const tp = P.Time.now();
    const items = state.items;
    const h = tp.hour;
    // 咖啡杯：工作前满杯 → 工作期间逐渐减少 → 下午见底 → 洗漱时洗掉 → 次日重新满杯
    let cup = 0;
    if (h >= 8.5 && h < 12) cup = Math.max(0, Math.round(4 - (h - 8.5) / 3.5 * 2));
    else if (h >= 12 && h < 13) cup = 2;
    else if (h >= 13 && h < 17.5) cup = Math.max(0, Math.round(2 - (h - 13) / 4.5 * 2));
    // 被子：睡觉盖身 / 睡前铺好 / 白天乱糟糟
    let blanket = 'messy';
    if (h >= 22.5 || h < 7.5) blanket = 'cover';
    else if (h >= 21.5 && h < 22.5) blanket = 'made';
    // 水槽里的碗：早餐后出现，下次洗漱（22:00）洗掉
    const dishes = (h >= 8.5 && h < 22) ? 1 : 0;
    if (items.cup !== cup || items.blanket !== blanket || items.dishes !== dishes) {
      items.cup = cup;
      items.blanket = blanket;
      items.dishes = dishes;
      save();
    }
  }

  P.Storage = {
    state: state,
    load() {
      try {
        const raw = localStorage.getItem(C.STORAGE_KEY);
        if (raw) {
          state = merge(DEFAULTS, JSON.parse(raw));
          P.Storage.state = state; // 同步引用，保证外部读到的与内部一致
        }
      } catch (e) { console.warn('load save failed', e); }
      // 跨天重置今日摸猫次数
      if (P.Time) {
        const tp = P.Time.now();
        const dayKey = tp.year + '-' + tp.month + '-' + tp.day;
        if (state.petDay !== dayKey) { state.petDay = dayKey; state.petToday = 0; }
        // v1 旧存档只有 touched 布尔值：把它迁移成“仅当天有效”的手动灯光覆盖。
        if (state.lamps.touched && !state.lamps.touchedDate) state.lamps.touchedDate = dayKey;
      }
      return state;
    },
    save: save,
    reset() {
      state = JSON.parse(JSON.stringify(DEFAULTS));
      P.Storage.state = state;
      try { localStorage.removeItem(C.STORAGE_KEY); } catch (e) { /* ignore */ }
      return state;
    },
    ensureDaily: ensureDaily,
    syncItems: syncItems
  };
})();
