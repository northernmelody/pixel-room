/* ============================================================
 * dog.js —— 腊肠狗状态机与动画（独立行为系统）
 * 特点：长身体、短腿、大耳朵、摇尾巴、爱跟人、会叫
 * 狗窝/狗粮碗位于厨房角落地面（与猫粮碗 x=305 分开）
 * ============================================================ */
(function () {
  'use strict';
  const P = window.PixelRoom; if (!P) return;
  const C = P.Config;
  const FLOOR = C.FLOOR_Y;
  const W = C.LOGICAL_W;

  // 锁定棕色腊肠狗配色（单一配色）
  const PALETTES = [
    { body: '#8B5A2B', belly: '#C49A6C', ear: '#5C3A1E', earInner: '#4a2e16', nose: '#1A1A1A', tail: '#6B4226', paw: '#3a2416' }
  ];

  // 狗窝中心 x=292（窝静态绘制于 286,124,12,4）；狗粮碗静态绘制于 300,124,5,3
  const DOG_BED_X = 292;
  const DOG_BOWL_X = 288;   // 进食站位（面朝右，嘴正好到碗边）
  const BOWL_X = 300;       // 狗粮碗静态 x（进食时重绘在狗身前）

  // 状态定义
  const STATE = {
    IDLE: 'idle',           // 发呆/休息
    WANDER: 'wander',       // 四处走动
    SLEEP: 'sleep',         // 睡觉（蜷在狗窝）
    EAT: 'eat',             // 吃狗粮
    ZOOMIES: 'zoomies',     // 突然狂奔
    FOLLOW: 'follow',       // 跟随小人
    BARK: 'bark',           // 叫
    SCRATCH: 'scratch',     // 抓挠/刨地
    SIT: 'sit'              // 坐着看
  };

  let dog = null;
  let lastInteractAt = 0;   // 点击狗：首次叫，4 秒内再点则跟随

  function init() {
    const saved = P.Storage.state;
    const seed = (saved.dogSeed !== undefined && saved.dogSeed !== null) ? saved.dogSeed : 0;
    dog = {
      x: DOG_BED_X, dir: -1,
      state: STATE.IDLE, stateT: 0, dur: 1,
      animT: Math.random() * 10,
      target: null,
      palette: PALETTES[seed % PALETTES.length],
      eating: false, eatT: 0,
      barkT: 0
    };
    enter(STATE.IDLE);
  }

  function isPersonSleeping() {
    return P.Time.getSchedule(P.Time.now()).id === 'sleep';
  }

  function pickWanderSpot() {
    const p = P.Character.pos();
    const spots = [
      p.x + (Math.random() * 44 - 22),
      24 + Math.random() * 30,
      120 + Math.random() * 30,
      250 + Math.random() * 30
    ];
    return Math.max(12, Math.min(W - 12, spots[(Math.random() * spots.length) | 0]));
  }

  // 带权重的状态选择（晚上更爱睡觉）
  function pickState() {
    const p = P.Character.pos();
    const near = Math.abs(dog.x - p.x) < 42;
    const night = isPersonSleeping();
    const bowl = (P.Storage.state.items || {}).dogBowl || 0;
    let wanderW = 22, idleW = 10, sitW = 9, scratchW = 6, zoomiesW = 7, barkW = 5, sleepW = 12;
    let followW = near ? 14 : 8;
    if (night) { sleepW += 26; wanderW = 3; zoomiesW = 2; followW = 2; barkW = 1; sitW = 2; scratchW = 1; }
    const eatW = bowl > 0 ? 10 : 0;
    const total = wanderW + idleW + sitW + scratchW + zoomiesW + barkW + sleepW + followW + eatW;
    let roll = Math.random() * total;
    if ((roll -= wanderW) <= 0) return STATE.WANDER;
    if ((roll -= idleW) <= 0) return STATE.IDLE;
    if ((roll -= sitW) <= 0) return STATE.SIT;
    if ((roll -= scratchW) <= 0) return STATE.SCRATCH;
    if ((roll -= zoomiesW) <= 0) return STATE.ZOOMIES;
    if ((roll -= barkW) <= 0) return STATE.BARK;
    if ((roll -= sleepW) <= 0) return STATE.SLEEP;
    if ((roll -= followW) <= 0) return STATE.FOLLOW;
    return STATE.EAT;
  }

  function enter(state) {
    dog.state = state; dog.stateT = 0; dog.target = null;
    dog.eating = false;
    switch (state) {
      case STATE.IDLE: dog.dur = 1 + Math.random() * 2.5; break;
      case STATE.WANDER: dog.dur = 4 + Math.random() * 4; dog.target = pickWanderSpot(); break;
      case STATE.SIT: dog.dur = 2 + Math.random() * 4; break;
      case STATE.SCRATCH: dog.dur = 3 + Math.random() * 5; break;
      case STATE.ZOOMIES: dog.dur = 1.2 + Math.random() * 1.2; dog.target = pickZoomTarget(); break;
      case STATE.BARK:
        dog.dur = 2 + Math.random() * 1.5; dog.barkT = 0.9;
        if (P.Audio) P.Audio.bark();
        break;
      case STATE.SLEEP:
        dog.dur = isPersonSleeping() ? 20 + Math.random() * 30 : 8 + Math.random() * 12;
        dog.target = DOG_BED_X;
        break;
      case STATE.FOLLOW: dog.dur = 6 + Math.random() * 6; break;
      case STATE.EAT: dog.dur = 3 + Math.random() * 2; dog.target = DOG_BOWL_X; break;
    }
  }

  function pickZoomTarget() {
    return Math.random() < 0.5 ? 16 : W - 16;
  }

  function moveToTarget(dt, spd) {
    if (dog.target === null) return;
    const dx = dog.target - dog.x;
    const s = spd || 8;
    if (Math.abs(dx) < 0.8) {
      dog.x = dog.target; dog.target = null;
      return;
    }
    dog.x += Math.sign(dx) * Math.min(Math.abs(dx), s * dt);
    dog.dir = Math.sign(dx);
  }

  function update(dt) {
    if (!dog) return;
    dog.animT += dt;
    dog.stateT += dt;
    if (dog.barkT > 0) dog.barkT -= dt;

    switch (dog.state) {
      case STATE.IDLE:
        if (dog.stateT > dog.dur) enter(pickState());
        break;

      case STATE.WANDER: {
        if (dog.target === null) dog.target = pickWanderSpot();
        const dx = dog.target - dog.x;
        if (Math.abs(dx) < 1) {
          dog.target = null;
          if (dog.stateT > dog.dur || Math.random() < dt * 0.4) {
            enter(STATE.IDLE); dog.dur = 1 + Math.random() * 2;
          }
        } else {
          moveToTarget(dt);
        }
        break;
      }

      case STATE.SLEEP: {
        if (dog.target !== null) {
          const dx = dog.target - dog.x;
          if (Math.abs(dx) < 1) { dog.x = DOG_BED_X; dog.target = null; dog.dir = -1; }
          else moveToTarget(dt, 6);
        } else if (dog.stateT > dog.dur) {
          enter(pickState());
        }
        break;
      }

      case STATE.EAT: {
        if (!dog.eating) {
          const dx = DOG_BOWL_X - dog.x;
          if (Math.abs(dx) < 1.5) {
            dog.x = DOG_BOWL_X; dog.dir = 1; dog.eating = true;
            dog.eatT = 2.5 + Math.random() * 2;
          } else {
            moveToTarget(dt);
          }
        } else {
          dog.eatT -= dt;
          if (dog.eatT <= 0) {
            const items = P.Storage.state.items || {};
            if (items.dogBowl > 0) { items.dogBowl--; P.Storage.save(); }
            if (P.Audio) P.Audio.eat();
            dog.eating = false;
            enter(STATE.IDLE); dog.dur = 1 + Math.random() * 2;
          }
        }
        break;
      }

      case STATE.ZOOMIES: {
        if (dog.target === null) dog.target = pickZoomTarget();
        moveToTarget(dt, 26);
        if (dog.target === null) dog.target = pickZoomTarget();
        if (dog.stateT > dog.dur) { enter(STATE.IDLE); dog.dur = 1.5 + Math.random() * 1.5; }
        break;
      }

      case STATE.FOLLOW: {
        const p = P.Character.pos();
        if (p) dog.target = p.x - p.dir * 12;   // 跟在小人身后一侧
        moveToTarget(dt, 10);
        if (dog.stateT > dog.dur) enter(pickState());
        break;
      }

      case STATE.BARK:
        if (dog.stateT > dog.dur) enter(pickState());
        break;

      case STATE.SCRATCH:
        if (dog.stateT > dog.dur) enter(pickState());
        break;

      case STATE.SIT:
        if (dog.stateT > dog.dur) enter(pickState());
        break;
    }
    dog.x = Math.max(12, Math.min(W - 12, dog.x));
  }

  // ---- 外部触发 ----
  // 点击：首次叫一声；4 秒内再点则跟上小人
  function interact() {
    if (!dog) return 'bark';
    const now = Date.now();
    if (now - lastInteractAt < 4000) {
      lastInteractAt = now;
      enter(STATE.FOLLOW); dog.dur = 10;
      if (P.Audio) P.Audio.bark();
      return 'follow';
    }
    lastInteractAt = now;
    if (P.Audio) P.Audio.bark();
    enter(STATE.BARK); dog.dur = 2;
    return 'bark';
  }

  function bark() {
    if (!dog) return;
    if (P.Audio) P.Audio.bark();
    enter(STATE.BARK); dog.dur = 2;
  }

  function followCharacter() {
    if (!dog) return;
    enter(STATE.FOLLOW); dog.dur = 10;
  }

  function eatFood() {
    if (!dog) return;
    enter(STATE.EAT); dog.dur = 3.5;
  }

  // ============================================================
  // 绘制
  // ============================================================
  // 站姿身体（含走/叫/吃变体），面朝右；左向由调用方整体镜像
  function drawDogBody(ctx, x, sy, pal, t, moving, pose) {
    const step = moving ? Math.sin(t * 13) : 0;
    const bob = moving ? Math.abs(Math.sin(t * 13)) * 0.5 : 0;
    const a = Math.round(step > 0 ? 1 : 0), b = 1 - a;
    const topY = sy - 7 - bob;

    // 尾巴（身后，摇动）
    const wag = Math.round(Math.sin(t * 10) * 1);
    ctx.fillStyle = pal.tail;
    ctx.fillRect(x - 13, topY + 1 + wag, 3, 2);
    ctx.fillRect(x - 15, topY + wag, 2, 1);

    // 四条短腿
    ctx.fillStyle = pal.body;
    ctx.fillRect(x - 8 + a, sy - 4, 3, 4);
    ctx.fillRect(x - 3 + b, sy - 4, 3, 4);
    ctx.fillRect(x + 3 + b, sy - 4, 3, 4);
    ctx.fillRect(x + 8 + a, sy - 4, 3, 4);
    ctx.fillStyle = pal.paw;
    ctx.fillRect(x - 8 + a, sy - 1, 3, 1);
    ctx.fillRect(x - 3 + b, sy - 1, 3, 1);
    ctx.fillRect(x + 3 + b, sy - 1, 3, 1);
    ctx.fillRect(x + 8 + a, sy - 1, 3, 1);

    // 长身体（腊肠狗特征：低矮细长）
    ctx.fillStyle = pal.body;
    ctx.fillRect(x - 11, topY, 20, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(x - 11, topY, 20, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(x - 11, topY + 4, 20, 1);
    // 腹部（浅色）
    ctx.fillStyle = pal.belly;
    ctx.fillRect(x - 6, topY + 3, 12, 2);

    // 颈部连接
    ctx.fillStyle = pal.body;
    ctx.fillRect(x + 7, topY - 2, 4, 4);

    // 头 / 口鼻（按姿态调整高低）
    let headY = topY - 5, snoutY = headY + 2, mouthY = headY + 5;
    if (pose === 'eat') { headY = topY + 2; snoutY = headY + 1; mouthY = headY + 3; }
    if (pose === 'bark') { headY = topY - 6; snoutY = headY + 1; mouthY = headY + 4; }

    ctx.fillStyle = pal.body;
    ctx.fillRect(x + 9, headY, 8, 6);        // 头部
    ctx.fillRect(x + 15, snoutY, 6, 3);      // 长嘴（口鼻突出）
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x + 9, headY, 8, 1);        // 头顶高光

    // 眼睛
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x + 11, headY + 2, 2, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 11, headY + 2, 1, 1);

    // 鼻子
    ctx.fillStyle = pal.nose;
    ctx.fillRect(x + 19, headY + (pose === 'bark' ? 0 : 1), 2, 2);

    // 嘴（叫时张嘴）
    if (pose === 'bark') {
      ctx.fillStyle = '#3a2418';
      ctx.fillRect(x + 16, headY + 3, 4, 2);
      ctx.fillStyle = '#e88a8a';
      ctx.fillRect(x + 16, headY + 3, 3, 1);   // 舌头
      // 叫声波纹
      const w = Math.floor(t * 8) % 3;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(x + 23, headY - 1 - w, 2, 1);
      ctx.fillRect(x + 26, headY - w, 1, 1);
    } else {
      ctx.fillStyle = '#3a2418';
      ctx.fillRect(x + 17, mouthY, 2, 1);
    }

    // 大垂耳（腊肠狗特征）
    ctx.fillStyle = pal.ear;
    ctx.fillRect(x + 9, headY - 1, 3, 3);
    ctx.fillRect(x + 8, headY + 2, 3, pose === 'eat' ? 4 : 5);
    ctx.fillStyle = pal.earInner;
    ctx.fillRect(x + 9, headY + 3, 1, pose === 'eat' ? 2 : 3);

    // 项圈
    ctx.fillStyle = '#cc3333';
    ctx.fillRect(x + 7, topY + 1, 3, 1);
    ctx.fillStyle = '#ffd05a';
    ctx.fillRect(x + 9, topY + 2, 1, 1);     // 名牌
  }

  // 坐姿（前腿直立、后腿蹲坐、抬头看）
  function drawDogSit(ctx, x, sy, pal, t) {
    const wag = Math.round(Math.sin(t * 9) * 1);
    // 臀部
    ctx.fillStyle = pal.body;
    ctx.fillRect(x - 7, sy - 6, 6, 6);
    // 尾巴（贴地摆动）
    ctx.fillStyle = pal.tail;
    ctx.fillRect(x - 10, sy - 3 + wag, 4, 2);
    // 前胸/躯干
    ctx.fillStyle = pal.body;
    ctx.fillRect(x - 3, sy - 10, 9, 8);
    ctx.fillStyle = pal.belly;
    ctx.fillRect(x - 2, sy - 3, 7, 2);
    // 前腿
    ctx.fillStyle = pal.body;
    ctx.fillRect(x + 1, sy - 7, 3, 7);
    ctx.fillRect(x + 5, sy - 7, 3, 7);
    ctx.fillStyle = pal.paw;
    ctx.fillRect(x + 1, sy - 1, 3, 1);
    ctx.fillRect(x + 5, sy - 1, 3, 1);
    // 头（抬起）
    const headY = sy - 16;
    ctx.fillStyle = pal.body;
    ctx.fillRect(x + 1, headY, 8, 6);
    ctx.fillRect(x + 7, headY + 2, 6, 3);    // 长嘴
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x + 1, headY, 8, 1);
    ctx.fillStyle = pal.nose;
    ctx.fillRect(x + 11, headY + 1, 2, 2);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x + 3, headY + 2, 2, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 3, headY + 2, 1, 1);
    ctx.fillStyle = '#3a2418';
    ctx.fillRect(x + 8, headY + 5, 2, 1);    // 嘴
    // 垂耳
    ctx.fillStyle = pal.ear;
    ctx.fillRect(x + 1, headY - 1, 3, 3);
    ctx.fillRect(x, headY + 2, 3, 5);
    ctx.fillStyle = pal.earInner;
    ctx.fillRect(x + 1, headY + 3, 1, 2);
    // 项圈
    ctx.fillStyle = '#cc3333';
    ctx.fillRect(x + 4, headY + 6, 3, 1);
    ctx.fillStyle = '#ffd05a';
    ctx.fillRect(x + 6, headY + 7, 1, 1);
  }

  // 睡觉：蜷在狗窝里
  function drawDogSleep(ctx, x, sy, pal, t) {
    const by = sy - 4;    // 窝面高度（狗窝顶面 y=124）
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.fillRect(x - 6, by + 1, 13, 2);
    // 蜷起的身体
    ctx.fillStyle = pal.body;
    ctx.fillRect(x - 5, by - 4, 11, 4);
    ctx.fillRect(x - 2, by - 6, 7, 2);       // 背拱
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x - 5, by - 4, 11, 1);
    // 头埋进身体（右侧）
    ctx.fillStyle = pal.body;
    ctx.fillRect(x + 4, by - 6, 5, 3);
    ctx.fillRect(x + 8, by - 5, 3, 2);       // 嘴
    // 耳朵
    ctx.fillStyle = pal.ear;
    ctx.fillRect(x + 4, by - 7, 2, 2);
    ctx.fillRect(x + 5, by - 5, 2, 3);
    // 鼻尖
    ctx.fillStyle = pal.nose;
    ctx.fillRect(x + 10, by - 5, 1, 1);
    // 尾巴卷在身侧
    ctx.fillStyle = pal.tail;
    ctx.fillRect(x - 8, by - 3, 3, 2);
    // Zzz
    const z = Math.floor(t * 1.2) % 3;
    ctx.fillStyle = 'rgba(220,230,250,0.9)';
    ctx.fillRect(x + 12, by - 10 - z, 2, 1);
    ctx.fillRect(x + 14, by - 11 - z, 1, 1);
  }

  // 狗粮碗（进食时重绘在狗身前，保证碗与余粮可见）
  function drawDogBowlAt(ctx, bx, by) {
    const it = P.Storage.state.items || {};
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(bx - 1, by + 3, 7, 1);
    // 碗（红色）
    ctx.fillStyle = '#c85a4a';
    ctx.fillRect(bx, by, 5, 2);
    ctx.fillStyle = '#e07060';
    ctx.fillRect(bx, by, 5, 1);
    ctx.fillStyle = '#a04838';
    ctx.fillRect(bx + 1, by + 2, 3, 1);
    // 狗粮（3=满 2=半 1=少）
    const food = it.dogBowl || 0;
    if (food >= 1) {
      ctx.fillStyle = '#8a5a2a';
      ctx.fillRect(bx + 1, by - 1, 3, 1);
      if (food >= 2) { ctx.fillStyle = '#a07038'; ctx.fillRect(bx + 1, by - 2, 3, 1); }
      if (food >= 3) { ctx.fillStyle = '#b88248'; ctx.fillRect(bx, by - 2, 5, 1); ctx.fillStyle = '#6a4020'; ctx.fillRect(bx + 2, by - 3, 1, 1); }
    }
  }

  function draw(ctx, st) {
    if (!dog) return;
    const c = dog;
    const x = Math.round(c.x);
    const t = c.animT;
    const pal = c.palette;
    const sy = FLOOR;

    ctx.globalAlpha = 1;  // 关键：重置透明度

    // 睡觉：蜷在狗窝（无地面长影子）
    if (c.state === STATE.SLEEP && c.target === null) {
      drawDogSleep(ctx, x, sy, pal, t);
      return;
    }

    // 影子
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(x - 13, sy - 1, 27, 2);

    const flip = c.dir < 0;
    ctx.save();
    if (flip) {
      ctx.translate(x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-x, 0);
    }

    if (c.state === STATE.SIT) {
      drawDogSit(ctx, x, sy, pal, t);
    } else {
      const moving = c.state === STATE.WANDER || c.state === STATE.ZOOMIES ||
        c.state === STATE.FOLLOW || (c.state === STATE.SLEEP && c.target !== null) ||
        (c.state === STATE.EAT && !c.eating);
      const pose = c.state === STATE.BARK ? 'bark' : (c.state === STATE.EAT && c.eating ? 'eat' : 'stand');
      drawDogBody(ctx, x, sy, pal, t, moving, pose);
    }
    ctx.restore();

    // 吃狗粮：碗重绘在狗身前
    if (c.state === STATE.EAT && c.eating) {
      drawDogBowlAt(ctx, BOWL_X, 124);
    }
  }

  P.Dog = {
    init: init,
    update: update,
    draw: draw,
    interact: interact,
    bark: bark,
    followCharacter: followCharacter,
    eatFood: eatFood,
    pos: function () { return dog ? { x: dog.x, dir: dog.dir } : { x: DOG_BED_X, dir: -1 }; },
    state: function () { return dog ? dog.state : null; },
    _debug: function () {
      if (!dog) return null;
      return { x: dog.x, dir: dog.dir, state: dog.state, stateT: dog.stateT, dur: dog.dur, target: dog.target, eating: dog.eating, eatT: dog.eatT };
    }
  };
})();
