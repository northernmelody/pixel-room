/* ============================================================
 * storage.js —— localStorage 存档（无需注册）
 * ============================================================ */
(function () {
  'use strict';
  const P = window.PixelRoom; if (!P) return;
  const C = P.Config;

  const DEFAULTS = {
    v: 1,
    lamps: { ceiling: [false, false, false, false], deskLamp: false, nightLamp: false, touched: false },
    sound: false,          // 默认静音
    volume: 60,
    petTotal: 0,
    petDay: '',            // yyyy-mm-dd
    petToday: 0,
    settings: { particles: true, stars: true, anim: true },
    catSeed: (Math.random() * 5) | 0,
    // ---- 物品动态变化（按日期记录，跨天自动更新）----
    items: {
      date: '',             // 最近一次跨天更新日期 yyyy-mm-dd
      cup: 0,               // 咖啡杯液面 0-4（工作前满杯）
      blanket: 'cover',     // 被子：cover 睡觉盖身 / made 睡前铺好 / messy 白天乱糟糟
      bowl: 3,              // 猫粮碗 0-3（3=满）
      dishes: 0,            // 水槽里的碗 0/1
      pkg: { state: 'none', date: '', openIn: 0, item: null } // 快递箱 none/arrived/opened
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

  function save(immediate) {
    if (saveTimer) clearTimeout(saveTimer);
    const doSave = function () {
      try { localStorage.setItem(C.STORAGE_KEY, JSON.stringify(state)); } catch (e) { console.warn(e); }
    };
    if (immediate) doSave(); else saveTimer = setTimeout(doSave, 400);
  }

  // 跨天更新：猫粮续满 / 快递箱出现与拆开（每日低概率）
  function ensureDaily() {
    const tp = P.Time.now();
    const today = dateKey(tp);
    const items = state.items;
    if (items.date === today) return;
    // 猫粮碗：第二天早上自动续满
    items.bowl = 3;
    // 快递箱：偶尔出现（平均每周 1-2 次），几天后被拆开
    const pkg = items.pkg;
    if (pkg.state === 'none') {
      if (Math.random() < 0.29) {
        pkg.state = 'arrived';
        pkg.date = today;
        pkg.openIn = 1 + ((Math.random() * 3) | 0); // 1-3 天后拆开
      }
    } else if (pkg.state === 'arrived') {
      pkg.openIn = (pkg.openIn || 1) - 1;
      if (pkg.openIn <= 0) {
        pkg.state = 'opened';
        pkg.item = PKG_ITEM_IDS[(Math.random() * PKG_ITEM_IDS.length) | 0];
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
