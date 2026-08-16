/* ============================================================
 * character.js —— 小人状态机与动画（作息驱动）
 * ============================================================ */
(function () {
  'use strict';
  const P = window.PixelRoom; if (!P) return;
  const C = P.Config;
  const FLOOR = C.FLOOR_Y;

  const SKIN = '#f2c9a0';
  const HAIR = '#33261c';
  const HAIR2 = '#4a3a28';

  let char = null;
  let screenMode = 'coding';
  let screenTimer = 0;

  // 各活动目标（绝对 x）
  const TARGETS = {
    sleep:     { room: 0, x: 24,  pose: 'sleep' },
    wash:      { room: 2, x: 193, pose: 'brush' },
    breakfast: { room: 3, x: 248, pose: 'eat' },
    work:      { room: 1, x: 147, pose: 'work' },
    lunch:     { room: 3, x: 248, pose: 'eat' },
    dinner:    { room: 3, x: 248, pose: 'eat' },
    leisure:   { room: 0, x: 27,  pose: 'leisure' }
  };

  function targetFor(activity, washPhase) {
    if (activity === 'wash' && washPhase === 'shower') return { room: 2, x: 170, pose: 'shower' };
    return TARGETS[activity] || { room: 1, x: 147, pose: 'idle' };
  }

  function pickScreen() {
    const freel = P.Time.isFreelance(P.Time.now());
    const modes = freel ? C.SCREEN_MODES : C.SCREEN_MODES.filter(function (m) { return m !== 'art'; });
    return modes[(Math.random() * modes.length) | 0];
  }

  function init() {
    const tp = P.Time.now();
    const act = P.Time.getSchedule(tp).id;
    const washPhase = tp.hour >= 22 ? 'shower' : 'brush';
    const t = targetFor(act, washPhase);
    char = {
      x: t.x, room: t.room, dir: t.pose === 'work' ? -1 : 1,
      pose: t.pose, activity: act, washPhase: washPhase,
      moving: false, target: t,
      animT: Math.random() * 10, walkStep: 0,
      breakT: 25 + Math.random() * 40, breakAt: 0,
      showerT: 0, sitPose: 0
    };
    screenMode = pickScreen();
    screenTimer = 8 + Math.random() * 12;
  }

  function update(dt) {
    if (!char) return;
    const tp = P.Time.now();
    const act = P.Time.getSchedule(tp).id;

    // 活动切换 → 新的目标
    if (act !== char.activity) {
      char.activity = act;
      char.washPhase = tp.hour >= 22 ? 'shower' : 'brush';
      const t = targetFor(act, char.washPhase);
      char.target = t;
      char.moving = true;
    }
    char.animT += dt;

    // 移动
    if (char.moving) {
      const t = char.target;
      const dx = t.x - char.x;
      if (Math.abs(dx) < 0.6) {
        char.moving = false;
        char.x = t.x;
        char.pose = t.pose;
        char.dir = t.pose === 'work' ? -1 : 1;
      } else {
        char.x += Math.sign(dx) * Math.min(Math.abs(dx), 15 * dt);
        char.dir = Math.sign(dx) || char.dir;
        char.walkStep += dt * 9;
        char.pose = 'walk';
      }
    }

    // 工作：屏幕内容随机切换
    if (char.pose === 'work') {
      screenTimer -= dt;
      if (screenTimer <= 0) {
        screenMode = pickScreen();
        screenTimer = 8 + Math.random() * 14;
      }
      if (screenMode !== 'slacking' && Math.random() < dt * 7) {
        if (P.Audio) P.Audio.keyboard();
      }
    }

    // 自由职业日的摸鱼休息：起身喝水
    if (char.activity === 'work' && P.Time.isFreelance(tp) && char.pose !== 'walk') {
      char.breakT -= dt;
      if (char.pose === 'work' && char.breakT <= 0 && Math.random() < dt * 0.05) {
        char.breakAt = 4 + Math.random() * 3;
        char.target = { room: 3, x: 262, pose: 'breakDrink' };
        char.moving = true;
      } else if (char.pose === 'breakDrink') {
        char.breakAt -= dt;
        if (char.breakAt <= 0) {
          char.target = { room: 1, x: 147, pose: 'work' };
          char.moving = true;
          char.breakT = 30 + Math.random() * 50;
        }
      }
    }

    // 淋浴计时
    if (char.pose === 'shower') char.showerT += dt;
  }

  function pos() {
    return { x: char ? char.x : 147, dir: char ? char.dir : -1 };
  }

  function screenModeName(mode) {
    const m = mode || screenMode;
    return C.SCREEN_MODE_NAMES[m] || '';
  }
  function cycleScreen() {
    const freel = P.Time.isFreelance(P.Time.now());
    const modes = freel ? C.SCREEN_MODES : C.SCREEN_MODES.filter(function (m) { return m !== 'art'; });
    const idx = modes.indexOf(screenMode);
    screenMode = modes[(idx + 1) % modes.length];
    return screenMode;
  }

  // ============================================================
  // 绘制
  // ============================================================
  function outfit(st) {
    const freel = P.Time.isFreelance(st.tp);
    let shirt = freel ? '#c86aa0' : '#4a7bd0';
    let pants = freel ? '#4a4460' : '#3a3f55';
    const s = st.season.id;
    if (s === 'summer') shirt = freel ? '#ffb06a' : '#7fd0a8';
    if (s === 'winter') { shirt = freel ? '#b05a8a' : '#3a62a8'; pants = '#333a4a'; }
    return { shirt: shirt, pants: pants };
  }

  function drawHead(ctx, hx, topY, d, skin, hair) {
    // 头 8x10
    ctx.fillStyle = skin;
    ctx.fillRect(hx - 4, topY + 4, 8, 6);
    ctx.fillStyle = hair;
    ctx.fillRect(hx - 4, topY, 8, 5);
    ctx.fillRect(hx - 4, topY + 1, 2, 6);   // 后脑发
    // 眼睛（朝向 d）
    ctx.fillStyle = '#2a2a3a';
    if (d > 0) ctx.fillRect(hx + 2, topY + 6, 1, 1);
    else ctx.fillRect(hx - 3, topY + 6, 1, 1);
    // 腮红
    ctx.fillStyle = 'rgba(240,140,120,0.5)';
    ctx.fillRect(hx + (d > 0 ? 1 : -2), topY + 8, 1, 1);
  }

  function draw(ctx, st) {
    if (!char) return;
    const pose = char.pose;
    const t = performance.now() / 1000;
    const o = outfit(st);
    const hx = Math.round(char.x);
    const d = char.dir;

    // 影子
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(hx - 6, FLOOR - 1, 12, 2);

    if (pose === 'sleep') { drawSleep(ctx, t); return; }
    if (pose === 'shower') { drawShower(ctx); return; }

    if (pose === 'walk') { drawWalk(ctx, hx, d, o, t); return; }
    if (pose === 'work') { drawWork(ctx, hx, o, t); return; }
    if (pose === 'eat') { drawEat(ctx, hx, o, t); return; }
    if (pose === 'leisure') { drawLeisure(ctx, hx, o, t); return; }
    if (pose === 'brush') { drawBrush(ctx, hx, o, t); return; }
    if (pose === 'breakDrink') { drawDrink(ctx, hx, o, t); return; }
    drawStand(ctx, hx, d, o, t);
  }

  function drawStand(ctx, hx, d, o, t) {
    const bob = Math.sin(t * 2) * 0.3;
    // 腿
    ctx.fillStyle = o.pants;
    ctx.fillRect(hx - 4, 116 - bob * 0, 3, 12);
    ctx.fillRect(hx + 1, 116, 3, 12);
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(hx - 4, 126, 3, 2);
    ctx.fillRect(hx + 1, 126, 3, 2);
    // 身体
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx - 4, 106, 8, 12);
    // 手臂（垂放）
    ctx.fillRect(hx - 5, 108, 2, 7);
    ctx.fillRect(hx + 3, 108, 2, 7);
    drawHead(ctx, hx, 96, d);
  }

  function drawWalk(ctx, hx, d, o, t) {
    const s = Math.sin(char.walkStep * 2);
    const l1 = Math.round(s > 0 ? 1 : -1), l2 = -l1;
    const bob = Math.abs(Math.sin(char.walkStep)) * 1.2;
    ctx.fillStyle = o.pants;
    ctx.fillRect(hx - 4 + l1, 116 - bob, 3, 12);
    ctx.fillRect(hx + 1 + l2, 116 - bob, 3, 12);
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(hx - 4 + l1, 126 - bob, 3, 2);
    ctx.fillRect(hx + 1 + l2, 126 - bob, 3, 2);
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx - 4, 105 - bob, 8, 11);
    // 摆臂
    ctx.fillRect(hx - 5 + l1, 107 - bob, 2, 7);
    ctx.fillRect(hx + 3 - l1, 107 - bob, 2, 7);
    drawHead(ctx, hx, 95 - bob, d);
  }

  function drawWork(ctx, hx, o, t) {
    // 坐姿打字（面朝左）
    ctx.fillStyle = o.pants;
    ctx.fillRect(hx - 8, 118, 10, 4);      // 大腿
    ctx.fillRect(hx - 8, 122, 3, 6);       // 小腿
    ctx.fillRect(hx - 4, 118, 3, 6);       // 另一腿（后）
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(hx - 8, 126, 3, 2);
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx - 4, 106, 8, 13);      // 躯干
    // 打字手臂（前后摆动）
    const arm = Math.round(Math.sin(t * 9) * 0.8);
    ctx.fillRect(hx - 13, 108 + arm, 10, 2);
    ctx.fillRect(hx - 4, 110 - arm, 2, 7); // 后臂
    drawHead(ctx, hx - 1, 96, -1);
    // 键盘敲击闪烁点
    if (screenMode !== 'slacking' && Math.floor(t * 8) % 2 === 0) {
      ctx.fillStyle = '#7ad8ff';
      ctx.fillRect(hx - 12, 106, 1, 1);
    }
  }

  function drawEat(ctx, hx, o, t) {
    // 坐姿吃饭（面朝右，坐高脚凳）
    ctx.fillStyle = o.pants;
    ctx.fillRect(hx, 118, 7, 4);           // 大腿
    ctx.fillRect(hx + 4, 122, 3, 6);       // 小腿
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(hx + 4, 126, 3, 2);
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx - 4, 106, 8, 13);
    // 手臂夹菜（上下动）
    const arm = Math.round(Math.sin(t * 6) * 1.5);
    ctx.fillRect(hx + 2, 104 + arm, 2, 8);
    // 筷子
    ctx.fillStyle = '#8a6a4a';
    ctx.fillRect(hx + 3, 100 + arm, 1, 5);
    drawHead(ctx, hx + 1, 96, 1);
  }

  function drawLeisure(ctx, hx, o, t) {
    // 坐在床边，玩手机
    ctx.fillStyle = o.pants;
    ctx.fillRect(hx + 2, 112, 6, 5);       // 大腿（搭在床边）
    ctx.fillRect(hx + 5, 117, 3, 11);      // 小腿垂下
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(hx + 5, 126, 3, 2);
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx - 4, 100, 8, 13);
    // 手机
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(hx + 4, 103, 4, 6);
    ctx.fillStyle = '#7ad8ff';
    ctx.fillRect(hx + 5, 104, 2, 3);
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx + 2, 106, 2, 3);       // 拿手机的手
    drawHead(ctx, hx - 1, 90, 1);
    // 手机光晕
    const glow = ctx.createRadialGradient(hx + 6, 106, 1, hx + 6, 106, 8);
    glow.addColorStop(0, 'rgba(122,216,255,0.22)');
    glow.addColorStop(1, 'rgba(122,216,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(hx - 2, 98, 16, 16);
  }

  function drawBrush(ctx, hx, o, t) {
    // 洗漱（面朝右）
    ctx.fillStyle = o.pants;
    ctx.fillRect(hx - 4, 116, 3, 12);
    ctx.fillRect(hx + 1, 116, 3, 12);
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(hx - 4, 126, 3, 2);
    ctx.fillRect(hx + 1, 126, 3, 2);
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx - 4, 106, 8, 12);
    // 举牙刷的手臂
    const arm = Math.round(Math.sin(t * 7) * 1);
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx + 2, 104 + arm, 2, 8);
    ctx.fillStyle = '#e8e8f0';
    ctx.fillRect(hx + 3, 98 + arm, 1, 5); // 牙刷柄
    ctx.fillStyle = '#7ad8ff';
    ctx.fillRect(hx + 3, 97 + arm, 1, 2); // 泡沫
    drawHead(ctx, hx + 1, 96, 1);
  }

  function drawDrink(ctx, hx, o, t) {
    // 站在厨房喝水（面朝右）
    ctx.fillStyle = o.pants;
    ctx.fillRect(hx - 4, 116, 3, 12);
    ctx.fillRect(hx + 1, 116, 3, 12);
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(hx - 4, 126, 3, 2);
    ctx.fillRect(hx + 1, 126, 3, 2);
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx - 4, 106, 8, 12);
    // 举杯
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx + 2, 104, 2, 8);
    ctx.fillStyle = '#b0503a';
    ctx.fillRect(hx + 3, 99, 3, 4);
    // 蒸汽
    const s1 = Math.floor(t * 3) % 3;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(hx + 4, 96 - s1, 1, 1);
    ctx.fillRect(hx + 5, 94 - ((s1 + 1) % 3), 1, 1);
    drawHead(ctx, hx + 1, 96, 1);
  }

  function drawSleep(ctx, t) {
    // 躺在床上（头左脚右，藏在被子里）
    // 头（枕在枕头上）
    ctx.fillStyle = SKIN;
    ctx.fillRect(12, 101, 7, 6);
    ctx.fillStyle = HAIR;
    ctx.fillRect(11, 100, 8, 4);
    ctx.fillRect(11, 101, 3, 5);
    // 闭眼
    ctx.fillStyle = '#5a4030';
    ctx.fillRect(16, 104, 2, 1);
    // 肩膀（从被沿露出）
    ctx.fillStyle = outfitForSleep();
    ctx.fillRect(19, 108, 5, 4);
    ctx.fillStyle = SKIN;
    ctx.fillRect(19, 108, 5, 1);
    // 手臂搭在被子上
    ctx.fillStyle = outfitForSleep();
    ctx.fillRect(20, 112, 6, 2);
    ctx.fillStyle = SKIN;
    ctx.fillRect(25, 112, 2, 2);
    // zzz
    const z = Math.floor(t * 1.4) % 3;
    ctx.fillStyle = 'rgba(220,230,250,0.9)';
    ctx.fillRect(26, 99 - z, 2, 1);
    ctx.fillRect(28, 97 - z * 0.5 - (z > 0 ? 1 : 0), 1, 1);
  }

  function outfitForSleep() { return '#4a7bd0'; }

  function drawShower(ctx) {
    // 淋浴剪影（玻璃后）
    const sx = 168;
    ctx.fillStyle = 'rgba(140,160,180,0.75)';
    ctx.fillRect(sx - 3, 112, 8, 12);   // 身体
    ctx.fillRect(sx - 2, 116, 6, 12);   // 腿
    ctx.fillRect(sx - 2, 102, 7, 8);    // 头
    // 手（举起洗头）
    ctx.fillRect(sx - 4, 104, 2, 6);
    ctx.fillRect(sx + 5, 104, 2, 6);
    // 重新画玻璃（人物在玻璃后面）
    ctx.fillStyle = 'rgba(160,220,230,0.4)';
    ctx.fillRect(180, 96, 2, 32);
    ctx.fillRect(162, 94, 22, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(178, 96, 1, 32);
  }

  P.Character = {
    init: init,
    update: update,
    draw: draw,
    pos: pos,
    screenMode: function () { return screenMode; },
    screenName: screenModeName,
    cycleScreen: cycleScreen,
    isWork: function () { return char && char.pose === 'work'; }
  };
})();
