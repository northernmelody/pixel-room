/* ============================================================
 * timeSystem.js —— 东八区时间 / 季节 / 作息 / 天体位置
 * ============================================================ */
(function () {
  'use strict';
  const P = window.PixelRoom; if (!P) return;
  const C = P.Config;

  const WEEK_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  // 调试：?t=HH:MM 可固定模拟东八区时间（用于预览不同时段）
  let debug = null;
  try {
    const m = /[?&]t=([\d:.]+)/.exec(location.search);
    if (m) {
      const sp = m[1].split(':');
      const hh = Number(sp[0]) || 0;
      const mm = sp[1] ? Number(sp[1]) : 0;
      const ss = sp[2] ? Number(sp[2]) : 0;
      debug = { start: Date.now(), hour: hh + mm / 60 + ss / 3600 };
    }
  } catch (e) { /* ignore */ }

  // 东八区时间各部分
  function parts(date) {
    const d = new Date(date.getTime() + C.TIMEZONE_OFFSET_MIN * 60000);
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      weekday: d.getUTCDay(),
      hour: d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600,
      hourInt: d.getUTCHours(),
      min: d.getUTCMinutes(),
      sec: d.getUTCSeconds()
    };
  }

  function now() {
    const tp = parts(new Date());
    if (debug) {
      const h = (debug.hour + (Date.now() - debug.start) / 3600000) % 24;
      const hi = Math.floor(h);
      const mi = Math.floor((h - hi) * 60);
      const si = Math.floor(((h - hi) * 60 - mi) * 60);
      tp.hour = h; tp.hourInt = hi; tp.min = mi; tp.sec = si;
    }
    return tp;
  }

  // 访问者本地时间（仅用于 UI 显示）
  function localParts(date) {
    const d = new Date(date);
    return {
      hourInt: d.getHours(),
      min: d.getMinutes(),
      sec: d.getSeconds(),
      tzMin: -d.getTimezoneOffset()
    };
  }

  // 季节：0 春 … 3 冬
  function season(tp) {
    const m = tp.month;
    if (m >= 3 && m <= 5) return { id: 'spring', k: (m - 3 + tp.day / 31) / 3, name: '春' };
    if (m >= 6 && m <= 8) return { id: 'summer', k: (m - 6 + tp.day / 31) / 3, name: '夏' };
    if (m >= 9 && m <= 11) return { id: 'autumn', k: (m - 9 + tp.day / 31) / 3, name: '秋' };
    return { id: 'winter', k: (m - 12 + tp.day / 31) / 3 + (m < 3 ? 1 : 0), name: '冬' };
  }

  // 是否自由职业日：周末固定；工作日按日期种子随机
  function isFreelance(tp) {
    if (tp.weekday === 0 || tp.weekday === 6) return true;
    const seed = tp.year * 10000 + tp.month * 100 + tp.day;
    const h = (seed * 9301 + 49297) % 233280;
    return (h % 10) < 4; // 40% 自由职业
  }

  function getSchedule(tp) {
    const h = tp.hour;
    for (let i = 0; i < C.SCHEDULE.length; i++) {
      const s = C.SCHEDULE[i];
      if (h >= s.from && h < s.to) return s;
    }
    return C.SCHEDULE[C.SCHEDULE.length - 1];
  }

  // 日出/日落（按季节）
  function dayLength(seasonId) {
    const map = { spring: [6.0, 18.2], summer: [5.2, 19.4], autumn: [6.2, 18.0], winter: [6.8, 17.2] };
    return map[seasonId] || [6, 18];
  }

  // 天体：太阳/月亮高度角
  function astro(tp, seasonId) {
    const dl = dayLength(seasonId);
    const rise = dl[0], set = dl[1];
    const h = tp.hour;
    let sunElev = 0, sunT = 0, moonElev = 0, moonT = 0;
    if (h >= rise && h <= set) {
      sunT = (h - rise) / (set - rise);
      sunElev = Math.sin(Math.PI * sunT);
    } else {
      const nightLen = 24 - set + rise;
      moonT = ((h - set + 24) % 24) / nightLen;
      moonElev = Math.sin(Math.PI * moonT);
      // 太阳在地平线以下：负高度（用于暮光/夜色计算）
      sunElev = -Math.sin(Math.PI * moonT);
    }
    return { rise: rise, set: set, sunT: sunT, sunElev: sunElev, moonT: moonT, moonElev: moonElev, night: sunElev <= 0 };
  }

  P.Time = {
    parts: parts,
    now: now,
    localParts: localParts,
    season: season,
    isFreelance: isFreelance,
    getSchedule: getSchedule,
    astro: astro,
    WEEK_CN: WEEK_CN
  };
})();
