/* ============================================================
 * weatherSystem.js —— 北京天气获取与解析（无网络时低概率兜底）
 * ============================================================ */
(function () {
  'use strict';
  const P = window.PixelRoom; if (!P) return;
  const C = P.Config;

  const COND = {
    clear:  { key: 'clear',  name: '晴', emoji: '☀️', cloud: 0,    rain: 0,   snow: 0, dim: 1    },
    partly: { key: 'partly', name: '多云', emoji: '⛅', cloud: 0.45, rain: 0,   snow: 0, dim: 0.92 },
    cloudy: { key: 'cloudy', name: '阴', emoji: '☁️', cloud: 0.85, rain: 0,   snow: 0, dim: 0.84 },
    fog:    { key: 'fog',    name: '雾', emoji: '🌫️', cloud: 0.95, rain: 0,   snow: 0, dim: 0.78 },
    rain:   { key: 'rain',   name: '雨', emoji: '🌧️', cloud: 1,    rain: 1,   snow: 0, dim: 0.72 },
    snow:   { key: 'snow',   name: '雪', emoji: '❄️', cloud: 1,    rain: 0,   snow: 1, dim: 0.78 },
    storm:  { key: 'storm',  name: '雷雨', emoji: '⛈️', cloud: 1,   rain: 1.4, snow: 0, dim: 0.6  }
  };

  let current = null;
  let lastTry = 0;
  let failedAt = 0;   // 上次拉取失败时间（失败后 5 分钟内不重试）

  function codeToCond(code) {
    if (code === 0) return 'clear';
    if (code === 1 || code === 2) return 'partly';
    if (code === 3) return 'cloudy';
    if (code === 45 || code === 48) return 'fog';
    if (code === 95 || code === 96 || code === 99) return 'storm';
    if (code === 51 || code === 53 || code === 55 || code === 56 || code === 57 ||
        code === 61 || code === 63 || code === 65 || code === 66 || code === 67 ||
        code === 80 || code === 81 || code === 82) return 'rain';
    if (code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86) return 'snow';
    return 'partly';
  }

  // 按日期生成的 32 位混合散列：均匀分布、连续日期不聚集。
  // 旧实现用线性同余 ((seed*9301+49297)%233280)，会在某些日期段连续多天落入雨区，
  // 造成"打开页面就下雨"的观感（如 2026-08-18~21 连雨 4 天）。
  function dayHash(seed) {
    let h = (seed | 0) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // 无网络兜底：按日期种子，低概率雨/雪（冬季雪概率更高）
  function fallback() {
    const tp = P.Time.now();
    const seed = tp.year * 10000 + tp.month * 100 + tp.day;
    const r1 = dayHash(seed);
    const r2 = dayHash(seed + 0x517cc1b7);
    const s = P.Time.season(tp);
    const rainP = s.id === 'summer' ? 0.18 : C.WEATHER_FALLBACK.rainP;
    const snowP = s.id === 'winter' ? 0.22 : C.WEATHER_FALLBACK.snowP;
    let key = 'clear';
    if (r1 < rainP) key = 'rain';
    else if (r1 < rainP + snowP) key = 'snow';
    else if (r2 < 0.3) key = 'partly';
    else if (r2 < 0.45) key = 'cloudy';
    const baseTemp = s.id === 'winter' ? 2 : s.id === 'summer' ? 28 : 18;
    return {
      condition: COND[key],
      temp: baseTemp + Math.round((r2 - 0.5) * 10),
      wind: 5 + Math.round(r1 * 8),
      precip: COND[key].rain > 0 ? 0.5 : 0,
      source: 'fallback'
    };
  }

  // 初始占位：API 结果到达前的确定性中性天气（永不降水）。
  // 保证"打开页面不会默认下雨"；真实天气到达后或 API 失败后才会切换。
  function placeholder() {
    const tp = P.Time.now();
    const seed = tp.year * 10000 + tp.month * 100 + tp.day;
    const r = dayHash(seed + 0x10000);
    let key;
    if (r < 0.5) key = 'clear';
    else if (r < 0.78) key = 'partly';
    else if (r < 0.95) key = 'cloudy';
    else key = 'fog';
    const s = P.Time.season(tp);
    const baseTemp = s.id === 'winter' ? 2 : s.id === 'summer' ? 28 : 18;
    return {
      condition: COND[key],
      temp: baseTemp + Math.round((dayHash(seed + 0x20000) - 0.5) * 10),
      wind: 5 + Math.round(dayHash(seed + 0x30000) * 8),
      precip: 0,
      source: 'placeholder'
    };
  }

  async function fetchWeather() {
    if (Date.now() - lastTry < 15000) return;
    lastTry = Date.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(function () { ctrl.abort(); }, 7000);
      const res = await fetch(C.WEATHER_API, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error('http ' + res.status);
      const data = await res.json();
      const cur = data.current || {};
      const key = codeToCond(cur.weather_code);
      current = {
        condition: COND[key],
        temp: cur.temperature_2m != null ? Math.round(cur.temperature_2m) : 18,
        wind: cur.wind_speed_10m != null ? Math.round(cur.wind_speed_10m) : 5,
        precip: cur.precipitation != null ? cur.precipitation : 0,
        source: 'api'
      };
    } catch (e) {
      current = fallback();
      failedAt = Date.now();
    }
    P.Events.emit('weather-change', current);
  }

  P.Weather = {
    get() {
      if (!current) current = placeholder();
      return current;
    },
    isRain() {
      const k = P.Weather.get().condition.key;
      return k === 'rain' || k === 'storm';
    },
    isSnow() {
      return P.Weather.get().condition.key === 'snow';
    },
    intensity() {
      const k = P.Weather.get().condition.key;
      if (k === 'storm') return 1;
      if (k === 'rain' || k === 'snow') return 0.55 + (P.Weather.get().precip > 1 ? 0.35 : 0);
      return 0;
    },
    async refresh() {
      // 首次 / 每 30 分钟 / 上次失败已过 5 分钟时重新拉取
      const canRetry = current ? (current.source === 'fallback' ? Date.now() - failedAt > 5 * 60 * 1000 : Date.now() - lastTry > C.WEATHER_REFRESH_MS) : true;
      if (canRetry) {
        await fetchWeather();
      }
    }
  };
})();
