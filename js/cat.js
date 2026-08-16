/* ============================================================
 * cat.js —— 猫状态机与动画（独立行为系统）
 * 新增：攀爬点（餐桌/冰箱顶/桌面/衣柜顶/吊柜顶）+ 床下 + 窗帘抓挠
 *       + 猫粮碗进食 + 连续摸猫 3 阶段 + 快速开关灯惊吓逃跑
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

  // 可攀爬点（x=站立位置，y=支撑面高度）
  const CLIMB_POINTS = [
    { id: 'table',    x: 262, y: 110, durMin: 10, durMax: 30 },  // 餐桌：蹭饭/偷看
    { id: 'fridge',   x: 274, y: 86,  durMin: 20, durMax: 60 },  // 冰箱顶：高处俯视
    { id: 'desk',     x: 122, y: 108, durMin: 5,  durMax: 20 },  // 工作区桌面：踩键盘推咖啡杯
    { id: 'wardrobe', x: 8,   y: 56,  durMin: 20, durMax: 60 },  // 衣柜顶
    { id: 'cabinet',  x: 288, y: 56,  durMin: 20, durMax: 60 }   // 厨房吊柜顶
  ];
  const BOWL_X = 307;      // 猫粮碗（厨房角落）
  const CURTAIN_X = 52;    // 窗帘（卧室窗左侧）
  const UNDERBED_X = 20;   // 床下

  let cat = null;

  function init() {
    // 每次打开页面随机起始位置（卧室/工作区/厨房常见落脚点，避免出生在家具里）
    const spots = [30 + Math.random() * 24, 120 + Math.random() * 30, 250 + Math.random() * 24];
    const sx = Math.max(8, Math.min(W - 8, spots[(Math.random() * spots.length) | 0]));
    cat = {
      x: sx, dir: Math.random() < 0.5 ? -1 : 1, palette: PALETTES[0],
      state: 'idle', stateT: 0, dur: 2,
      animT: Math.random() * 10,
      moodT: 0, target: null,
      y: FLOOR,             // 支撑面高度（地面=128）
      perchId: null,        // 当前攀爬点 id
      jumpT: null, jumpFrom: FLOOR, jumpTo: FLOOR,
      squashT: 0,
      climbPt: null,
      fleeSpot: null,
      eating: false, eatT: 0,
      petChain: 0, petLastAt: 0, petLevel: 0,
      zoomDir: 1
    };
  }

  function isPersonEating() {
    const act = P.Time.getSchedule(P.Time.now()).id;
    return act === 'breakfast' || act === 'lunch' || act === 'dinner';
  }

  function pickState() {
    let rubW = 9;
    const p = P.Character.pos();
    const nearPerson = Math.abs(cat.x - p.x) < 30;
    if (nearPerson) rubW = 34;
    let climbW = 16;
    if (isPersonEating()) climbW += 10;   // 吃饭时更想上桌蹭饭
    const bowl = (P.Storage.state.items && P.Storage.state.items.bowl) || 0;
    const eatW = bowl > 0 ? 12 : 0;
    const total = 26 + 18 + 20 + 12 + 7 + 8 + climbW + 5 + 6 + eatW;
    let roll = Math.random() * total;
    if ((roll -= 26) <= 0) return 'wander';
    if ((roll -= 18) <= 0) return 'groom';
    if ((roll -= 20) <= 0) return 'sleep';
    if ((roll -= 12) <= 0) return 'idle';
    if ((roll -= 7) <= 0) return 'zoomies';
    if ((roll -= 8) <= 0) return 'rub';
    if ((roll -= climbW) <= 0) return 'climb';
    if ((roll -= 5) <= 0) return 'scratch';
    if ((roll -= 6) <= 0) return 'underbed';
    return 'eat';
  }

  function enter(state) {
    cat.state = state; cat.stateT = 0; cat.target = null;
    cat.climbPt = null; cat.fleeSpot = null; cat.eating = false;
    switch (state) {
      case 'idle': cat.dur = 1 + Math.random() * 2.5; break;
      case 'groom': cat.dur = 3 + Math.random() * 4; break;
      case 'sleep': cat.dur = 8 + Math.random() * 14; break;
      case 'zoomies': cat.dur = 0.8 + Math.random() * 1.2; cat.zoomDir = Math.random() < 0.5 ? -1 : 1; break;
      case 'rub': cat.dur = 3 + Math.random() * 3; break;
      case 'wander': {
        cat.dur = 4 + Math.random() * 3;
        cat.target = pickWanderSpot();
        break;
      }
      case 'scratch': {
        // 走去窗帘再原地抓挠（不瞬移）
        cat.dur = 5 + Math.random() * 10;
        cat.y = FLOOR; cat.perchId = null; cat.jumpT = null; cat.dir = -1;
        if (Math.abs(cat.x - CURTAIN_X) > 2) cat.target = CURTAIN_X;
        break;
      }
      case 'underbed': {
        // 走到床下再躲起来（只露尾巴）
        cat.dur = 15 + Math.random() * 30;
        cat.y = FLOOR; cat.perchId = null; cat.jumpT = null;
        if (Math.abs(cat.x - UNDERBED_X) > 2) cat.target = UNDERBED_X;
        break;
      }
      case 'eat': {
        cat.dur = 3 + Math.random() * 2;
        cat.target = BOWL_X;
        break;
      }
    }
  }

  // 统一地面移动（不瞬移：每次只走一小段）
  function moveToTarget(dt, spd) {
    if (cat.target === null) return;
    const dx = cat.target - cat.x;
    const s = spd || 8;
    if (Math.abs(dx) < 0.8) {
      cat.x = cat.target; cat.target = null;
      return;
    }
    cat.x += Math.sign(dx) * Math.min(Math.abs(dx), s * dt);
    cat.dir = Math.sign(dx);
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

  // 最近隐蔽点（快速开关灯惊吓用）
  function nearestHide() {
    const spots = [
      { x: UNDERBED_X, y: FLOOR, hide: 'underbed', id: null },
      { x: 8, y: 56, hide: 'perch', id: 'wardrobe' },
      { x: 288, y: 56, hide: 'perch', id: 'cabinet' }
    ];
    let best = spots[0], bd = Math.abs(spots[0].x - cat.x);
    for (let i = 1; i < spots.length; i++) {
      const d = Math.abs(spots[i].x - cat.x);
      if (d < bd) { bd = d; best = spots[i]; }
    }
    return best;
  }

  function update(dt) {
    if (!cat) return;
    cat.animT += dt;
    if (cat.squashT > 0) cat.squashT -= dt;

    // 摸猫状态优先（兼容旧 moodT 分支）
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
        moveToTarget(dt);
        if (cat.target === null) {
          enter('idle'); cat.dur = 1 + Math.random() * 2;
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
      case 'rub': {
        const p = P.Character.pos();
        const tx = p.x + p.dir * 5;
        const dx = tx - cat.x;
        if (Math.abs(dx) > 2) {
          cat.target = tx;
          moveToTarget(dt, 9);
        } else {
          cat.target = null;   // 已蹭到，原地蹭
          if (cat.stateT > cat.dur) { enter('idle'); cat.dur = 1 + Math.random() * 2; }
        }
        break;
      }
      case 'happy':
        break;
      // ---- 连续摸猫 ----
      case 'pet': {
        if (cat.stateT > cat.dur) {
          if (cat.petLevel >= 4) {
            // 伸爪表示“够了”→ 起身走开
            cat.state = 'walkaway'; cat.stateT = 0; cat.dur = 1.6;
            cat.target = pickWanderSpot();
            if (P.Audio) P.Audio.purrStop();
          } else {
            cat.state = 'idle'; cat.dur = 1.5; cat.stateT = 0; cat.target = null;
            if (P.Audio) P.Audio.purrStop();
          }
        }
        break;
      }
      case 'walkaway': {
        if (cat.target === null) cat.target = pickWanderSpot();
        moveToTarget(dt, 12);
        if (cat.target === null) { enter('idle'); cat.dur = 1 + Math.random() * 2; }
        break;
      }
      // ---- 攀爬（两阶段：先走到附近 → 跳跃动画 → 到达）----
      case 'climb': {
        if (!cat.climbPt) {
          // 选择攀爬点（小人在吃饭时优先餐桌蹭饭）
          let pts = CLIMB_POINTS.slice();
          if (isPersonEating()) {
            const t = pts.filter(function (p) { return p.id === 'table'; })[0];
            if (t) pts = [t].concat(pts.filter(function (p) { return p.id !== 'table'; }));
          }
          cat.climbPt = pts[(Math.random() * pts.length) | 0];
          cat.target = cat.climbPt.x;
        }
        const pt = cat.climbPt;
        if (cat.jumpT === null) {
          const dx = pt.x - cat.x;
          if (Math.abs(dx) < 4) {
            // 已走到附近 → 跳跃动画（弧线 + 落地 squash）
            cat.jumpT = 0; cat.jumpFrom = FLOOR; cat.jumpTo = pt.y;
            cat.dir = pt.x >= cat.x ? 1 : -1;
          } else {
            cat.target = pt.x;
            moveToTarget(dt, 8);
          }
        } else {
          cat.jumpT += dt / 0.38;
          if (cat.jumpT >= 1) {
            cat.jumpT = null; cat.y = pt.y; cat.squashT = 0.12;
            cat.perchId = pt.id;
            cat.state = 'perch'; cat.stateT = 0;
            cat.dur = pt.durMin + Math.random() * (pt.durMax - pt.durMin);
            if (pt.id === 'table' && isPersonEating()) {
              // 上桌偷看小人吃饭
              cat.dir = P.Character.pos().x >= cat.x ? 1 : -1;
            }
          }
        }
        break;
      }
      case 'perch': {
        if (cat.stateT > cat.dur) {
          cat.jumpT = 0; cat.jumpFrom = cat.y; cat.jumpTo = FLOOR;
          cat.state = 'jumpdown';
        }
        break;
      }
      case 'jumpdown': {
        cat.jumpT += dt / 0.35;
        if (cat.jumpT >= 1) {
          cat.jumpT = null; cat.y = FLOOR; cat.squashT = 0.12;
          cat.perchId = null;
          if (cat.petAfterJump) { cat.petAfterJump = false; enterPet(); }
          else if (cat.fleeAfter) { cat.fleeAfter = false; startFlee(); }
          else if (cat.playAfter) { cat.playAfter = false; enterPlayState(); }
          else { enter('idle'); cat.dur = 1.5; }
        }
        break;
      }
      // ---- 床下 / 爬出（先走到床下，不瞬移）----
      case 'underbed': {
        if (cat.target !== null) {
          // 正在走去床下
          moveToTarget(dt, 9);
          if (cat.target === null) { cat.x = UNDERBED_X; cat.stateT = 0; }
        } else if (cat.stateT > cat.dur) {
          cat.state = 'crawlout'; cat.stateT = 0; cat.dur = 1.2;
          cat.target = null;
        }
        break;
      }
      case 'crawlout': {
        if (cat.target === null) {
          cat.target = cat.playAfter ? (P.Character.pos().x || UNDERBED_X + 20) : pickWanderSpot();
        }
        moveToTarget(dt, 9);
        if (cat.target === null) {
          if (cat.playAfter) { cat.playAfter = false; enterPlayState(); }
          else if (cat.petAfterJump) { cat.petAfterJump = false; enterPet(); }
          else { enter('idle'); cat.dur = 1 + Math.random() * 2; }
        }
        break;
      }
      // ---- 窗帘抓挠（先走到窗帘，不瞬移）----
      case 'scratch': {
        if (cat.target !== null) {
          moveToTarget(dt, 9);
          if (cat.target === null) { cat.x = CURTAIN_X; cat.stateT = 0; }
        } else if (cat.stateT > cat.dur) enter(pickState());
        break;
      }
      // ---- 吃猫粮（先走到碗边）----
      case 'eat': {
        if (!cat.eating) {
          if (cat.target === null) cat.target = BOWL_X;
          moveToTarget(dt);
          if (cat.target === null) {
            cat.eating = true; cat.eatT = 2.5 + Math.random() * 2;
            cat.dir = -1; cat.x = BOWL_X; cat.perchId = null;
          }
        } else {
          cat.eatT -= dt;
          if (cat.eatT <= 0) {
            const items = P.Storage.state.items || {};
            if (items.bowl > 0) { items.bowl--; P.Storage.save(); }
            if (P.Audio) P.Audio.eat();
            cat.eating = false;
            enter('idle'); cat.dur = 1 + Math.random() * 2;
          }
        }
        break;
      }
      // ---- 惊吓逃跑（先跑过去，不瞬移）----
      case 'flee': {
        if (!cat.fleeSpot) cat.fleeSpot = nearestHide();
        const sp = cat.fleeSpot;
        if (cat.jumpT === null) {
          const dx = sp.x - cat.x;
          if (Math.abs(dx) < 4) {
            if (sp.hide === 'underbed') {
              // 已到床下 → 直接钻入（enter 会检查距离决定是否再走）
              enter('underbed');
              cat.dur = 8 + Math.random() * 6;
            } else {
              cat.jumpT = 0; cat.jumpFrom = FLOOR; cat.jumpTo = sp.y;
              cat.dir = sp.x >= cat.x ? 1 : -1;
            }
          } else {
            cat.target = sp.x;
            moveToTarget(dt, 26);
          }
        } else {
          cat.jumpT += dt / 0.3;
          if (cat.jumpT >= 1) {
            cat.jumpT = null; cat.y = sp.y; cat.squashT = 0.12;
            cat.perchId = sp.id;
            cat.state = 'perch'; cat.stateT = 0; cat.dur = 10 + Math.random() * 8;
          }
        }
        break;
      }
      // ---- 逗猫（追逗猫棒）----
      case 'play': {
        if (!cat.playOn) { enter('idle'); cat.dur = 1.5; break; }
        if (cat.playRest > 0) {
          // 短暂休息（蹲着看逗猫棒）
          cat.playRest -= dt;
          break;
        }
        if (cat.jumpT !== null) {
          // 扑跳动画（原地小跳弧线）
          cat.jumpT += dt / 0.28;
          if (cat.jumpT >= 1) {
            cat.jumpT = null; cat.squashT = 0.1;
            cat.playRest = 1.5 + Math.random() * 2.5;
          }
          break;
        }
        const toy = (P.Character.getToyX && P.Character.getToyY)
          ? { x: P.Character.getToyX(), y: P.Character.getToyY() } : null;
        if (!toy) break;
        const dx = toy.x - cat.x;
        if (Math.abs(dx) > 5) {
          cat.x += Math.sign(dx) * Math.min(Math.abs(dx), 15 * dt);
          cat.dir = Math.sign(dx);
          if (Math.random() < dt * 0.8) { if (P.Audio && P.Audio.meow) P.Audio.meow(); }
        } else {
          // 扑向逗猫棒
          cat.jumpT = 0; cat.jumpFrom = FLOOR; cat.jumpTo = FLOOR;
          cat.dir = toy.x >= cat.x ? 1 : -1;
        }
        break;
      }
    }
  }

  // 连续摸猫：1 次抬头喵 → 2 次蹭手 → 3 次翻肚皮 → 再点伸爪走开
  function pet() {
    const now = Date.now();
    cat.petChain = (now - cat.petLastAt <= 3000) ? cat.petChain + 1 : 1;
    cat.petLastAt = now;
    cat.petLevel = Math.min(4, cat.petChain);
    cat.moodT = 0;
    if (cat.petLevel === 1) { if (P.Audio) P.Audio.meow(); }
    if (cat.petLevel >= 2) { if (P.Audio) P.Audio.purrStart(); }
    const st = P.Storage.state;
    st.petToday = (st.petToday || 0) + 1;
    st.petTotal = (st.petTotal || 0) + 1;
    P.Storage.save();
    P.Events.emit('cat-pet', { count: st.petToday });
    if (cat.state === 'underbed' && cat.target === null) {
      // 在床下：先爬出来再摸（不瞬移）
      cat.state = 'crawlout'; cat.stateT = 0; cat.dur = 1.2;
      cat.target = P.Character.pos().x;
      cat.petAfterJump = true;
    } else if (cat.jumpT === null && cat.y !== FLOOR) {
      // 在高处（攀爬/家具顶）：先跳下来再进入摸猫（不瞬移）
      cat.jumpT = 0; cat.jumpFrom = cat.y; cat.jumpTo = FLOOR;
      cat.state = 'jumpdown'; cat.stateT = 0; cat.petAfterJump = true;
    } else {
      enterPet();
    }
  }

  function enterPet() {
    cat.petAfterJump = false;
    cat.perchId = null; cat.y = FLOOR; cat.jumpT = null;
    cat.state = 'pet'; cat.stateT = 0; cat.target = null;
    cat.dur = cat.petLevel === 1 ? 1.1 : cat.petLevel === 2 ? 1.7 : cat.petLevel === 3 ? 2.6 : 1.0;
  }

  // 快速开关灯惊吓：跑向最近隐蔽点（或跳上去）
  function frightened() {
    if (!cat) return;
    cat.moodT = 0;
    cat.eating = false;
    if (cat.jumpT === null && cat.y !== FLOOR) {
      // 在高处：先跳下来再逃跑（不瞬移）
      cat.jumpT = 0; cat.jumpFrom = cat.y; cat.jumpTo = FLOOR;
      cat.state = 'jumpdown'; cat.stateT = 0; cat.fleeAfter = true;
    } else {
      startFlee();
    }
    if (P.Audio) P.Audio.meow();
  }

  function startFlee() {
    cat.fleeAfter = false;
    cat.state = 'flee'; cat.stateT = 0; cat.target = null; cat.fleeSpot = null;
    cat.perchId = null; cat.jumpT = null;
  }

  // ---- 逗猫：猫进入玩耍状态，追逗猫棒 ----
  function playWithHuman() {
    if (!cat) return;
    cat.moodT = 0;
    cat.eating = false;
    cat.playOn = true;
    if (cat.state === 'underbed' && cat.target === null) {
      // 从床下爬出再玩（不瞬移）
      cat.state = 'crawlout'; cat.stateT = 0; cat.dur = 1.2;
      cat.target = P.Character.pos().x;
      cat.playAfter = true;
    } else if (cat.jumpT === null && cat.y !== FLOOR) {
      // 在高处：先跳下来
      cat.jumpT = 0; cat.jumpFrom = cat.y; cat.jumpTo = FLOOR;
      cat.state = 'jumpdown'; cat.stateT = 0; cat.playAfter = true;
    } else {
      enterPlayState();
    }
  }

  function enterPlayState() {
    cat.playAfter = false;
    cat.perchId = null; cat.y = FLOOR; cat.jumpT = null;
    cat.state = 'play'; cat.stateT = 0; cat.target = null;
    cat.playRest = 20 + Math.random() * 20;   // 玩一会儿歇一会儿
  }

  // 逗猫结束：回到普通行为
  function endPlay() {
    if (!cat) return;
    cat.playOn = false;
    cat.playAfter = false;
    if (cat.state === 'play') { enter('idle'); cat.dur = 1.5; }
  }

  // 猫是否在睡觉（休闲选 play_cat 时用于排除）
  function isSleeping() {
    return !!cat && cat.state === 'sleep';
  }

  function pos() {
    return { x: cat ? cat.x : 60, dir: cat ? cat.dir : -1 };
  }

  function perchId() { return cat ? cat.perchId : null; }

  // ============================================================
  // 绘制
  // ============================================================
  function drawCat(ctx, x, y, direction, palette, pose) {
    ctx.globalAlpha = 1;  // 关键：重置透明度
    const pal = palette;
    const squash = pose === 'land';
    const eat = pose === 'eat';
    const pet1 = pose === 'pet' && cat.petLevel === 1;
    const pet4 = pose === 'pet' && cat.petLevel === 4;
    const flee = pose === 'flee' || pose === 'walkaway';
    const bodyH = squash ? 9 : 10;

    // 轮廓
    ctx.fillStyle = pal.dark;
    ctx.fillRect(Math.floor(x - 1), Math.floor(y - 1), 18, bodyH + 1);

    // 身体
    ctx.fillStyle = pal.body;
    ctx.fillRect(Math.floor(x), Math.floor(y), 16, bodyH);

    // 肚皮
    ctx.fillStyle = pal.belly;
    ctx.fillRect(Math.floor(x + 4), Math.floor(y + 6), 8, bodyH - 6);

    // 条纹
    ctx.fillStyle = pal.stripe;
    ctx.fillRect(Math.floor(x + 2), Math.floor(y + 1), 2, 2);
    ctx.fillRect(Math.floor(x + 7), Math.floor(y), 2, 2);
    ctx.fillRect(Math.floor(x + 12), Math.floor(y + 1), 2, 2);

    // 尾巴（身体左侧后方）
    ctx.fillStyle = pal.body;
    ctx.fillRect(Math.floor(x - 3), Math.floor(y + 1), 3, 2);
    ctx.fillStyle = pal.dark;
    ctx.fillRect(Math.floor(x - 3), Math.floor(y + 1), 1, 1);

    // 头部（eat 低头 / pet1 抬头）
    const headY = eat ? y - 2 : (pet1 ? y - 5 : y - 4);
    ctx.fillStyle = pal.body;
    ctx.fillRect(Math.floor(x + 8), Math.floor(headY), 8, 8);
    // 头部轮廓
    ctx.fillStyle = pal.dark;
    ctx.fillRect(Math.floor(x + 7), Math.floor(headY - 1), 10, 10);
    ctx.fillStyle = pal.body;
    ctx.fillRect(Math.floor(x + 8), Math.floor(headY), 8, 8);

    // 耳朵
    ctx.fillStyle = pal.body;
    ctx.fillRect(Math.floor(x + 9), Math.floor(headY - 3), 3, 3);
    ctx.fillRect(Math.floor(x + 13), Math.floor(headY - 3), 3, 3);
    // 耳朵内部
    ctx.fillStyle = pal.belly;
    ctx.fillRect(Math.floor(x + 10), Math.floor(headY - 2), 1, 1);
    ctx.fillRect(Math.floor(x + 14), Math.floor(headY - 2), 1, 1);

    // 眼睛（eat 眯眼 / pet1 圆眼上移）
    ctx.fillStyle = '#1a1a1a';
    const ey = eat ? headY + 2 : (pet1 ? headY + 1 : headY + 2);
    ctx.fillRect(Math.floor(x + 10), Math.floor(ey), 2, eat ? 1 : 2);
    ctx.fillRect(Math.floor(x + 14), Math.floor(ey), 2, eat ? 1 : 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.floor(x + 10), Math.floor(ey), 1, 1);
    ctx.fillRect(Math.floor(x + 14), Math.floor(ey), 1, 1);

    // 胡须
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.floor(x + 6), Math.floor(headY + 3), 3, 1);
    ctx.fillRect(Math.floor(x + 6), Math.floor(headY + 4), 3, 1);
    ctx.fillRect(Math.floor(x + 17), Math.floor(headY + 3), 3, 1);
    ctx.fillRect(Math.floor(x + 17), Math.floor(headY + 4), 3, 1);

    // pet4：伸爪子表示“够了”
    if (pet4) {
      ctx.fillStyle = pal.body;
      ctx.fillRect(Math.floor(x + 16), Math.floor(y + 3), 3, 2);
      ctx.fillStyle = pal.dark;
      ctx.fillRect(Math.floor(x + 16), Math.floor(y + 3), 3, 1);
    }
    // 逃跑/走开：身后运动线
    if (flee) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(Math.floor(x - 10), Math.floor(y + 3), 2, 1);
      ctx.fillRect(Math.floor(x - 13), Math.floor(y + 6), 2, 1);
    }
  }

  // 翻肚皮（摸猫第 3 阶段）
  function drawBelly(ctx, x, y, pal, t) {
    ctx.globalAlpha = 1;
    // 身体（肚皮朝上）
    ctx.fillStyle = pal.dark;
    ctx.fillRect(Math.floor(x + 1), Math.floor(y - 7), 14, 8);
    ctx.fillStyle = pal.belly;
    ctx.fillRect(Math.floor(x + 2), Math.floor(y - 6), 12, 6);
    // 四只小爪（朝上）
    ctx.fillStyle = pal.body;
    ctx.fillRect(Math.floor(x + 3), Math.floor(y - 8), 2, 2);
    ctx.fillRect(Math.floor(x + 11), Math.floor(y - 8), 2, 2);
    ctx.fillRect(Math.floor(x + 3), Math.floor(y - 3), 2, 2);
    ctx.fillRect(Math.floor(x + 11), Math.floor(y - 3), 2, 2);
    // 头（右侧侧躺）
    ctx.fillStyle = pal.dark;
    ctx.fillRect(Math.floor(x + 9), Math.floor(y - 12), 9, 8);
    ctx.fillStyle = pal.body;
    ctx.fillRect(Math.floor(x + 10), Math.floor(y - 11), 7, 6);
    // 耳朵
    ctx.fillRect(Math.floor(x + 10), Math.floor(y - 14), 2, 3);
    ctx.fillRect(Math.floor(x + 14), Math.floor(y - 14), 2, 3);
    ctx.fillStyle = pal.belly;
    ctx.fillRect(Math.floor(x + 10), Math.floor(y - 13), 1, 1);
    ctx.fillRect(Math.floor(x + 14), Math.floor(y - 13), 1, 1);
    // 眯眼（满足）
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(Math.floor(x + 12), Math.floor(y - 9), 2, 1);
    ctx.fillRect(Math.floor(x + 15), Math.floor(y - 9), 2, 1);
    // 尾巴（左侧卷起）
    ctx.fillStyle = pal.body;
    ctx.fillRect(Math.floor(x), Math.floor(y - 6), 3, 2);
    ctx.fillStyle = pal.dark;
    ctx.fillRect(Math.floor(x - 1), Math.floor(y - 7), 2, 2);
  }

  // 床下：只露出尾巴 + 后爪
  function drawUnderbedTail(ctx, pal, t) {
    const sway = Math.floor(t * 2) % 2;
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.body;
    ctx.fillRect(38, 120 + sway, 4, 2);
    ctx.fillRect(42, 119 + sway, 2, 2);
    ctx.fillStyle = pal.dark;
    ctx.fillRect(43, 118 + sway, 1, 1);
    // 后爪尖
    ctx.fillStyle = pal.body;
    ctx.fillRect(36, 124, 2, 2);
    ctx.fillStyle = pal.dark;
    ctx.fillRect(36, 124, 1, 1);
  }

  function draw(ctx, st) {
    if (!cat) return;
    const c = cat;
    const t = c.animT;
    const pal = c.palette;
    const x = Math.round(c.x);

    // 床下（已到达才隐藏；走过去的路上正常显示，不瞬移）
    if (c.state === 'underbed' && c.target === null) {
      drawUnderbedTail(ctx, pal, t);
      return;
    }

    // 计算支撑面（跳跃时插值 + 弧线）
    let surf = c.y;
    if (c.jumpT !== null) {
      const jt = Math.min(1, c.jumpT);
      const e = jt * jt * (3 - 2 * jt);       // smoothstep
      surf = c.jumpFrom + (c.jumpTo - c.jumpFrom) * e - Math.sin(jt * Math.PI) * 4;
    }
    const d = c.dir;
    const squash = c.squashT > 0;
    const sy = Math.round(surf);

    // 影子 / 落地尘埃
    if (!squash) {
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(x - 8, sy - 1, 18, 2);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.20)';
      ctx.fillRect(x - 8, sy - 1, 18, 1);
      ctx.fillRect(x - 6, sy - 2, 4, 1);
      ctx.fillRect(x + 2, sy - 2, 4, 1);
    }

    const pose = c.state;
    const drawY = sy - 10 + (squash ? 1 : 0);

    if (c.state === 'pet' && c.petLevel === 3) {
      // 翻肚皮
      drawBelly(ctx, x - 7, drawY + 4, pal, t);
    } else if (d < 0) {
      ctx.save();
      ctx.translate(x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-x, 0);
      drawCat(ctx, x - 7, drawY, d, pal, pose);
      ctx.restore();
    } else {
      drawCat(ctx, x - 7, drawY, d, pal, pose);
    }

    // 摸猫 2/3 阶段爱心
    if (c.state === 'pet' && c.petLevel >= 2) {
      const hx = x + 5 + Math.round(Math.sin(t * 3) * 1);
      const hy = sy - 16 + Math.round(Math.sin(t * 5) * 1);
      ctx.fillStyle = '#ff6a8a';
      ctx.fillRect(hx, hy, 2, 2);
      ctx.fillRect(hx + 3, hy, 2, 2);
      ctx.fillRect(hx, hy + 1, 5, 1);
      ctx.fillRect(hx + 1, hy + 2, 3, 2);
      ctx.fillRect(hx + 2, hy + 3, 1, 1);
    }

    // 吃猫粮：碗画在猫身前（保证碗与余粮可见）
    if (c.state === 'eat') {
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(304, 127, 7, 1);
      ctx.fillStyle = '#e8e2d8';
      ctx.fillRect(305, 124, 5, 2);
      ctx.fillStyle = '#fdfaf2';
      ctx.fillRect(305, 124, 5, 1);
      const bfood = (P.Storage.state.items || {}).bowl || 0;
      if (bfood > 0) {
        ctx.fillStyle = '#c89050';
        ctx.fillRect(306, 121, 3, 3);
        if (bfood >= 2) { ctx.fillStyle = '#d8a060'; ctx.fillRect(306, 120, 3, 1); }
        if (bfood >= 3) { ctx.fillStyle = '#a06828'; ctx.fillRect(308, 120, 1, 1); }
      }
    }

    // 窗帘抓挠（到达后才画前爪与抓痕）：前爪挠 + 抓痕
    if (c.state === 'scratch' && c.target === null) {
      const sw = Math.floor(t * 6) % 2;
      ctx.fillStyle = pal.body;
      if (sw === 0) {
        ctx.fillRect(50, 104, 2, 3);
        ctx.fillRect(54, 106, 2, 3);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(50, 88, 1, 3);
      ctx.fillRect(53, 89, 1, 3);
      ctx.fillRect(49, 87, 1, 2);
    }
  }

  P.Cat = {
    init: init,
    update: update,
    pet: pet,
    frightened: frightened,
    playWithHuman: playWithHuman,
    endPlay: endPlay,
    isSleeping: isSleeping,
    pos: pos,
    perchId: perchId,
    draw: draw,
    _debug: function () {
      if (!cat) return null;
      return { state: cat.state, stateT: cat.stateT, dur: cat.dur, target: cat.target, moodT: cat.moodT, x: cat.x, y: cat.y, perchId: cat.perchId, petLevel: cat.petLevel, petChain: cat.petChain, playOn: cat.playOn, playRest: Math.round(cat.playRest) };
    }
  };
})();
