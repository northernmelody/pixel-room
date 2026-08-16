/* ============================================================
 * character.js —— 小人状态机与动画（作息驱动）
 * ============================================================ */
(function () {
  'use strict';
  const P = window.PixelRoom; if (!P) return;
  const C = P.Config;
  const FLOOR = C.FLOOR_Y;

  const SKIN = '#f5e6c8';          // 暖黄偏白
  const SKIN_SHADOW = '#d9c8a0';   // 阴影
  const SKIN_HIGHLIGHT = '#fdf8e8'; // 高光
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

  // 每餐随机食物
  const MEAL_FOODS = {
    breakfast: ['baozi', 'bread', 'noodles', 'egg'],
    lunch: ['rice', 'takeout', 'instant'],
    dinner: ['noodles', 'hotpot', 'takeout']
  };
  const REACTIONS = ['wave', 'nod', 'startle', 'lookback'];

  function isMeal(id) { return id === 'breakfast' || id === 'lunch' || id === 'dinner'; }

  function targetFor(activity, washPhase) {
    if (activity === 'wash' && washPhase === 'shower') return { room: 2, x: 170, pose: 'shower' };
    if (activity === 'wash') return { room: 2, x: 215, pose: 'walk' }; // 早晨先到马桶前
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
    let t;
    if (act === 'wash') t = targetFor(act, washPhase);
    else if (isMeal(act)) t = { room: 3, x: 262, pose: 'fridge' };
    else t = targetFor(act, washPhase);
    char = {
      x: t.x, room: t.room, dir: t.pose === 'work' ? -1 : 1,
      pose: t.pose, activity: act, washPhase: washPhase,
      moving: false, target: t,
      animT: Math.random() * 10, walkStep: 0,
      breakT: 25 + Math.random() * 40, breakAt: 0,
      showerT: 0, sitPose: 0,
      sleepStartMin: null,   // 本次入睡时刻（分钟），自动关灯用
      // ---- 新增状态 ----
      fridgePhase: act === 'wash' ? null : (isMeal(act) ? 'go' : null), // null|go|open|done
      fridgeT: 0, fridgeTMax: 1,
      mealFood: null,        // 当前餐食物类型
      washSeq: (act === 'wash' && washPhase !== 'shower') ? 0 : null,   // 洗漱流程步
      washT: 0,
      react: null            // 点击反应 {type,t}
    };
    screenMode = pickScreen();
    screenTimer = 8 + Math.random() * 12;
  }

  // 早晨洗漱流程：马桶 → 冲水 → 洗手 → 刷牙
  function washSeqUpdate(dt) {
    switch (char.washSeq) {
      case 0: // 已到马桶前 → 转身坐下
        if (!char.moving) {
          char.washSeq = 1;
          char.washT = 4 + Math.random() * 2.5;
          char.pose = 'toilet';
          char.dir = 1;
        }
        break;
      case 1: // 坐着等待
        char.washT -= dt;
        if (char.washT <= 0) {
          char.washSeq = 2;
          char.washT = 1.3;
          char.pose = 'flush';
          if (P.Audio) P.Audio.flush();
        }
        break;
      case 2: // 冲水
        char.washT -= dt;
        if (char.washT <= 0) {
          char.washSeq = 3;
          char.pose = 'walk';
          char.target = { room: 2, x: 186, pose: 'handwash' };
          char.moving = true;
        }
        break;
      case 3: // 走去洗手台
        if (!char.moving) {
          char.washSeq = 4;
          char.washT = 4.5;
          char.pose = 'handwash';
        }
        break;
      case 4: // 洗手（水开→搓洗→关水→毛巾）
        char.washT -= dt;
        if (char.washT <= 0) {
          char.washSeq = 5;
          char.pose = 'brush';
          char.target = { room: 2, x: 193, pose: 'brush' };
        }
        break;
      default: // 5 = 刷牙（原有）
        break;
    }
  }

  function update(dt) {
    if (!char) return;
    const tp = P.Time.now();
    const act = P.Time.getSchedule(tp).id;

    // 点击反应：暂停当前活动 1-2 秒
    if (char.react) {
      char.react.t -= dt;
      char.animT += dt;
      if (char.react.t <= 0) char.react = null;
      return;
    }

    // 活动切换 → 新的目标
    if (act !== char.activity) {
      char.activity = act;
      char.washPhase = tp.hour >= 22 ? 'shower' : 'brush';
      char.react = null;
      char.mealFood = null;
      if (act === 'wash') {
        char.washSeq = char.washPhase === 'shower' ? null : 0;
        char.fridgePhase = null;
        char.target = targetFor(act, char.washPhase);
      } else if (isMeal(act)) {
        char.washSeq = null;
        char.fridgePhase = 'go';
        char.fridgeT = 0;
        // 站在冰箱左侧（x=262，与喝水点同位），面朝冰箱 → 开门时整个内腔可见，
        // 不会被小人身体挡住（旧站位 x=277 正对门缝，开门的内部几乎被完全遮住）
        char.target = { room: 3, x: 262, pose: 'fridge' };
      } else {
        char.washSeq = null;
        char.fridgePhase = null;
        char.target = targetFor(act, char.washPhase);
      }
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

    // 餐前到冰箱取食材：开门取物（白雾）→ 关门 → 上桌
    if (isMeal(char.activity)) {
      if (char.fridgePhase === 'go' && !char.moving) {
        char.fridgePhase = 'open';
        char.fridgeTMax = 2.2;
        char.fridgeT = char.fridgeTMax;
      } else if (char.fridgePhase === 'open') {
        char.fridgeT -= dt;
        if (char.fridgeT <= 0) {
          char.fridgePhase = 'done';
          char.target = { room: 3, x: 248, pose: 'eat' };
          char.moving = true;
        }
      } else if (char.fridgePhase === 'done' && !char.moving && char.pose === 'eat') {
        if (!char.mealFood) {
          const list = MEAL_FOODS[char.activity] || MEAL_FOODS.breakfast;
          char.mealFood = list[(Math.random() * list.length) | 0];
        }
      }
    } else {
      char.fridgePhase = null;
    }

    // 洗漱流程（早晨）
    if (char.activity === 'wash' && char.washPhase !== 'shower') {
      washSeqUpdate(dt);
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

    // 入睡时间记录（自动关灯用：入睡后 5 分钟关卧室灯）
    if (char.pose === 'sleep') {
      if (char.sleepStartMin === null) char.sleepStartMin = tp.hourInt * 60 + tp.min;
    } else {
      char.sleepStartMin = null;
    }
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

  // 冰箱门开合进度（供 roomLayout 绘制门与白雾）
  function fridgeOpen() {
    if (!char || char.fridgePhase !== 'open') return null;
    const elapsed = char.fridgeTMax - char.fridgeT;
    let p = 1;
    if (elapsed < 0.35) p = elapsed / 0.35;
    if (char.fridgeT < 0.35) p = Math.min(p, char.fridgeT / 0.35);
    return { open: true, p: Math.max(0, Math.min(1, p)) };
  }

  function mealFood() {
    return char && char.mealFood ? { type: char.mealFood } : null;
  }

  // 点击反应（随机 4 种之一，或指定类型）
  function react(type) {
    if (!char) return;
    if (char.pose === 'sleep' || char.pose === 'shower') return; // 睡觉/淋浴不反应
    char.react = { type: type || REACTIONS[(Math.random() * REACTIONS.length) | 0], t: 1.2 + Math.random() * 0.6 };
  }
  function reactRandom() { react(); }

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

  // 衣物褶皱（1px 明暗交替线）
  function drawFolds(ctx, hx, topY, shirt) {
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.fillRect(hx - 2, topY + 6, 4, 1);   // 腰部褶皱
    ctx.fillRect(hx - 1, topY + 9, 2, 1);   // 下摆褶皱
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(hx - 3, topY + 2, 6, 1);   // 肩部高光
    ctx.fillRect(hx + 1, topY + 5, 1, 2);   // 侧身高光线
  }

  function drawHead(ctx, x, y, direction) {
    ctx.globalAlpha = 1;  // 关键：重置透明度

    // 轮廓（比头部大 2px，实色深棕）
    ctx.fillStyle = '#3d2b1f';
    ctx.fillRect(Math.floor(x - 1), Math.floor(y - 1), 14, 14);

    // 内部填充（实色，不透明）
    ctx.fillStyle = SKIN;
    ctx.fillRect(Math.floor(x), Math.floor(y), 12, 12);

    // 阴影（下巴下方 1px）
    ctx.fillStyle = SKIN_SHADOW;
    ctx.fillRect(Math.floor(x), Math.floor(y + 10), 12, 2);

    // 高光（额头左上方 1px）
    ctx.fillStyle = SKIN_HIGHLIGHT;
    ctx.fillRect(Math.floor(x + 2), Math.floor(y + 1), 2, 1);

    // 头发（覆盖头顶，实色）
    ctx.fillStyle = HAIR;
    ctx.fillRect(Math.floor(x), Math.floor(y), 12, 4);
    // 刘海细节
    ctx.fillStyle = HAIR2;
    ctx.fillRect(Math.floor(x + 1), Math.floor(y + 3), 2, 1);
    ctx.fillRect(Math.floor(x + 6), Math.floor(y + 2), 3, 1);

    // 眼睛（2px 深色 + 1px 白色高光）
    ctx.fillStyle = '#1a1a1a';
    if (direction >= 0) { // 朝右
      ctx.fillRect(Math.floor(x + 7), Math.floor(y + 6), 2, 2);
      ctx.fillRect(Math.floor(x + 3), Math.floor(y + 6), 2, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.floor(x + 8), Math.floor(y + 6), 1, 1);
      ctx.fillRect(Math.floor(x + 4), Math.floor(y + 6), 1, 1);
    } else { // 朝左
      ctx.fillRect(Math.floor(x + 3), Math.floor(y + 6), 2, 2);
      ctx.fillRect(Math.floor(x + 7), Math.floor(y + 6), 2, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.floor(x + 3), Math.floor(y + 6), 1, 1);
      ctx.fillRect(Math.floor(x + 7), Math.floor(y + 6), 1, 1);
    }

    // 嘴巴（1px）
    ctx.fillStyle = '#c47a5a';
    ctx.fillRect(Math.floor(x + 5), Math.floor(y + 9), 2, 1);
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

    // 点击反应优先
    if (char.react) { drawReact(ctx, hx, d, o, t); return; }

    if (pose === 'sleep') { drawSleep(ctx, t); return; }
    if (pose === 'shower') { drawShower(ctx); return; }
    if (pose === 'fridge') { drawFridge(ctx, hx, o, t); return; }
    if (pose === 'toilet') { drawToilet(ctx, hx, o, t); return; }
    if (pose === 'flush') { drawFlush(ctx, hx, o, t); return; }
    if (pose === 'handwash') { drawHandwash(ctx, hx, o, t); return; }

    if (pose === 'walk') { drawWalk(ctx, hx, d, o, t); return; }
    if (pose === 'work') { drawWork(ctx, hx, o, t); return; }
    if (pose === 'eat') { drawEat(ctx, hx, o, t); return; }
    if (pose === 'leisure') { drawLeisure(ctx, hx, o, t); return; }
    if (pose === 'brush') { drawBrush(ctx, hx, o, t); return; }
    if (pose === 'breakDrink') { drawDrink(ctx, hx, o, t); return; }
    drawStand(ctx, hx, d, o, t);
  }

  // 站立身体基座（供 reaction 用）
  function drawStandBody(ctx, hx, o) {
    ctx.fillStyle = o.pants;
    ctx.fillRect(hx - 4, 116, 3, 12);
    ctx.fillRect(hx + 1, 116, 3, 12);
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(hx - 4, 126, 3, 2);
    ctx.fillRect(hx + 1, 126, 3, 2);
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx - 4, 106, 8, 12);
    drawFolds(ctx, hx, 106, o.shirt);
  }

  function drawStand(ctx, hx, d, o, t) {
    const bob = Math.sin(t * 2) * 0.3;
    drawStandBody(ctx, hx, o);
    // 手臂（垂放）
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx - 5, 108, 2, 7);
    ctx.fillRect(hx + 3, 108, 2, 7);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(hx - 5, 108, 1, 4);
    drawHead(ctx, hx - 6, 95 + bob * 0, d);
  }

  // 点击反应绘制（1-2 秒，结束后继续原状态）
  function drawReact(ctx, hx, d, o, t) {
    const type = char.react.type;
    const jx = type === 'startle' ? Math.round(Math.sin(t * 26) * 1) : 0;
    const X = hx + jx;
    drawStandBody(ctx, X, o);
    if (type === 'wave') {
      // 挥手
      const w = Math.round(Math.sin(t * 12) * 2);
      ctx.fillStyle = o.shirt;
      ctx.fillRect(X + 3, 96 + w, 2, 9);
      ctx.fillStyle = SKIN;
      ctx.fillRect(X + 4, 95 + w, 2, 2);
      drawHead(ctx, X - 6, 95, d);
    } else if (type === 'nod') {
      // 点头
      const b = Math.round(Math.sin(t * 9) * 0.8);
      ctx.fillStyle = o.shirt;
      ctx.fillRect(X - 5, 108, 2, 7);
      ctx.fillRect(X + 3, 108, 2, 7);
      drawHead(ctx, X - 6, 95 + b, d);
    } else if (type === 'startle') {
      // 发呆被惊醒：身体抖动 + 感叹号
      ctx.fillStyle = o.shirt;
      ctx.fillRect(X - 5, 108, 2, 7);
      ctx.fillRect(X + 3, 108, 2, 7);
      drawHead(ctx, X - 6, 95, d);
      ctx.fillStyle = '#ffd05a';
      ctx.fillRect(X + 4, 80, 2, 5);
      ctx.fillRect(X + 4, 87, 2, 2);
      ctx.fillStyle = '#fff6d8';
      ctx.fillRect(X + 5, 81, 1, 3);
    } else if (type === 'lookback') {
      // 回头看（头转向另一侧）
      ctx.fillStyle = o.shirt;
      ctx.fillRect(X - 5, 108, 2, 7);
      ctx.fillRect(X + 3, 108, 2, 7);
      drawHead(ctx, X - 6, 95, -d);
    } else { // lookup（抬头看灯）
      ctx.fillStyle = o.shirt;
      ctx.fillRect(X - 5, 108, 2, 7);
      ctx.fillRect(X + 3, 108, 2, 7);
      drawHead(ctx, X - 6, 94, d);
    }
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
    drawFolds(ctx, hx, 105 - bob, o.shirt);
    // 摆臂
    ctx.fillRect(hx - 5 + l1, 107 - bob, 2, 7);
    ctx.fillRect(hx + 3 - l1, 107 - bob, 2, 7);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(hx - 5 + l1, 107 - bob, 1, 4);
    drawHead(ctx, hx - 6, 94 - bob, d);
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
    drawFolds(ctx, hx, 106, o.shirt);
    // 打字手臂（前后摆动）
    const arm = Math.round(Math.sin(t * 9) * 0.8);
    ctx.fillRect(hx - 13, 108 + arm, 10, 2);
    ctx.fillRect(hx - 4, 110 - arm, 2, 7); // 后臂
    drawHead(ctx, hx - 7, 95, -1);
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
    drawFolds(ctx, hx, 106, o.shirt);
    // 手臂夹菜（上下动）
    const arm = Math.round(Math.sin(t * 6) * 1.5);
    ctx.fillRect(hx + 2, 104 + arm, 2, 8);
    // 筷子
    ctx.fillStyle = '#8a6a4a';
    ctx.fillRect(hx + 3, 100 + arm, 1, 5);
    drawHead(ctx, hx - 5, 95, 1);
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
    drawFolds(ctx, hx, 100, o.shirt);
    // 手机
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(hx + 4, 103, 4, 6);
    ctx.fillStyle = '#7ad8ff';
    ctx.fillRect(hx + 5, 104, 2, 3);
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx + 2, 106, 2, 3);       // 拿手机的手
    drawHead(ctx, hx - 7, 89, 1);
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
    drawFolds(ctx, hx, 106, o.shirt);
    // 举牙刷的手臂
    const arm = Math.round(Math.sin(t * 7) * 1);
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx + 2, 104 + arm, 2, 8);
    ctx.fillStyle = '#e8e8f0';
    ctx.fillRect(hx + 3, 98 + arm, 1, 5); // 牙刷柄
    ctx.fillStyle = '#7ad8ff';
    ctx.fillRect(hx + 3, 97 + arm, 1, 2); // 泡沫
    drawHead(ctx, hx - 5, 95, 1);
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
    drawFolds(ctx, hx, 106, o.shirt);
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
    drawHead(ctx, hx - 5, 95, 1);
  }

  // 站在冰箱左侧取食材（面朝右，手臂伸向冰箱门开口）
  function drawFridge(ctx, hx, o, t) {
    drawStandBody(ctx, hx, o);
    // 伸向冰箱门的手臂（从 x=hx+3 伸到开口左缘，手搭在门边）
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx + 3, 100, 4, 9);
    ctx.fillStyle = SKIN;
    ctx.fillRect(hx + 7, 99, 2, 2);
    drawHead(ctx, hx - 6, 95, 1);
  }

  // 坐马桶腿（坐面已降低，腿自然弯曲）
  function drawToiletLegs(ctx, hx, o) {
    ctx.fillStyle = o.pants;
    ctx.fillRect(hx - 2, 113, 7, 4);      // 大腿（前伸）
    ctx.fillRect(hx - 2, 117, 3, 9);      // 后小腿
    ctx.fillRect(hx + 2, 117, 3, 9);      // 前小腿
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(hx - 2, 126, 3, 2);
    ctx.fillRect(hx + 2, 126, 3, 2);
    // 裤子上半部分下移：大腿根露内裤边，裤脚堆脚踝
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(hx - 2, 113, 7, 1);
    ctx.fillStyle = o.pants;
    ctx.fillRect(hx - 2, 123, 8, 2);
  }

  function drawToilet(ctx, hx, o, t) {
    drawToiletLegs(ctx, hx, o);
    // 躯干
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx - 4, 106, 8, 12);
    drawFolds(ctx, hx, 106, o.shirt);
    // 手放腿上
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx + 1, 109, 2, 4);
    ctx.fillStyle = SKIN;
    ctx.fillRect(hx + 2, 113, 1, 1);
    // 头（朝右）
    drawHead(ctx, hx - 5, 95, 1);
  }

  function drawFlush(ctx, hx, o, t) {
    drawToiletLegs(ctx, hx, o);
    // 躯干（前倾去按冲水钮——水箱在左侧）
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx - 5, 105, 8, 12);
    drawFolds(ctx, hx, 105, o.shirt);
    // 手臂伸向冲水钮
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx - 6, 99, 8, 2);
    ctx.fillStyle = SKIN;
    ctx.fillRect(hx + 1, 97, 2, 2);       // 手按在按钮上
    // 冲水钮闪光
    if (Math.floor(t * 6) % 2 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(216, 97, 2, 1);
    }
    // 马桶水花像素
    const fl = Math.floor(t * 9) % 4;
    ctx.fillStyle = 'rgba(122,200,255,0.9)';
    ctx.fillRect(213 + ((fl * 3) % 6), 112 - ((fl * 3) % 4), 1, 1);
    ctx.fillRect(219 - ((fl * 2) % 5), 114 - ((fl + 1) % 3), 1, 1);
    ctx.fillRect(215 + ((fl + 2) % 4), 110 - ((fl * 2) % 3), 1, 1);
    // 头（回头看向水箱）
    drawHead(ctx, hx - 7, 94, -1);
  }

  // 洗手台洗手（水开 → 搓洗 → 关水 → 毛巾）；站在台盆左侧，水柱在头右侧可见
  function drawHandwash(ctx, hx, o, t) {
    drawStandBody(ctx, hx, o);
    const wT = char.washT;
    const waterOn = wT > 3.3 || (wT > 2.4 && wT < 2.7);
    const rub = wT > 1.4 && wT <= 3.3;
    const dry = wT <= 1.4;
    // 手臂伸向水龙头下
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx + 4, 103, 3, 9);
    // 水柱（水龙头 x=194 上方垂下，画在头右侧不被遮挡）
    if (waterOn) {
      ctx.fillStyle = 'rgba(122,200,255,0.85)';
      ctx.fillRect(hx + 9, 99, 2, 9);
      ctx.fillStyle = 'rgba(200,240,255,0.9)';
      ctx.fillRect(hx + 9, 99, 1, 2);
    }
    // 手（搓洗时交替）
    const alt = rub ? Math.round(Math.sin(t * 14)) : 0;
    ctx.fillStyle = SKIN;
    ctx.fillRect(hx + 8 + alt, 106, 2, 2);
    // 搓洗泡泡
    if (rub) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      const b = Math.floor(t * 8) % 3;
      ctx.fillRect(hx + 7, 101 + ((b * 2) % 5), 1, 1);
      ctx.fillRect(hx + 11, 99 + (((b + 1) * 2) % 5), 1, 1);
    }
    // 毛巾擦手
    if (dry) {
      ctx.fillStyle = '#f0f0f8';
      ctx.fillRect(hx + 7, 105, 3, 3);
      ctx.fillStyle = '#d8d8e8';
      ctx.fillRect(hx + 7, 105, 3, 1);
    }
    // 头（朝右看水）
    drawHead(ctx, hx - 5, 95, 1);
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
    isWork: function () { return char && char.pose === 'work'; },
    sleepInfo: function () {
      if (!char) return null;
      return { sleeping: char.pose === 'sleep', startMin: char.sleepStartMin };
    },
    fridgeOpen: fridgeOpen,
    mealFood: mealFood,
    react: react,
    reactRandom: reactRandom,
    _debug: function () {
      if (!char) return null;
      return { x: char.x, pose: char.pose, activity: char.activity, fridgePhase: char.fridgePhase, mealFood: char.mealFood, washSeq: char.washSeq, washT: char.washT, react: char.react };
    }
  };
})();
