/* ============================================================
 * cat.js —— 猫状态机与动画（独立行为系统）
 * ============================================================ */
(function () {
  'use strict';
  const P = window.PixelRoom; if (!P) return;
  const C = P.Config;
  const FLOOR = C.FLOOR_Y, W = C.LOGICAL_W;

  const PALETTES = [
    { body: '#e89a4a', stripe: '#c47a2e', belly: '#f7d9a8', dark: '#a0601f' }, // 橘猫
    { body: '#9aa4b0', stripe: '#7c8794', belly: '#d8dee8', dark: '#5c6672' }, // 灰猫
    { body: '#e8d2a0', stripe: '#c8ae72', belly: '#fdf0d0', dark: '#a88e52' }, // 奶油
    { body: '#b0a0c8', stripe: '#8f7fa8', belly: '#e4dcf0', dark: '#6e5f88' }, // 紫灰
    { body: '#c8908a', stripe: '#a87068', belly: '#f0dcd8', dark: '#8a5850' }  // 玳瑁
  ];

  let cat = null;

  function init() {
    const seed = P.Storage.state.catSeed || 0;
    cat = {
      x: 60, dir: -1, palette: PALETTES[seed % PALETTES.length],
      state: 'idle', stateT: 0, dur: 2,
      animT: Math.random() * 10,
      moodT: 0, target: null,
      onDesk: false, deskY: FLOOR,
      zoomDir: 1
    };
  }

  function pickState() {
    let rubW = 9;
    const p = P.Character.pos();
    const nearPerson = Math.abs(cat.x - p.x) < 30;
    if (nearPerson) rubW = 34;
    const total = 26 + 18 + 20 + 12 + 7 + 8 + rubW;
    let roll = Math.random() * total;
    if ((roll -= 26) <= 0) return 'wander';
    if ((roll -= 18) <= 0) return 'groom';
    if ((roll -= 20) <= 0) return 'sleep';
    if ((roll -= 12) <= 0) return 'idle';
    if ((roll -= 7) <= 0) return 'zoomies';
    if ((roll -= 8) <= 0) return 'desk';
    return 'rub';
  }

  function enter(state) {
    cat.state = state; cat.stateT = 0; cat.target = null;
    switch (state) {
      case 'idle': cat.dur = 1 + Math.random() * 2.5; break;
      case 'groom': cat.dur = 3 + Math.random() * 4; break;
      case 'sleep': cat.dur = 8 + Math.random() * 14; break;
      case 'zoomies': cat.dur = 0.8 + Math.random() * 1.2; cat.zoomDir = Math.random() < 0.5 ? -1 : 1; break;
      case 'desk': cat.dur = 4 + Math.random() * 6; break;
      case 'rub': cat.dur = 3 + Math.random() * 3; break;
      case 'wander': {
        cat.dur = 4 + Math.random() * 3;
        const p = P.Character.pos();
        const spots = [
          p.x + (Math.random() * 44 - 22),
          30 + Math.random() * 24,
          120 + Math.random() * 30,
          250 + Math.random() * 24
        ];
        cat.target = Math.max(8, Math.min(W - 8, spots[(Math.random() * spots.length) | 0]));
        break;
      }
    }
  }

  function update(dt) {
    if (!cat) return;
    cat.animT += dt;

    // 摸猫状态优先
    if (cat.moodT > 0) {
      cat.moodT -= dt;
      cat.state = 'happy';
      if (cat.moodT <= 0) {
        cat.state = 'idle'; cat.dur = 1.5; cat.stateT = 0; cat.target = null;
        if (P.Audio) P.Audio.purrStop();
      }
      return;
    }

    cat.stateT += dt;
    switch (cat.state) {
      case 'idle':
        if (cat.stateT > cat.dur) enter(pickState());
        break;
      case 'wander': {
        if (cat.target === null) { cat.target = pickWanderSpot(); cat.stateT = 0; }
        const dx = cat.target - cat.x;
        if (Math.abs(dx) < 1) {
          cat.target = null;
          enter('idle'); cat.dur = 1 + Math.random() * 2;
        } else {
          cat.x += Math.sign(dx) * Math.min(Math.abs(dx), 8 * dt);
          cat.dir = Math.sign(dx);
        }
        break;
      }
      case 'groom':
        if (cat.stateT > cat.dur) enter('idle');
        break;
      case 'sleep':
        if (cat.stateT > cat.dur) enter(pickState());
        break;
      case 'zoomies': {
        if (cat.stateT > cat.dur) { enter('idle'); cat.dur = 2 + Math.random() * 1.5; break; }
        cat.x += cat.zoomDir * 30 * dt;
        if (cat.x < 6) cat.zoomDir = 1;
        if (cat.x > W - 6) cat.zoomDir = -1;
        break;
      }
      case 'desk': {
        const deskTop = 106;
        if (!cat.onDesk) {
          const dx = 118 - cat.x;
          if (Math.abs(dx) < 2) {
            cat.onDesk = true; cat.deskY = deskTop; cat.stateT = 0; cat.x = 118;
          } else {
            cat.x += Math.sign(dx) * Math.min(Math.abs(dx), 8 * dt);
            cat.dir = Math.sign(dx);
          }
        } else if (cat.stateT > cat.dur) {
          cat.onDesk = false; cat.deskY = FLOOR;
          enter('idle'); cat.dur = 1.5;
        }
        break;
      }
      case 'rub': {
        const p = P.Character.pos();
        const tx = p.x + p.dir * 5;
        const dx = tx - cat.x;
        if (cat.target === null && Math.abs(dx) > 2) {
          cat.x += Math.sign(dx) * Math.min(Math.abs(dx), 9 * dt);
          cat.dir = Math.sign(dx);
        } else {
          cat.target = true;
          if (cat.stateT > cat.dur) { cat.target = null; enter('idle'); cat.dur = 1 + Math.random() * 2; }
        }
        break;
      }
      case 'happy':
        break;
    }
  }

  function pickWanderSpot() {
    const p = P.Character.pos();
    const spots = [
      p.x + (Math.random() * 44 - 22),
      30 + Math.random() * 24,
      120 + Math.random() * 30,
      250 + Math.random() * 24
    ];
    return Math.max(8, Math.min(W - 8, spots[(Math.random() * spots.length) | 0]));
  }

  // 摸猫
  function pet() {
    cat.moodT = 4; cat.state = 'happy'; cat.stateT = 0; cat.target = null; cat.onDesk = false; cat.deskY = FLOOR;
    if (P.Audio) P.Audio.purrStart();
    setTimeout(function () { if (P.Audio) P.Audio.purrStop(); }, 3000);
    if (Math.random() < 0.3) setTimeout(function () { if (P.Audio) P.Audio.meow(); }, 400 + Math.random() * 500);
    const st = P.Storage.state;
    st.petToday = (st.petToday || 0) + 1;
    st.petTotal = (st.petTotal || 0) + 1;
    P.Storage.save();
    P.Events.emit('cat-pet', { count: st.petToday });
  }

  function pos() {
    return { x: cat ? cat.x : 60, dir: cat ? cat.dir : -1 };
  }

  // ============================================================
  // 绘制
  // ============================================================
  function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

  function draw(ctx, st) {
    if (!cat) return;
    const c = cat;
    const t = c.animT;
    const pal = c.palette;
    const x = Math.round(c.x);
    const y = c.onDesk ? Math.round(c.deskY) : FLOOR;
    const d = c.dir;

    // 影子
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(x - 7, FLOOR - 1, 15, 2);

    switch (c.state) {
      case 'sleep': drawSleep(ctx, x, y, t, pal, d); break;
      case 'zoomies': drawZoom(ctx, x, y, t, pal, d); break;
      case 'groom': drawGroom(ctx, x, y, t, pal, d); break;
      case 'happy': drawHappy(ctx, x, y, t, pal, d); break;
      case 'desk': drawSit(ctx, x, y, t, pal, d); break;
      case 'rub': drawRub(ctx, x, y, t, pal, d); break;
      case 'wander': drawWalk(ctx, x, y, t, pal, d); break;
      default: drawSit(ctx, x, y, t, pal, d); break;
    }

    // 心情爱心
    if (c.moodT > 0) {
      const hx = x + 5 + Math.round(Math.sin(t * 3) * 1);
      const hy = y - 16 + Math.round(Math.sin(t * 5) * 1);
      ctx.fillStyle = '#ff6a8a';
      ctx.fillRect(hx, hy, 2, 2);
      ctx.fillRect(hx + 3, hy, 2, 2);
      ctx.fillRect(hx, hy + 1, 5, 1);
      ctx.fillRect(hx + 1, hy + 2, 3, 2);
      ctx.fillRect(hx + 2, hy + 3, 1, 1);
    }
  }

  function drawSit(ctx, x, y, t, pal, d) {
    // 坐姿（面朝 d）
    const hx = d > 0 ? 1 : -7;
    px(ctx, x - 3, y - 8, 6, 7, pal.body);       // 身体
    px(ctx, x - 2, y - 5, 2, 4, pal.belly);      // 肚皮
    px(ctx, x + hx, y - 12, 6, 5, pal.body);     // 头
    px(ctx, x + hx + 1, y - 11, 2, 2, pal.belly);
    px(ctx, x + hx + (d > 0 ? 4 : 1), y - 11, 1, 1, pal.dark); // 眼
    px(ctx, x + hx + 1, y - 13, 1, 1, pal.stripe); // 耳
    px(ctx, x + hx + 4, y - 13, 1, 1, pal.stripe);
    px(ctx, x - 1, y - 2, 2, 2, pal.body);       // 前爪
    px(ctx, x - 4, y - 6, 2, 2, pal.body);       // 尾巴
    px(ctx, x - 5, y - 7, 1, 1, pal.dark);
    // 条纹
    px(ctx, x - 1, y - 6, 2, 1, pal.stripe);
  }

  function drawWalk(ctx, x, y, t, pal, d) {
    const step = Math.sin(t * 14);
    px(ctx, x - 6, y - 5, 12, 4, pal.body);
    px(ctx, x - 4, y - 4, 4, 2, pal.belly);
    px(ctx, x - 4, y - 4, 3, 1, pal.stripe);
    // 头
    const hx = d > 0 ? 5 : -11;
    px(ctx, x + hx, y - 8, 6, 4, pal.body);
    px(ctx, x + hx + 1, y - 7, 2, 1, pal.belly);
    px(ctx, x + hx + (d > 0 ? 4 : 1), y - 8, 1, 1, pal.dark);
    px(ctx, x + hx + (d > 0 ? 1 : 4), y - 9, 1, 1, pal.stripe);
    px(ctx, x + hx + (d > 0 ? 4 : 1), y - 9, 1, 1, pal.stripe);
    // 腿
    const l1 = Math.round(step * 2), l2 = Math.round(-step * 2);
    px(ctx, x - 4, y - 3 + l1, 2, 3, pal.body);
    px(ctx, x + 2, y - 3 + l2, 2, 3, pal.body);
    // 尾巴
    const sway = Math.round(Math.sin(t * 10) * 2);
    px(ctx, x - 7, y - 5 + sway, 2, 2, pal.body);
    px(ctx, x - 8, y - 6 + sway, 1, 1, pal.dark);
  }

  function drawSleep(ctx, x, y, t, pal, d) {
    px(ctx, x - 5, y - 5, 10, 5, pal.body);      // 蜷缩
    px(ctx, x - 4, y - 4, 8, 3, pal.belly);
    px(ctx, x - 3, y - 4, 5, 1, pal.stripe);
    px(ctx, x + (d > 0 ? 5 : -8), y - 4, 4, 3, pal.body); // 头
    px(ctx, x + (d > 0 ? 6 : -7), y - 5, 1, 1, pal.stripe);
    px(ctx, x - 6, y - 3, 2, 2, pal.body);       // 尾巴环抱
    px(ctx, x - 6, y - 2, 3, 1, pal.dark);
    // zzz
    if (Math.floor(t * 1.5) % 2 === 0) {
      ctx.fillStyle = '#cfd6e8';
      px(ctx, x + 7, y - 10, 2, 1);
      px(ctx, x + 9, y - 12, 1, 1);
    }
  }

  function drawZoom(ctx, x, y, t, pal, d) {
    px(ctx, x - 8, y - 4, 16, 3, pal.body);      // 拉长身体
    px(ctx, x - 6, y - 4, 6, 1, pal.stripe);
    const hx = d > 0 ? 8 : -12;
    px(ctx, x + hx, y - 6, 4, 3, pal.body);      // 头前伸
    px(ctx, x + hx + (d > 0 ? 2 : 1), y - 6, 1, 1, pal.dark);
    // 腿快速交替
    const st = Math.sin(t * 30) > 0 ? 1 : 0;
    px(ctx, x - 6 + st * 2, y - 1, 1, 1, pal.body);
    px(ctx, x - 2 - st * 2, y - 1, 1, 1, pal.body);
    px(ctx, x + 2 + st * 2, y - 1, 1, 1, pal.body);
    px(ctx, x + 6 - st * 2, y - 1, 1, 1, pal.body);
    // 运动线
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    const off = (t * 20) % 3 | 0;
    px(ctx, x - (d > 0 ? 10 : -14) - off, y - 3, 2, 1);
    px(ctx, x - (d > 0 ? 13 : -17) - off, y - 1, 1, 1);
    px(ctx, x - (d > 0 ? 16 : -20) - off, y - 4, 1, 1);
  }

  function drawGroom(ctx, x, y, t, pal, d) {
    const bob = Math.sin(t * 6) > 0 ? 1 : 0;
    px(ctx, x - 3, y - 7, 6, 6, pal.body);
    px(ctx, x - 2, y - 4, 2, 3, pal.belly);
    const hx = d > 0 ? -5 : 1;
    px(ctx, x + hx, y - 11 + bob, 5, 5, pal.body); // 低头舔
    px(ctx, x + hx + 1, y - 10 + bob, 2, 2, pal.belly);
    px(ctx, x + hx + 1, y - 12 + bob, 1, 1, pal.stripe);
    px(ctx, x + hx + 3, y - 12 + bob, 1, 1, pal.stripe);
    px(ctx, x - 1, y - 5, 2, 2, pal.belly);       // 舔爪
    px(ctx, x - 4, y - 5, 2, 2, pal.body);        // 尾巴
  }

  function drawRub(ctx, x, y, t, pal, d) {
    // 蹭人：身体贴近，来回蹭
    const wig = Math.round(Math.sin(t * 10));
    px(ctx, x - 3, y - 8, 6, 7, pal.body);
    px(ctx, x - 2, y - 5, 2, 4, pal.belly);
    const hx = d > 0 ? 1 : -7;
    px(ctx, x + hx, y - 12, 6, 5, pal.body);
    px(ctx, x + hx + 1, y - 11, 2, 2, pal.belly);
    px(ctx, x + hx + (d > 0 ? 4 : 1), y - 11, 1, 1, pal.dark);
    // 尾巴翘起摇摆
    px(ctx, x - 4, y - 9 + wig, 2, 2, pal.body);
    px(ctx, x - 5, y - 10 + wig, 1, 1, pal.dark);
  }

  function drawHappy(ctx, x, y, t, pal, d) {
    const hx = d > 0 ? 1 : -7;
    px(ctx, x - 3, y - 8, 6, 7, pal.body);
    px(ctx, x - 2, y - 5, 2, 4, pal.belly);
    px(ctx, x + hx, y - 12, 6, 5, pal.body);
    px(ctx, x + hx + 1, y - 11, 2, 2, pal.belly);
    // 眯眼笑
    px(ctx, x + hx + (d > 0 ? 2 : 1), y - 11, 2, 1, pal.dark);
    px(ctx, x + hx + (d > 0 ? 4 : 3), y - 11, 2, 1, pal.dark);
    // 尾巴摇
    const wag = Math.round(Math.sin(t * 16) * 2);
    px(ctx, x - 4, y - 6 + wag, 2, 2, pal.body);
    px(ctx, x - 5, y - 7 + wag, 1, 1, pal.dark);
    // 爪爪
    px(ctx, x - 1, y - 2, 2, 2, pal.belly);
  }

  P.Cat = {
    init: init,
    update: update,
    pet: pet,
    pos: pos,
    draw: draw,
    _debug: function () {
      if (!cat) return null;
      return { state: cat.state, stateT: cat.stateT, dur: cat.dur, target: cat.target, moodT: cat.moodT, x: cat.x, onDesk: cat.onDesk };
    }
  };
})();
