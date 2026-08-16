/* ============================================================
 * config.js —— 全局配置常量 + 极简事件总线
 * ============================================================ */
(function () {
  'use strict';
  const P = window.PixelRoom = window.PixelRoom || {};

  // ---- 极简事件总线 ----
  P.Events = (function () {
    const map = {};
    return {
      on(evt, fn) {
        (map[evt] = map[evt] || []).push(fn);
        return function () { map[evt] = (map[evt] || []).filter(function (f) { return f !== fn; }); };
      },
      emit(evt, data) {
        (map[evt] || []).slice().forEach(function (fn) {
          try { fn(data); } catch (e) { console.error('[events]', evt, e); }
        });
      }
    };
  })();

  P.Config = {
    // ---- 渲染 ----
    CANVAS_W: 1280,           // 画布物理宽
    CANVAS_H: 720,            // 画布物理高
    PIXEL: 4,                 // 一个逻辑像素 = 4 显示像素
    LOGICAL_W: 320,           // 逻辑宽
    LOGICAL_H: 180,           // 逻辑高

    // ---- 时区 ----
    TIMEZONE_OFFSET_MIN: 480, // 东八区 UTC+8

    // ---- 房间 ----
    ROOM_WIDTH: 80,           // 每间房逻辑宽
    ROOM_COUNT: 4,
    SKY_H: 36,                // 顶部露天天空带
    CEILING_Y: 40,            // 天花板下沿
    FLOOR_Y: 128,             // 室内地板
    GROUND_Y: 180,            // 画布底
    DOOR_Y: 92,               // 门洞顶部

    ROOM_NAMES: ['卧室', '工作区', '卫生间', '厨房'],
    ROOM_IDS: ['bedroom', 'workspace', 'bathroom', 'kitchen'],

    // ---- 作息（东八区小时，浮点） ----
    SCHEDULE: [
      { id: 'sleep',     name: '睡觉', from: 0,    to: 7.5 },
      { id: 'wash',      name: '洗漱', from: 7.5,  to: 8 },
      { id: 'breakfast', name: '早餐', from: 8,    to: 8.5 },
      { id: 'work',      name: '工作', from: 8.5,  to: 12 },
      { id: 'lunch',     name: '午餐', from: 12,   to: 13 },
      { id: 'work',      name: '工作', from: 13,   to: 18 },
      { id: 'dinner',    name: '晚餐', from: 18,   to: 19 },
      { id: 'leisure',   name: '休闲', from: 19,   to: 22 },
      { id: 'wash',      name: '洗漱', from: 22,   to: 22.5 },
      { id: 'sleep',     name: '睡觉', from: 22.5, to: 24 }
    ],

    // ---- 电脑屏幕内容 ----
    SCREEN_MODES: ['coding', 'video', 'chat', 'slacking', 'art'],
    SCREEN_MODE_NAMES: { coding: '写代码', video: '看视频', chat: '聊天', slacking: '摸鱼', art: '画画' },

    // ---- 存档 ----
    STORAGE_KEY: 'pixel-room-save-v1',

    // ---- 北京天气 ----
    WEATHER_API: 'https://api.open-meteo.com/v1/forecast?latitude=39.9042&longitude=116.4074&current=temperature_2m,weather_code,precipitation,wind_speed_10m&timezone=Asia%2FShanghai',
    WEATHER_REFRESH_MS: 30 * 60 * 1000,
    WEATHER_FALLBACK: { rainP: 0.13, snowP: 0.11 },

    // ---- 调色板 ----
    COLORS: {
      skyNightTop: '#070b20', skyNightMid: '#0e1433', skyNightBot: '#1b2347',
      skyDawnMid: '#8a4a86', skyDawnBot: '#ff9d6e',
      skyDayTop: '#2f7bd6', skyDayMid: '#7cc0f5', skyDayBot: '#d9ecff',
      sun: '#ffe9a8', sunCore: '#fff6d8',
      moon: '#e8ecf8', moonDark: '#b9c0d8',
      cloud: '#d7dde8',
      wall: ['#e8d5bd', '#ccd8e2', '#bcdcd6', '#ece0bd'],
      wallDark: ['#d8c2a6', '#bcc8d4', '#a8ccc4', '#dccfa8'],
      floorWood: '#b98a5a', floorWoodDark: '#a27848',
      floorTile: '#c8d2d0', floorTileDark: '#b4c0be',
      baseboard: '#8a6a4a',
      lampWarm: '#ffd98a'
    }
  };
})();
