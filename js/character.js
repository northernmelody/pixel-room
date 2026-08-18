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

  // ---- 休闲活动（19:00-22:00 子状态机）----
  // 位置：game 工作区电脑前 / read 床边 / exercise 工作区空处（书架前）
  //       play_cat 工作区空处 / look_out 卧室窗边 / phone 床边
  const LEISURE_SPOTS = {
    game:     { room: 1, x: 147, dir: -1 },  // 面朝电脑（显示器在左侧）
    read:     { room: 0, x: 27,  dir: 1  },   // 床边
    exercise: { room: 1, x: 96,  dir: 1  },   // 书架前空地
    play_cat: { room: 1, x: 99,  dir: 1  },   // 空地逗猫
    look_out: { room: 0, x: 63,  dir: -1 },   // 窗边面朝窗外
    phone:    { room: 0, x: 27,  dir: 1  }    // 床边
  };
  const LEISURE_NAMES = {
    game: '打游戏', read: '看书', exercise: '健身',
    play_cat: '逗猫', look_out: '发呆看窗外', phone: '玩手机'
  };
  // 调试加速：?leisurefast 让休闲活动时长缩至 1/50（便于观察切换）
  const LEISURE_SCALE = (typeof location !== 'undefined' && /[?&]leisurefast/.test(location.search)) ? 0.02 : 1;

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
      react: null,           // 点击反应 {type,t}
      // ---- 休闲活动 ----
      leisureAct: null,      // 当前休闲活动 id（null=未开始）
      leisureT: -1,          // 当前活动剩余秒数（<0 = 刚到达未开始）
      leisureSub: null,      // 活动子状态（read 翻页 / look_out 抬头 / exercise 动作 / phone 姿势）
      leisureSubT: 0,        // 子状态计时
      phoneNext: null,       // phone 待切换姿势（先坐起过渡）
      arriveT: 0,            // 到达后坐下过渡计时
      // ---- 夜间活动 ----
      nightPlan: null,       // 本夜活动计划 {items:[{atMin,type}], idx}
      nightAct: null,        // 当前夜间活动 null|toilet|drink|snack|phoneToss
      nightActT: 0,
      // ---- 吉他弹唱 ----
      guitar: null           // 弹唱会话 {phase, t, tMax, song, line, lineT, taken}
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

  // ============================================================
  // 休闲活动子状态机（19:00-22:00）
  // ============================================================

  // 带权随机选择下一项活动（不能与当前相同；21:30 后健身概率降至 5%；
  // 猫睡觉时不会选 play_cat，其权重转给 read/phone）
  function pickLeisure() {
    const tp = P.Time.now();
    const h = tp.hour;
    let exW = 26;                       // 19:00-21:00 健身概率高
    if (h >= 21.5) exW = 5;
    else if (h >= 21) exW = 12;
    const catSleep = P.Cat && P.Cat.isSleeping ? P.Cat.isSleeping() : false;
    const w = {
      game: 20, read: 18, exercise: exW,
      play_cat: catSleep ? 0 : 16,
      look_out: 7, phone: 18
    };
    if (catSleep) { w.read += 8; w.phone += 8; }   // 猫睡觉 → 改为 read 或 phone
    if (char.leisureAct && w[char.leisureAct] !== undefined) w[char.leisureAct] = 0;
    let total = 0;
    for (const k in w) total += w[k];
    let roll = Math.random() * total;
    for (const k in w) { roll -= w[k]; if (roll <= 0) return k; }
    return 'read';
  }

  // 活动时长：look_out 10-30 秒；其余 5-20 分钟（可调试加速）
  function leisureDuration(id) {
    if (id === 'look_out') return (10 + Math.random() * 20) * LEISURE_SCALE;
    return (5 + Math.random() * 15) * 60 * LEISURE_SCALE;
  }

  // 开始一项活动：走到对应区域（不瞬移），到达后开始计时
  function goToLeisure(id) {
    if (char.leisureAct === 'play_cat' && P.Cat && P.Cat.endPlay) P.Cat.endPlay();
    char.leisureAct = id;
    char.leisureT = -1;                 // 标记"尚未到达开始"
    char.leisureSub = null; char.leisureSubT = 0;
    char.phoneNext = null;
    const sp = LEISURE_SPOTS[id];
    char.target = { room: sp.room, x: sp.x, pose: id };
    char.moving = true;
  }

  // 进入活动后的初始子状态
  function initLeisureSub(id) {
    switch (id) {
      case 'read':     char.leisureSub = 'open'; char.leisureSubT = 3 + Math.random() * 2; break;
      case 'look_out': char.leisureSub = 'look'; char.leisureSubT = 5 + Math.random() * 3; break;
      case 'exercise': char.leisureSub = pickRoutine(null); char.leisureSubT = 30 + Math.random() * 30; break;
      case 'phone':    char.leisureSub = 'sit'; char.leisureSubT = 120 + Math.random() * 60; break;
      default:         char.leisureSub = null; char.leisureSubT = 0; break;
    }
  }

  // 健身动作随机（不连续重复）
  function pickRoutine(cur) {
    const list = ['squat', 'pushup', 'jumpjack'];
    const rest = list.filter(function (r) { return r !== cur; });
    return rest[(Math.random() * rest.length) | 0];
  }
  // 手机姿势随机（不连续重复）
  function pickPhonePosture(cur) {
    const list = ['sit', 'lie', 'prone'];
    const rest = list.filter(function (p) { return p !== cur; });
    return rest[(Math.random() * rest.length) | 0];
  }

  // 子状态推进：翻页 / 抬头 / 动作轮换 / 姿势切换
  function updateLeisureSub(dt) {
    char.leisureSubT -= dt;
    if (char.leisureSubT > 0) return;
    switch (char.leisureAct) {
      case 'read':
        if (char.leisureSub === 'flip') { char.leisureSub = 'open'; char.leisureSubT = 3 + Math.random() * 2; }
        else { char.leisureSub = 'flip'; char.leisureSubT = 0.5; }
        break;
      case 'look_out':
        if (char.leisureSub === 'lift') { char.leisureSub = 'look'; char.leisureSubT = 5 + Math.random() * 3; }
        else { char.leisureSub = 'lift'; char.leisureSubT = 1.5; }
        break;
      case 'exercise':
        char.leisureSub = pickRoutine(char.leisureSub);
        char.leisureSubT = 30 + Math.random() * 30;
        break;
      case 'phone': {
        if (char.phoneNext) {
          char.leisureSub = char.phoneNext;
          char.leisureSubT = 120 + Math.random() * 60;
          char.phoneNext = null;
        } else {
          // 先坐起 0.6s 作为过渡，再躺下/趴下
          char.phoneNext = pickPhonePosture(char.leisureSub);
          char.leisureSub = 'sit';
          char.leisureSubT = 0.6;
        }
        break;
      }
    }
  }

  // 休闲主逻辑：切换活动（走到对应位置）→ 计时 → 结束随机换下一项
  function leisureUpdate(dt) {
    if (!char.leisureAct) {
      goToLeisure(pickLeisure());
      return;
    }
    if (!char.moving && char.pose !== 'walk') {
      if (char.leisureT < 0) {
        // 刚到达：开始活动
        char.leisureT = leisureDuration(char.leisureAct);
        initLeisureSub(char.leisureAct);
        if (char.leisureAct === 'play_cat' && P.Cat && P.Cat.playWithHuman) P.Cat.playWithHuman();
      } else {
        char.leisureT -= dt;
        if (char.leisureT <= 0) goToLeisure(pickLeisure());
      }
    }
    updateLeisureSub(dt);
  }

  // ============================================================
  // 夜间活动（睡觉中偶尔起夜，70% 概率整夜无活动）
  // ============================================================

  // 本夜活动计划：70% 整夜无活动；其余 30% 生成 1-3 个活动。
  // 活动类型采用相对权重 20:15:10:30（厕所/喝水/夜宵/手机翻身）。
  function makeNightPlan() {
    if (Math.random() < 0.7) return { items: [], idx: 0 };
    const n = 1 + ((Math.random() * 3) | 0);
    const items = [];
    for (let i = 0; i < n; i++) {
      let roll = Math.random() * 75;
      let type = 'toilet';
      if ((roll -= 20) <= 0) type = 'toilet';
      else if ((roll -= 15) <= 0) type = 'drink';
      else if ((roll -= 10) <= 0) type = 'snack';
      else type = 'phoneToss';
      // 活动时刻用"入睡后经过的分钟数"（入睡 = 22.5），天然跨零点：
      // 23:12 ~ 次日 06:48 对应 42 ~ 498 分钟
      const h = 23.2 + Math.random() * 7.6;
      items.push({ atElapsed: (h - 22.5) * 60, type: type });
    }
    items.sort(function (a, b) { return a.atElapsed - b.atElapsed; });
    return { items: items, idx: 0 };
  }

  function startNightAct(type) {
    char.nightAct = type;
    switch (type) {
      case 'toilet':
        char.target = { room: 2, x: 212, pose: 'toilet' };
        char.nightActT = 45 + Math.random() * 45;
        break;
      case 'drink':
        char.target = { room: 3, x: 262, pose: 'breakDrink' };
        char.nightActT = 30 + Math.random() * 40;
        break;
      case 'snack':
        char.target = { room: 3, x: 248, pose: 'eat' };
        char.nightActT = 60 + Math.random() * 60;
        break;
      case 'phoneToss':
        // 留在床上玩手机/翻身
        char.nightActT = 120 + Math.random() * 180;
        break;
    }
    char.moving = true;
  }

  function nightUpdate(dt) {
    const tp = P.Time.now();
    if (char.activity === 'sleep') {
      if (char.nightPlan === null) char.nightPlan = makeNightPlan();
      if (char.nightAct === null && char.pose === 'sleep') {
        const plan = char.nightPlan;
        if (plan && plan.idx < plan.items.length) {
          const it = plan.items[plan.idx];
          // 入睡(22.5)后经过的分钟数（跨零点加 24h）
          let elapsed = tp.hour - 22.5;
          if (elapsed < 0) elapsed += 24;
          if (elapsed * 60 >= it.atElapsed) {
            plan.idx++;
            startNightAct(it.type);
          }
        }
      }
    }
    if (char.nightAct) {
      if (char.nightAct === 'phoneToss') {
        char.nightActT -= dt;
        if (char.nightActT <= 0) char.nightAct = null;   // 直接继续睡
      } else if (!char.moving && char.pose !== 'walk') {
        char.nightActT -= dt;
        if (char.nightActT <= 0) {
          char.nightAct = null;
          // 回到床上继续睡（不影响 07:30 起床）
          char.target = { room: 0, x: 24, pose: 'sleep' };
          char.moving = true;
        }
      }
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

    // 吉他弹唱：暂停日常行为，专用状态机负责移动与歌词
    if (char.guitar) {
      guitarUpdate(dt);
      char.animT += dt;
      return;
    }

    // 活动切换 → 新的目标
    if (act !== char.activity) {
      const prev = char.activity;
      char.activity = act;
      char.washPhase = tp.hour >= 22 ? 'shower' : 'brush';
      char.react = null;
      char.mealFood = null;
      // 离开休闲：结束逗猫、清空休闲状态
      if (prev === 'leisure') {
        if (char.leisureAct === 'play_cat' && P.Cat && P.Cat.endPlay) P.Cat.endPlay();
        char.leisureAct = null;
      }
      // 离开睡觉：夜间计划作废（下一晚重新掷）
      if (prev === 'sleep') {
        char.nightPlan = null;
        char.nightAct = null;
      }
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
      } else if (act === 'leisure') {
        // 休闲：具体活动与目标由休闲状态机决定（本帧 leisureUpdate 即开始）
        char.washSeq = null;
        char.fridgePhase = null;
        char.leisureAct = null;
        char.leisureT = -1;
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
        char.dir = t.pose === 'work' ? -1 : (LEISURE_SPOTS[t.pose] ? LEISURE_SPOTS[t.pose].dir : 1);
        if (LEISURE_SPOTS[t.pose]) char.arriveT = 0.5;   // 坐下/转身过渡
      } else {
        char.x += Math.sign(dx) * Math.min(Math.abs(dx), 15 * dt);
        char.dir = Math.sign(dx) || char.dir;
        char.walkStep += dt * 9;
        char.pose = 'walk';
      }
    }

    // 休闲活动子状态机 + 夜间活动
    if (char.activity === 'leisure') leisureUpdate(dt);
    nightUpdate(dt);
    if (char.arriveT > 0) char.arriveT -= dt;

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
    const m = mode || getScreenMode();
    return C.SCREEN_MODE_NAMES[m] || '';
  }
  // 休闲打游戏时屏幕显示"游戏画面"（供 roomLayout 绘制显示器内容）
  function getScreenMode() {
    if (char && char.activity === 'leisure' && char.leisureAct === 'game') return 'game';
    return screenMode;
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
  // 吉他弹唱（点击卧室吉他触发）
  // 流程：go（走到吉他旁 x=64）→ pick（抱起，吉他离开墙面）→
  //       carry（抱着吉他走到床边 x=27）→ sit（坐下）→
  //       sing（逐句歌词）→ put（床边放下）→ back（抱回吉他位）→
  //       place（靠墙放回，墙上吉他恢复）→ 结束恢复触发前行为
  // ============================================================
  const GUITAR_PICK_X = 64;   // 走到吉他旁的位置（吉他在 x=68-76，站在其左侧）
  const GUITAR_BED_X = 27;    // 床边坐下的位置（与 read/phone 同侧）

  // 随机选歌：不连续重复同一首（平均权重；后续可扩展 weight 加权 / 播放次数偏好）
  let lastSongId = null;
  let lastSongTime = null;
  function chooseSong() {
    let available = P.Songs.filter(function (s) { return s.id !== lastSongId; });
    if (available.length === 0) available = P.Songs;
    const song = available[Math.floor(Math.random() * available.length)];
    lastSongId = song.id;
    lastSongTime = Date.now();
    return song;
  }

  // 由 interaction 调用：ok | sleep | busy
  // 触发条件：除睡在床上外（00:00–07:30 及 22:30–24:00 睡觉时段），
  // 洗漱/吃饭/工作/休闲/夜间活动等时段均可触发；弹唱中不可重复触发
  function startGuitar() {
    if (!char) return 'busy';
    if (char.guitar) return 'busy';                       // 已在弹唱
    if (char.pose === 'sleep') return 'sleep';            // 睡在床上不可弹
    // 触发前状态快照（用于弹唱后恢复）；先快照再清理
    const restoreAct = char.activity === 'leisure' ? char.leisureAct : null;
    // 结束正在进行的逗猫（若在逗猫），避免猫陷入 play 状态
    if (char.leisureAct === 'play_cat' && P.Cat && P.Cat.endPlay) P.Cat.endPlay();
    char.leisureAct = null;
    char.react = null;
    char.guitar = {
      phase: 'go',
      t: 0, tMax: 0,
      song: chooseSong(),
      line: 0, lineT: 0,
      taken: false,         // 是否已"抱起"（墙上吉他隐藏）
      notes: [],            // 像素音符 {x,y,born}
      restore: { activity: char.activity, leisureAct: restoreAct }
    };
    char.target = { room: 0, x: GUITAR_PICK_X, pose: 'sing' };
    char.moving = true;
    return 'ok';
  }

  // 弹唱专用移动（不依赖正常 update 的移动分支）
  function moveToward(x, pose, dt) {
    const dx = x - char.x;
    if (Math.abs(dx) < 0.6) {
      char.moving = false;
      char.x = x;
      if (pose) char.pose = pose;
      if (pose === 'sing') char.dir = 1;   // 坐床边弹唱固定面朝右（与绘制一致）
      return true;
    }
    char.x += Math.sign(dx) * Math.min(Math.abs(dx), 15 * dt);
    char.dir = Math.sign(dx) || char.dir;
    char.walkStep += dt * 9;
    char.pose = 'walk';
    char.moving = true;
    return false;
  }

  // 每句歌词固定的拨弦频率（由歌 id + 行号确定，稳定可复现）
  function pluckFreq(song, line) {
    let seed = 0;
    for (let i = 0; i < song.id.length; i++) seed += song.id.charCodeAt(i) * (i + 3);
    seed += line * 7;
    const scale = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 349.2, 587.3];
    return scale[seed % scale.length];
  }

  // 每句开始时：更新 DOM 歌词面板 + 弹出 1-2 个像素音符（随机左右偏移），音符由 drawSing 绘制漂浮淡出
  function showLine() {
    const g = char.guitar;
    if (P.UI && P.UI.showLyric) P.UI.showLyric(g.song.title, g.song.lyrics[g.line]);
    const t = performance.now() / 1000;
    g.notes = (g.notes || []).filter(function (x) { return t - x.born < 0.6; });
    const n = 1 + ((Math.random() * 2) | 0);
    for (let i = 0; i < n; i++) {
      g.notes.push({
        x: Math.round(char.x - 10 + Math.random() * 8),
        y: 80 - Math.round(Math.random() * 4),
        born: t + i * 0.15
      });
    }
  }

  function guitarUpdate(dt) {
    const g = char.guitar;
    g.t += dt;
    if (char.arriveT > 0) char.arriveT -= dt;
    switch (g.phase) {
      case 'go':            // 走向吉他（x=64）
        if (!moveToward(GUITAR_PICK_X, 'sing', dt)) break;
        g.phase = 'pick'; g.t = 0; g.tMax = 0.8;
        break;
      case 'pick':          // 抱起吉他
        if (g.t >= g.tMax) {
          g.taken = true;   // 墙上吉他隐藏（staticSignature 变化 → 缓存重建）
          g.phase = 'carry';
          char.target = { room: 0, x: GUITAR_BED_X, pose: 'sing' };
          char.moving = true;
        }
        break;
      case 'carry':         // 抱着吉他走到床边（x=27）
        if (!moveToward(GUITAR_BED_X, 'sing', dt)) break;
        g.phase = 'sit'; g.t = 0; g.tMax = 0.5;
        char.arriveT = 0.5;   // 坐下过渡
        break;
      case 'sit':           // 坐下
        if (g.t >= g.tMax) {
          g.phase = 'sing';
          g.t = 0;
          g.tMax = g.song.tempo * g.song.lyrics.length + g.song.endHold;  // 总时长动态计算
          g.line = 0; g.lineT = 0;
          showLine();
          if (P.Audio && P.Audio.guitar) P.Audio.guitar();   // 起手扫弦
        }
        break;
      case 'sing': {        // 逐句弹唱
        g.lineT += dt;
        const isLast = g.line >= g.song.lyrics.length - 1;
        const lineDur = isLast ? g.song.tempo + g.song.endHold : g.song.tempo;
        if (!isLast && g.lineT >= lineDur) {
          g.line++;
          g.lineT = 0;
          showLine();
          if (P.Audio && P.Audio.pluck) P.Audio.pluck(pluckFreq(g.song, g.line));
        }
        if (g.t >= g.tMax) {
          g.phase = 'put'; g.t = 0; g.tMax = 0.6;
        }
        break;
      }
      case 'put':           // 床边放下吉他（起身）
        if (g.t >= g.tMax) {
          g.phase = 'back';
          char.target = { room: 0, x: GUITAR_PICK_X, pose: 'sing' };
          char.moving = true;
        }
        break;
      case 'back':          // 抱着吉他走回吉他位（x=64）
        if (!moveToward(GUITAR_PICK_X, 'sing', dt)) break;
        g.phase = 'place'; g.t = 0; g.tMax = 0.8;
        g.taken = false;    // 墙上吉他恢复显示（staticSignature 变化 → 缓存重建）
        break;
      case 'place':         // 靠墙放回
        if (g.t >= g.tMax) {
          finishGuitar();
        }
        break;
    }
  }

  function finishGuitar() {
    const restore = char.guitar ? char.guitar.restore : null;
    char.guitar = null;       // 吉他已由小人放回原处（taken 随 guitar 清除）
    char.react = null;
    if (P.UI && P.UI.hideLyric) P.UI.hideLyric();   // 收起歌词面板
    const tp = P.Time.now();
    const act = P.Time.getSchedule(tp).id;
    if (restore && act === restore.activity && act === 'leisure' && restore.leisureAct) {
      // 同段休闲：恢复触发前的休闲活动（走回原位继续）
      char.activity = 'leisure';
      goToLeisure(restore.leisureAct);
    } else {
      // 其余情况（含跨时段/洗漱/吃饭/工作等短时行为）：按当前时段重新调度
      char.activity = '__guitar_done';
      char.target = { room: 1, x: 147, pose: 'idle' };
      char.moving = true;
    }
  }

  function guitarActive() { return !!(char && char.guitar); }
  function guitarSong() { return (char && char.guitar) ? char.guitar.song : null; }
  function guitarTaken() { return !!(char && char.guitar && char.guitar.taken); }

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

    // 吉他弹唱（优先级最高）
    if (char.guitar) { drawSinging(ctx, hx, d, o, t); return; }

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
    if (pose === 'brush') { drawBrush(ctx, hx, o, t); return; }
    if (pose === 'breakDrink') { drawDrink(ctx, hx, o, t); return; }

    // ---- 休闲活动 ----
    if (pose === 'game') { drawGame(ctx, hx, o, t); return; }
    if (pose === 'read') { drawRead(ctx, hx, o, t); return; }
    if (pose === 'exercise') { drawExercise(ctx, hx, o, t); return; }
    if (pose === 'play_cat') { drawPlayCat(ctx, hx, o, t); return; }
    if (pose === 'look_out') { drawLookOut(ctx, hx, o, t); return; }
    if (pose === 'phone') { drawPhone(ctx, hx, o, t); return; }

    // 旧版休闲（床边玩手机）保留兜底
    if (pose === 'leisure') { drawLeisure(ctx, hx, o, t); return; }
    drawStand(ctx, hx, d, o, t);
  }

  // 坐下过渡：到达休闲位后前 0.5s 身体轻微下沉（坐下的过渡动画）
  function sitEase() {
    if (char.arriveT <= 0) return 0;
    const k = Math.max(0, Math.min(1, char.arriveT / 0.5));
    return Math.round(k * 2);   // 2px → 0
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

  // ============================================================
  // 休闲活动绘制
  // ============================================================

  // 打游戏：坐姿，双手交替敲键盘 + 鼠标移动（屏幕游戏画面由 roomLayout 绘制）
  function drawGame(ctx, hx, o, t) {
    const st = sitEase();
    ctx.fillStyle = o.pants;
    ctx.fillRect(hx - 8, 118 + st, 10, 4);
    ctx.fillRect(hx - 8, 122 + st, 3, 6);
    ctx.fillRect(hx - 4, 118 + st, 3, 6);
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(hx - 8, 126, 3, 2);
    ctx.fillRect(hx - 4, 126, 3, 2);
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx - 4, 106 + st, 8, 13);
    drawFolds(ctx, hx, 106 + st, o.shirt);
    // 双手交替按键（相位错开）
    const k1 = Math.round(Math.sin(t * 13) * 1.2);
    const k2 = Math.round(Math.sin(t * 13 + 2.2) * 1.2);
    ctx.fillRect(hx - 13, 108 + k1, 10, 2);        // 左手
    ctx.fillRect(hx - 4, 110 - k2, 2, 7);          // 右手
    // 按键闪光
    if (Math.floor(t * 10) % 2 === 0) {
      ctx.fillStyle = '#7ad8ff';
      ctx.fillRect(hx - 12, 106, 1, 1);
    }
    // 鼠标（右侧，手滑动）
    const mx = Math.round(Math.sin(t * 4) * 2);
    ctx.fillStyle = '#3a3a46';
    ctx.fillRect(hx + 5 + mx, 109, 3, 2);
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx + 4 + mx, 106, 2, 4);
    ctx.fillStyle = SKIN;
    ctx.fillRect(hx + 4 + mx, 105, 2, 1);
    drawHead(ctx, hx - 7, 95, -1);
  }

  // 看书：坐床边捧书，每 3-5 秒翻一页（页角掀起），头部微动
  function drawRead(ctx, hx, o, t) {
    const st = sitEase();
    const bob = Math.round(Math.sin(t * 1.2) * 0.4);
    ctx.fillStyle = o.pants;
    ctx.fillRect(hx + 2, 112 + st, 6, 5);
    ctx.fillRect(hx + 5, 117 + st, 3, 11);
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(hx + 5, 126, 3, 2);
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx - 4, 100 + st, 8, 13);
    drawFolds(ctx, hx, 100 + st, o.shirt);
    // 书（翻页由 leisureSub 控制）
    ctx.fillStyle = '#8a5a4a';
    ctx.fillRect(hx - 6, 98 + st, 10, 6);
    ctx.fillStyle = '#6e4638';
    ctx.fillRect(hx - 1, 98 + st, 1, 6);          // 书脊
    ctx.fillStyle = '#f5ead2';
    ctx.fillRect(hx - 5, 99 + st, 4, 4);          // 左页
    if (char.leisureSub === 'flip') {
      // 翻页：右页页角掀起 1-2px（书页像素翻动）
      const lift = Math.min(3, Math.floor((0.5 - char.leisureSubT) * 6));
      ctx.fillRect(hx + 1, 99 + st + lift, 4, 4 - lift);
      ctx.fillStyle = '#e8d8bc';
      ctx.fillRect(hx + 1, 99 + st, 4, 1);
      ctx.fillRect(hx + 1, 99 + st + 4 - lift, 1, lift);
    } else {
      ctx.fillRect(hx + 1, 99 + st, 4, 4);        // 右页
    }
    // 文字行
    ctx.fillStyle = 'rgba(60,40,30,0.6)';
    ctx.fillRect(hx - 4, 100 + st, 2, 1);
    ctx.fillRect(hx + 2, 100 + st, 2, 1);
    ctx.fillRect(hx + 2, 102 + st, 2, 1);
    // 捧书手臂
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx - 6, 101 + st, 2, 5);
    ctx.fillRect(hx + 3, 101 + st, 2, 5);
    ctx.fillStyle = SKIN;
    ctx.fillRect(hx - 6, 105 + st, 1, 1);
    ctx.fillRect(hx + 4, 105 + st, 1, 1);
    drawHead(ctx, hx - 7, 89 + bob, 1);
  }

  // ============================================================
  // 吉他弹唱绘制（按阶段分派）
  // ============================================================
  function drawSinging(ctx, hx, d, o, t) {
    const g = char.guitar;
    switch (g.phase) {
      case 'go':    drawWalk(ctx, hx, d, o, t); return;                  // 走向吉他
      case 'pick':  drawPickGuitar(ctx, hx, o, t); return;               // 抱起吉他
      case 'carry': drawCarryGuitar(ctx, hx, d, o, t); return;           // 抱着吉他走向床边
      case 'put':   drawPutGuitar(ctx, hx, o, t); return;                // 床边放下
      case 'back':  drawCarryGuitar(ctx, hx, d, o, t); return;           // 抱着吉他走回吉他位
      case 'place': drawPickGuitar(ctx, hx, o, t); return;               // 靠墙放回（墙上吉他已恢复）
      default:      drawSing(ctx, hx, o, t); return;                     // sit / sing 坐姿弹唱
    }
  }

  // 站在吉他旁，伸手抱起吉他（吉他仍在墙上，pick 结束才隐藏）
  function drawPickGuitar(ctx, hx, o, t) {
    drawStandBody(ctx, hx, o);
    const k = Math.min(1, char.guitar.t / char.guitar.tMax);   // 0→1 伸手
    // 手臂伸向右侧墙上吉他
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx + 3, 108, 2, 4);
    ctx.fillRect(hx + 4, 110, 2, 3 + Math.round(k * 3));
    ctx.fillStyle = SKIN;
    ctx.fillRect(hx + 5, 113 + Math.round(k * 3), 2, 2);       // 手
    drawHead(ctx, hx - 6, 95, 1);
  }

  // 抱着吉他走向床边（竖抱在身体右侧，随步伐轻颠）
  function drawCarryGuitar(ctx, hx, d, o, t) {
    drawWalk(ctx, hx, d, o, t);
    const bob = Math.abs(Math.sin(char.walkStep)) * 1.2;
    ctx.fillStyle = '#c89050';
    ctx.fillRect(hx + 5, 104 - bob, 4, 6);                     // 琴体
    ctx.fillStyle = '#e8b878';
    ctx.fillRect(hx + 6, 105 - bob, 2, 2);                     // 面板高光
    ctx.fillStyle = '#1c1008';
    ctx.fillRect(hx + 6, 107 - bob, 2, 2);                     // 音孔
    ctx.fillStyle = '#4a3320';
    ctx.fillRect(hx + 6, 98 - bob, 2, 6);                      // 琴颈
    ctx.fillStyle = '#2e2218';
    ctx.fillRect(hx + 6, 95 - bob, 2, 3);                      // 琴头
    ctx.fillStyle = '#f5ead2';
    ctx.fillRect(hx + 6, 98 - bob, 1, 10);                     // 琴弦
    ctx.fillRect(hx + 7, 98 - bob, 1, 10);
  }

  // 坐床边弹唱（面朝右，怀抱吉他）
  // 动画：身体/头部左右摇摆 1px·1Hz；左手随每句歌词在琴颈换把位；
  //       右手拨弦 2Hz 上下交替；嘴巴每 0.5s 开合；眼睛微闭；
  //       头顶上方 16-20px 歌词气泡（淡入淡出）+ 每句弹出像素音符漂浮
  function drawSing(ctx, hx, o, t) {
    const g = char.guitar;
    const st = sitEase();
    const swayX = Math.round(Math.sin(t * Math.PI * 2) * 0.5);   // 1px·1Hz 左右摇摆
    const bx = hx + swayX;
    const headY = 89 + Math.round(Math.sin(t * 1.3) * 0.4);     // 头部轻微浮动
    // 腿（床边坐姿，固定）
    ctx.fillStyle = o.pants;
    ctx.fillRect(hx + 2, 112 + st, 6, 5);
    ctx.fillRect(hx + 5, 117 + st, 3, 11);
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(hx + 5, 126, 3, 2);
    // 躯干（随摇摆）
    ctx.fillStyle = o.shirt;
    ctx.fillRect(bx - 4, 100 + st, 8, 13);
    drawFolds(ctx, bx, 100 + st, o.shirt);
    // 吉他（斜抱：琴体在右腿上，琴颈斜向左上；随节奏轻颠）
    const gy = 107 + st + Math.round(Math.sin(t * 2.4) * 0.5);
    ctx.fillStyle = '#c89050';
    ctx.fillRect(bx + 1, gy, 6, 7);                              // 琴体
    ctx.fillStyle = '#e8b878';
    ctx.fillRect(bx + 2, gy + 1, 4, 2);                          // 面板高光
    ctx.fillStyle = '#1c1008';
    ctx.fillRect(bx + 3, gy + 3, 2, 2);                          // 音孔
    ctx.fillStyle = '#4a3320';
    for (let i = 0; i < 7; i++) ctx.fillRect(bx + 3 - i, gy - 1 - i, 2, 1);  // 琴颈（阶梯）
    ctx.fillStyle = '#2e2218';
    ctx.fillRect(bx - 6, gy - 9, 3, 2);                          // 琴头
    ctx.fillStyle = '#f5ead2';
    ctx.fillRect(bx + 3, gy + 1, 1, 3);                          // 琴弦
    ctx.fillRect(bx + 5, gy + 1, 1, 3);
    // 右手拨弦（音孔下方，2Hz 上下交替）
    const hand = Math.round(Math.sin(t * Math.PI * 4) * 0.8);
    ctx.fillStyle = SKIN;
    ctx.fillRect(bx + 5, gy + 5 + hand, 2, 1);
    // 左手按弦（随歌词每句在琴颈上下换把位）
    const fret = g.line % 3;
    ctx.fillStyle = SKIN;
    ctx.fillRect(bx + 3 - fret, gy - 2 - fret, 2, 1);
    // 头（随身体摇摆，微闭眼唱歌）
    drawHead(ctx, bx - 7, headY, 1);
    // 闭眼（微闭）
    ctx.fillStyle = '#5a4030';
    ctx.fillRect(bx - 4, headY + 7, 2, 1);
    ctx.fillRect(bx, headY + 7, 2, 1);
    // 嘴巴（每 0.5s 开合）
    const mouthOpen = Math.floor(t * 2) % 2 === 0;
    if (mouthOpen) {
      ctx.fillStyle = '#5a3020';
      ctx.fillRect(bx - 3, headY + 8, 2, 2);
    } else {
      ctx.fillStyle = '#c47a5a';
      ctx.fillRect(bx - 3, headY + 9, 2, 1);
    }
    // 像素音符漂浮（歌词文字改由 DOM #lyric-box 显示）
    drawSingNotes(ctx, bx, t);
  }

  // 像素音符：每句开始弹出 1-2 个（showLine 生成），向上漂浮 4-6px，约 0.5s 淡出
  function drawSingNotes(ctx, hx, t) {
    const g = char.guitar;
    if (!g) return;
    const notes = g.notes || [];
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      const age = t - n.born;
      if (age < 0 || age > 0.55) continue;
      const k = age / 0.5;
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.fillStyle = '#ffd98a';
      const ny = n.y - Math.round(k * 6);
      ctx.fillRect(n.x, ny, 2, 1);         // 符头
      ctx.fillRect(n.x + 1, ny - 2, 1, 2); // 符干
      ctx.fillRect(n.x + 2, ny - 2, 1, 1); // 符尾
      ctx.globalAlpha = 1;
    }
  }

  // 放下吉他（坐姿，琴放低至腿边，手松开）
  function drawPutGuitar(ctx, hx, o, t) {
    const st = sitEase();
    ctx.fillStyle = o.pants;
    ctx.fillRect(hx + 2, 112 + st, 6, 5);
    ctx.fillRect(hx + 5, 117 + st, 3, 11);
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(hx + 5, 126, 3, 2);
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx - 4, 100 + st, 8, 13);
    drawFolds(ctx, hx, 100 + st, o.shirt);
    // 吉他放低（比弹唱时低 3px）
    const gy = 110 + st;
    ctx.fillStyle = '#c89050';
    ctx.fillRect(hx + 1, gy, 6, 6);
    ctx.fillStyle = '#1c1008';
    ctx.fillRect(hx + 3, gy + 2, 2, 2);
    ctx.fillStyle = '#4a3320';
    ctx.fillRect(hx + 4, gy - 1, 2, 3);                        // 琴颈短斜
    ctx.fillStyle = SKIN;
    ctx.fillRect(hx + 5, gy + 4, 2, 1);                        // 手松开
    drawHead(ctx, hx - 7, 89, 1);
  }

  // 健身：深蹲 / 俯卧撑 / 开合跳（由 leisureSub 轮换，每 30-60 秒换动作）
  function drawExercise(ctx, hx, o, t) {
    if (char.leisureSub === 'squat') { drawExSquat(ctx, hx, o, t); return; }
    if (char.leisureSub === 'pushup') { drawExPushup(ctx, hx, o, t); return; }
    drawExJack(ctx, hx, o, t);
  }

  // 深蹲：身体下沉回升 + 腿微开
  function drawExSquat(ctx, hx, o, t) {
    const ph = (t % 1.7) / 1.7;
    const down = ph < 0.5 ? ph * 2 : (1 - (ph - 0.5) * 2);
    const dy = Math.round(down * 3);
    const spread = Math.round(down * 3);
    ctx.fillStyle = o.pants;
    ctx.fillRect(hx - 5 + spread, 113, 3, 13 + dy);
    ctx.fillRect(hx + 2 - spread, 113, 3, 13 + dy);
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(hx - 5 + spread, 126, 3, 2);
    ctx.fillRect(hx + 2 - spread, 126, 3, 2);
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx - 4, 104 + dy, 8, 12);
    drawFolds(ctx, hx, 104 + dy, o.shirt);
    // 手臂前平举
    ctx.fillRect(hx - 8, 105 + dy, 2, 7);
    ctx.fillRect(hx + 6, 105 + dy, 2, 7);
    ctx.fillStyle = SKIN;
    ctx.fillRect(hx - 8, 111 + dy, 2, 1);
    ctx.fillRect(hx + 6, 111 + dy, 2, 1);
    drawHead(ctx, hx - 6, 93 + dy, 1);
  }

  // 俯卧撑：身体水平起伏
  function drawExPushup(ctx, hx, o, t) {
    const ph = (t % 1.3) / 1.3;
    const up = ph < 0.5 ? ph * 2 : (1 - (ph - 0.5) * 2);
    const dy = Math.round(up * 2);
    // 头（朝下看地面）
    ctx.fillStyle = HAIR;
    ctx.fillRect(hx - 12, 117 - dy, 6, 2);
    ctx.fillStyle = SKIN;
    ctx.fillRect(hx - 12, 119 - dy, 5, 2);
    // 身体（水平）
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx - 7, 121 - dy, 13, 4);
    ctx.fillStyle = o.pants;
    ctx.fillRect(hx - 7, 125 - dy, 13, 2);
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(hx - 7, 126, 2, 1);
    ctx.fillRect(hx + 4, 126, 2, 1);
    // 手臂撑地（屈伸）
    const bend = up ? 0 : 1;
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx + 3, 119 - dy, 2, 6 + bend);
    ctx.fillRect(hx + 5, 122 - dy + bend, 3, 4);
    // 汗滴
    if (Math.floor(t * 3) % 3 === 0) {
      ctx.fillStyle = 'rgba(150,210,255,0.9)';
      ctx.fillRect(hx - 9, 114 - dy, 1, 1);
    }
  }

  // 开合跳：手臂/腿部开合 + 起跳离地
  function drawExJack(ctx, hx, o, t) {
    const ph = (t % 0.9) / 0.9;
    const open = ph < 0.5;
    const hop = (ph < 0.25 || ph > 0.75) ? 1 : 0;
    const sp = open ? 4 : 0;
    ctx.fillStyle = o.pants;
    ctx.fillRect(hx - 5 - sp, 116 - hop, 3, 10 + hop);
    ctx.fillRect(hx + 2 + sp, 116 - hop, 3, 10 + hop);
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(hx - 5 - sp, 126, 3, 2);
    ctx.fillRect(hx + 2 + sp, 126, 3, 2);
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx - 4, 105 - hop, 8, 12);
    drawFolds(ctx, hx, 105 - hop, o.shirt);
    // 手臂：打开上举 / 并拢放下
    const armY = open ? 94 - hop : 106 - hop;
    ctx.fillRect(hx - 6, armY, 2, 11);
    ctx.fillRect(hx + 4, armY, 2, 11);
    ctx.fillStyle = SKIN;
    ctx.fillRect(hx - 6, armY, 1, 2);
    ctx.fillRect(hx + 5, armY, 1, 2);
    drawHead(ctx, hx - 6, 94 - hop, 1);
  }

  // 逗猫：站立挥动逗猫棒（猫追棒子扑跳，由 cat.js 处理）
  function drawPlayCat(ctx, hx, o, t) {
    ctx.fillStyle = o.pants;
    ctx.fillRect(hx - 4, 116, 3, 12);
    ctx.fillRect(hx + 1, 116, 3, 12);
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(hx - 4, 126, 3, 2);
    ctx.fillRect(hx + 1, 126, 3, 2);
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx - 4, 106, 8, 12);
    drawFolds(ctx, hx, 106, o.shirt);
    // 手臂挥棒
    const sw = Math.round(Math.sin(t * 3.2) * 5);
    const sy = Math.round(Math.sin(t * 2.7) * 3);
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx + 3, 104 + sy, 2, 9);
    // 逗猫棒：杆 + 顶端羽毛（随摆动左右移动）
    ctx.fillStyle = '#8a6a4a';
    ctx.fillRect(hx + 4, 96 + sy, 1, 10);
    ctx.fillStyle = '#c85a6a';
    ctx.fillRect(hx + 2 + sw, 92 + sy, 4, 3);
    ctx.fillStyle = '#e88a9a';
    ctx.fillRect(hx + 3 + sw, 93 + sy, 2, 1);
    ctx.fillStyle = '#a04858';
    ctx.fillRect(hx + 5 + sw, 91 + sy, 1, 1);
    drawHead(ctx, hx - 6, 95, 1);
  }

  // 发呆看窗外：站立微晃，偶尔抬头 1.5 秒
  function drawLookOut(ctx, hx, o, t) {
    const sway = Math.round(Math.sin(t * 1.1) * 0.6);
    const lifting = char.leisureSub === 'lift';
    ctx.fillStyle = o.pants;
    ctx.fillRect(hx - 4, 116, 3, 12);
    ctx.fillRect(hx + 1, 116, 3, 12);
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(hx - 4, 126, 3, 2);
    ctx.fillRect(hx + 1, 126, 3, 2);
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx - 4, 106, 8, 12);
    drawFolds(ctx, hx, 106, o.shirt);
    // 手臂垂放微晃
    ctx.fillRect(hx - 5, 108 + sway, 2, 7);
    ctx.fillRect(hx + 3, 108 - sway, 2, 7);
    // 头：平视 / 偶尔抬头（面朝窗外 dir=-1）
    const headY = lifting ? 92 : 95 + sway;
    drawHead(ctx, hx - 6, headY, -1);
  }

  // 玩手机：躺/坐/趴 三姿势随机切换（每 2-3 分钟），滑动屏幕 + 屏幕光映脸
  function drawPhone(ctx, hx, o, t) {
    if (char.leisureSub === 'lie') { drawPhoneLie(ctx, o, t); return; }
    if (char.leisureSub === 'prone') { drawPhoneProne(ctx, o, t); return; }
    drawPhoneSit(ctx, hx, o, t);
  }

  // 坐床边玩手机（含滑动动画 + 光映脸）
  function drawPhoneSit(ctx, hx, o, t) {
    const st = sitEase();
    ctx.fillStyle = o.pants;
    ctx.fillRect(hx + 2, 112 + st, 6, 5);
    ctx.fillRect(hx + 5, 117 + st, 3, 11);
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(hx + 5, 126, 3, 2);
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx - 4, 100 + st, 8, 13);
    drawFolds(ctx, hx, 100 + st, o.shirt);
    // 手机（滑动：屏幕光点上下移动）
    const sw = Math.floor(t * 2.2) % 4;
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(hx + 4, 103, 4, 6);
    ctx.fillStyle = '#7ad8ff';
    ctx.fillRect(hx + 5, 104 + sw, 2, 1);
    ctx.fillStyle = '#d8efff';
    ctx.fillRect(hx + 5, 104 + sw, 1, 1);
    ctx.fillStyle = o.shirt;
    ctx.fillRect(hx + 2, 106, 2, 3);       // 拿手机的手
    // 屏幕光映脸
    const glow = ctx.createRadialGradient(hx + 6, 106, 1, hx + 6, 106, 9);
    glow.addColorStop(0, 'rgba(122,216,255,0.30)');
    glow.addColorStop(1, 'rgba(122,216,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(hx - 3, 96, 18, 18);
    drawHead(ctx, hx - 7, 89, 1);
  }

  // 仰躺床上举手机（坐标固定：床 x=8-44）
  function drawPhoneLie(ctx, o, t) {
    // 被子下身体
    ctx.fillStyle = '#5a8fc8';
    ctx.fillRect(20, 112, 20, 8);
    ctx.fillStyle = '#6fa3d8';
    ctx.fillRect(20, 112, 20, 1);
    // 头（枕头上）
    ctx.fillStyle = SKIN;
    ctx.fillRect(12, 101, 7, 6);
    ctx.fillStyle = HAIR;
    ctx.fillRect(11, 100, 8, 4);
    ctx.fillRect(11, 101, 3, 5);
    // 举手机的手臂
    ctx.fillStyle = o.shirt;
    ctx.fillRect(15, 95, 2, 6);
    ctx.fillRect(21, 96, 2, 4);
    // 手机（脸上方，微晃）
    const mx = Math.round(Math.sin(t * 1.6) * 1);
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(17 + mx, 88, 4, 6);
    ctx.fillStyle = '#7ad8ff';
    ctx.fillRect(18 + mx, 89, 2, 3);
    // 屏幕光映脸
    const glow = ctx.createRadialGradient(19 + mx, 91, 1, 19 + mx, 91, 9);
    glow.addColorStop(0, 'rgba(122,216,255,0.35)');
    glow.addColorStop(1, 'rgba(122,216,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(10 + mx, 82, 18, 18);
    // 睁眼
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(14, 103, 1, 1);
    ctx.fillRect(17, 103, 1, 1);
  }

  // 趴床上玩手机（俯卧，脚翘起，屏幕滑动）
  function drawPhoneProne(ctx, o, t) {
    // 小腿翘起 + 脚
    ctx.fillStyle = o.pants;
    ctx.fillRect(30, 106, 3, 8);
    ctx.fillRect(32, 104, 3, 5);
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(32, 104, 2, 2);
    // 身体（趴着）
    ctx.fillStyle = o.shirt;
    ctx.fillRect(14, 112, 16, 6);
    ctx.fillRect(12, 110, 6, 8);
    // 头（朝下看手机）
    ctx.fillStyle = HAIR;
    ctx.fillRect(11, 103, 7, 5);
    ctx.fillStyle = SKIN;
    ctx.fillRect(11, 108, 7, 4);
    // 手机（脸前，滑动）
    const sw = Math.floor(t * 2.4) % 4;
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(15, 96, 4, 6);
    ctx.fillStyle = '#7ad8ff';
    ctx.fillRect(16, 97 + sw, 2, 1);
    // 手臂撑地
    ctx.fillStyle = o.shirt;
    ctx.fillRect(10, 112, 2, 5);
    ctx.fillRect(22, 112, 2, 5);
    // 屏幕光
    const glow = ctx.createRadialGradient(17, 99, 1, 17, 99, 8);
    glow.addColorStop(0, 'rgba(122,216,255,0.30)');
    glow.addColorStop(1, 'rgba(122,216,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(9, 90, 16, 18);
  }

  // 夜间玩手机/翻身：床上坐起，手机光映脸
  function drawNightPhone(ctx, o, t) {
    // 被子
    ctx.fillStyle = '#5a8fc8';
    ctx.fillRect(10, 110, 24, 10);
    ctx.fillStyle = '#6fa3d8';
    ctx.fillRect(10, 110, 24, 1);
    // 坐起的身体
    ctx.fillStyle = o.shirt;
    ctx.fillRect(14, 100, 8, 11);
    ctx.fillStyle = SKIN;
    ctx.fillRect(19, 96, 7, 6);
    ctx.fillStyle = HAIR;
    ctx.fillRect(19, 94, 8, 4);
    ctx.fillRect(19, 95, 3, 5);
    // 手臂举手机
    ctx.fillStyle = o.shirt;
    ctx.fillRect(20, 94, 2, 4);
    ctx.fillRect(26, 95, 2, 3);
    // 手机（滑动）
    const sw = Math.floor(t * 2.6) % 4;
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(24, 88, 4, 6);
    ctx.fillStyle = '#7ad8ff';
    ctx.fillRect(25, 89 + sw, 2, 1);
    // 屏幕光映脸
    const glow = ctx.createRadialGradient(26, 91, 1, 26, 91, 10);
    glow.addColorStop(0, 'rgba(122,216,255,0.35)');
    glow.addColorStop(1, 'rgba(122,216,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(16, 82, 20, 20);
    // 睁眼
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(21, 98, 1, 1);
    ctx.fillRect(24, 98, 1, 1);
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
    // 夜间玩手机/翻身：坐起亮屏（结束后躺下继续睡）
    if (char.nightAct === 'phoneToss') { drawNightPhone(ctx, outfitForSleep(), t); return; }
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
    screenMode: getScreenMode,
    screenName: screenModeName,
    cycleScreen: cycleScreen,
    isWork: function () { return char && char.pose === 'work'; },
    sleepInfo: function () {
      if (!char) return null;
      return { sleeping: char.pose === 'sleep', startMin: char.sleepStartMin };
    },
    // 当前休闲活动（供 roomLayout 判断是否打开游戏画面）
    leisureAct: function () { return char ? char.leisureAct : null; },
    // 逗猫棒顶端位置（供猫追玩具）
    getToyX: function () {
      if (!char || char.activity !== 'leisure' || char.leisureAct !== 'play_cat') return null;
      const t = performance.now() / 1000;
      return Math.round(char.x + 4 + Math.sin(t * 3.2) * 5);
    },
    getToyY: function () {
      if (!char || char.activity !== 'leisure' || char.leisureAct !== 'play_cat') return null;
      const t = performance.now() / 1000;
      return Math.round(92 + Math.sin(t * 2.7) * 3);
    },
    nightAct: function () { return char ? char.nightAct : null; },
    fridgeOpen: fridgeOpen,
    mealFood: mealFood,
    react: react,
    reactRandom: reactRandom,
    // ---- 吉他弹唱 ----
    startGuitar: startGuitar,
    guitarActive: guitarActive,
    guitarSong: guitarSong,
    guitarTaken: guitarTaken,
    _debug: function () {
      if (!char) return null;
      return {
        x: char.x, pose: char.pose, activity: char.activity,
        fridgePhase: char.fridgePhase, mealFood: char.mealFood,
        washSeq: char.washSeq, washT: char.washT, react: char.react,
        leisureAct: char.leisureAct, leisureT: Math.round(char.leisureT),
        leisureSub: char.leisureSub, leisureSubT: Math.round(char.leisureSubT),
        nightAct: char.nightAct, nightPlan: char.nightPlan,
        guitar: char.guitar ? { phase: char.guitar.phase, line: char.guitar.line, t: Math.round(char.guitar.t), taken: char.guitar.taken, song: char.guitar.song.id, notes: (char.guitar.notes || []).length, restore: char.guitar.restore ? char.guitar.restore.activity : null } : null,
        lastSongId: lastSongId, lastSongTime: lastSongTime
      };
    }
  };
})();
