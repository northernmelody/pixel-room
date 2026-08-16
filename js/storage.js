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
    catSeed: (Math.random() * 5) | 0
  };

  let state = JSON.parse(JSON.stringify(DEFAULTS));
  let saveTimer = null;

  function merge(base, saved) {
    if (!saved || typeof saved !== 'object') return base;
    const out = JSON.parse(JSON.stringify(base));
    for (const k in saved) {
      if (k === 'settings' || k === 'lamps') {
        out[k] = Object.assign({}, out[k], saved[k]);
      } else if (saved[k] !== undefined && saved[k] !== null) {
        out[k] = saved[k];
      }
    }
    return out;
  }

  P.Storage = {
    state: state,
    load() {
      try {
        const raw = localStorage.getItem(C.STORAGE_KEY);
        if (raw) state = merge(DEFAULTS, JSON.parse(raw));
      } catch (e) { console.warn('load save failed', e); }
      // 跨天重置今日摸猫次数
      if (P.Time) {
        const tp = P.Time.now();
        const dayKey = tp.year + '-' + tp.month + '-' + tp.day;
        if (state.petDay !== dayKey) { state.petDay = dayKey; state.petToday = 0; }
      }
      return state;
    },
    save(immediate) {
      if (saveTimer) clearTimeout(saveTimer);
      const doSave = function () {
        try { localStorage.setItem(C.STORAGE_KEY, JSON.stringify(state)); } catch (e) { console.warn(e); }
      };
      if (immediate) doSave(); else saveTimer = setTimeout(doSave, 400);
    },
    reset() {
      state = JSON.parse(JSON.stringify(DEFAULTS));
      try { localStorage.removeItem(C.STORAGE_KEY); } catch (e) { /* ignore */ }
      return state;
    }
  };
})();
