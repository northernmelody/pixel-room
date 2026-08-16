/* ============================================================
 * cat.js —— 猫状态机与动画（独立行为系统）
 * ============================================================ */
(function () {
  'use strict';
  const P = window.PixelRoom; if (!P) return;
  const C = P.Config;
  const FLOOR = C.FLOOR_Y, W = C.LOGICAL_W;

  // 锁定橘猫配色（单一配色）
  const PALETTES = [
    { body: '#e89a4a', stripe: '#c47a2e', belly: '#f7d9a8', dark: '#a0601f' } // 橘猫
  ];

  let cat = null;

  function init() {
    cat = {
      x: 60, dir: -1, palette: PALETTES[0],
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
  function drawCat(ctx, x, y, direction, palette, pose) {
    ctx.globalAlpha = 1;  // 关键：重置透明度

    // 轮廓
    ctx.fillStyle = palette.dark;
    ctx.fillRect(Math.floor(x - 1), Math.floor(y - 1), 18, 12);

    // 身体
    ctx.fillStyle = palette.body;
    ctx.fillRect(Math.floor(x), Math.floor(y), 16, 10);

    // 肚皮
    ctx.fillStyle = palette.belly;
    ctx.fillRect(Math.floor(x + 4), Math.floor(y + 6), 8, 4);

    // 条纹
    ctx.fillStyle = palette.stripe;
    ctx.fillRect(Math.floor(x + 2), Math.floor(y + 1), 2, 2);
    ctx.fillRect(Math.floor(x + 7), Math.floor(y), 2, 2);
    ctx.fillRect(Math.floor(x + 12), Math.floor(y + 1), 2, 2);

    // 头部
    ctx.fillStyle = palette.body;
    ctx.fillRect(Math.floor(x + 8), Math.floor(y - 4), 8, 8);
    // 头部轮廓
    ctx.fillStyle = palette.dark;
    ctx.fillRect(Math.floor(x + 7), Math.floor(y - 5), 10, 10);
    ctx.fillStyle = palette.body;
    ctx.fillRect(Math.floor(x + 8), Math.floor(y - 4), 8, 8);

    // 耳朵
    ctx.fillStyle = palette.body;
    ctx.fillRect(Math.floor(x + 9), Math.floor(y - 7), 3, 3);
    ctx.fillRect(Math.floor(x + 13), Math.floor(y - 7), 3, 3);
    // 耳朵内部
    ctx.fillStyle = palette.belly;
    ctx.fillRect(Math.floor(x + 10), Math.floor(y - 6), 1, 1);
    ctx.fillRect(Math.floor(x + 14), Math.floor(y - 6), 1, 1);

    // 眼睛
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(Math.floor(x + 10), Math.floor(y - 2), 2, 2);
    ctx.fillRect(Math.floor(x + 14), Math.floor(y - 2), 2, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.floor(x + 10), Math.floor(y - 2), 1, 1);
    ctx.fillRect(Math.floor(x + 14), Math.floor(y - 2), 1, 1);

    // 胡须
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.floor(x + 6), Math.floor(y - 1), 3, 1);
    ctx.fillRect(Math.floor(x + 6), Math.floor(y), 3, 1);
    ctx.fillRect(Math.floor(x + 17), Math.floor(y - 1), 3, 1);
    ctx.fillRect(Math.floor(x + 17), Math.floor(y), 3, 1);
  }

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
    ctx.fillRect(x - 8, FLOOR - 1, 18, 2);

    // 向左移动：水平镜像前进动画（镜像轴取整数 x，保持像素对齐），避免“倒退”感
    if (d < 0) {
      ctx.save();
      ctx.translate(x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-x, 0);
      drawCat(ctx, x - 7, y - 10, d, pal, c.state);
      ctx.restore();
    } else {
      drawCat(ctx, x - 7, y - 10, d, pal, c.state);
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
