/* ============================================================
 * roomLayout.js —— 房间布局数据与绘制（卧室/工作区/卫生间/厨房）
 * 视觉强化版：分层绘制（z=0 背景 / z=1 中景 / z=2 前景）
 * 静态场景绘制到离屏缓存，动态光影/动画逐帧绘制
 * ============================================================ */
(function () {
  'use strict';
  const P = window.PixelRoom; if (!P) return;
  const C = P.Config;
  const RW = C.ROOM_WIDTH, SKY_H = C.SKY_H, CEIL = C.CEILING_Y, FLOOR = C.FLOOR_Y, W = C.LOGICAL_W, H = C.LOGICAL_H;

  // ---- 家具数据（逻辑坐标） ----
  const FURN = {
    bedroom: {
      window: { x: 56, y: 54, w: 16, h: 32 },
      wardrobe: { x: 2, y: 56, w: 13, h: 44 },
      bed: { x: 8, y: 112, w: 36, h: 16 },
      pillow: { x: 10, y: 104, w: 7, h: 8 },
      blanket: { x: 17, y: 112, w: 27, h: 8 },
      nightstand: { x: 46, y: 116, w: 9, h: 12 },
      nightLamp: { x: 48, y: 100, w: 5, h: 16 },
      rug: { x: 14, y: 128, w: 36, h: 4 },
      frames: [{ x: 24, y: 62, w: 7, h: 9 }, { x: 34, y: 62, w: 7, h: 9 }],
      clock: { x: 16, y: 56, w: 7, h: 7 },
      acSpot: { x: 6, y: 44, w: 14, h: 9 },
      heaterSpot: { x: 58, y: 112, w: 12, h: 8 },
      ceilingLamp: { x: 40 }
    },
    workspace: {
      window: { x: 138, y: 54, w: 16, h: 32 },
      bookshelf: { x: 86, y: 58, w: 16, h: 30 },
      poster: { x: 110, y: 58, w: 8, h: 10 },
      socket: { x: 124, y: 92, w: 5, h: 8 },
      desk: { x: 104, y: 108, w: 40, h: 20 },
      monitor: { x: 106, y: 84, w: 18, h: 24 },
      keyboard: { x: 116, y: 107, w: 16, h: 2 },
      mug: { x: 132, y: 105, w: 3, h: 4 },
      deskLamp: { x: 136, y: 94, w: 7, h: 16 },
      chair: { x: 142, y: 116, w: 14, h: 12 },
      rug: { x: 104, y: 128, w: 44, h: 4 },
      fanSpot: { x: 88, y: 50, w: 12, h: 8 },
      humidSpot: { x: 84, y: 110, w: 9, h: 18 },
      ceilingLamp: { x: 120 }
    },
    bathroom: {
      window: { x: 212, y: 54, w: 16, h: 32 },
      shower: { x: 162, y: 94, w: 22, h: 34 },
      showerHead: { x: 171, y: 52, w: 4, h: 44 },
      mirror: { x: 186, y: 78, w: 17, h: 17 },
      sink: { x: 186, y: 102, w: 16, h: 26 },
      toilet: { x: 210, y: 98, w: 12, h: 30 },
      towel: { x: 203, y: 60, w: 4, h: 14 },
      cabinet: { x: 226, y: 56, w: 12, h: 22 },
      ceilingLamp: { x: 200 }
    },
    kitchen: {
      window: { x: 296, y: 52, w: 14, h: 32 },
      cabinets: { x: 282, y: 56, w: 12, h: 22 },
      potRack: { x: 244, y: 56, w: 16, h: 16 },
      wallShelf: { x: 240, y: 84, w: 20, h: 8 },
      table: { x: 244, y: 110, w: 22, h: 18 },
      stoolA: { x: 244, y: 116, w: 8, h: 12 },
      stoolB: { x: 258, y: 116, w: 8, h: 12 },
      fridge: { x: 268, y: 86, w: 13, h: 42 },
      counter: { x: 282, y: 104, w: 38, h: 24 },
      stove: { x: 284, y: 98, w: 12, h: 8 },
      sink: { x: 298, y: 100, w: 10, h: 6 },
      plant: { x: 312, y: 92, w: 7, h: 16 },
      meal: { x: 250, y: 104, w: 7, h: 6 },
      bowlSpot: { x: 305, y: 124, w: 5, h: 3 },   // 猫粮碗（厨房角落地面）
      dogBed: { x: 286, y: 124, w: 12, h: 4 },    // 狗窝（厨房角落地面，与猫粮碗分开）
      dogBowl: { x: 300, y: 124, w: 5, h: 3 },    // 狗粮碗
      pkgSpot: { x: 310, y: 118, w: 7, h: 7 },    // 快递箱（门口/墙边）
      ceilingLamp: { x: 280 }
    }
  };

  // ---- 工具 ----
  function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  // 4x5 点阵像素字体（聊天标题栏名字用，行 = 4bit 掩码，MSB 在左）
  const PIXEL_FONT = {
    M: [9, 13, 11, 9, 9],   // #..# / ##.# / #.## / #..# / #..#
    O: [6, 9, 9, 9, 6]      // .##. / #..# / #..# / #..# / .##.
  };
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (f < 0) { const k = 1 + f; r *= k; g *= k; b *= k; }
    else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }
  // 确定性伪随机（用于噪点等静态纹理）
  function makeRand(seed) {
    let s = seed | 0;
    return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  }
  // 地面软阴影（1-3px 圆角矩形感）
  function groundShadow(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(24,18,12,0.30)';
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = 'rgba(24,18,12,0.18)';
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillRect(x + w - 1, y, 1, h);
    ctx.fillStyle = 'rgba(24,18,12,0.10)';
    ctx.fillRect(x - 1, y + 2, 1, h - 4);
    ctx.fillRect(x + w, y + 2, 1, h - 4);
  }
  // 像素噪点（约每 100px 一个 1px 色点）
  function sprinkle(ctx, x0, y0, w, h, dark, light) {
    const n = Math.max(1, Math.round((w * h) / 100));
    const rand = makeRand(x0 * 31 + y0 * 17 + 7);
    for (let i = 0; i < n; i++) {
      const x = x0 + ((rand() * w) | 0);
      const y = y0 + ((rand() * h) | 0);
      ctx.fillStyle = rand() < 0.5 ? dark : light;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // 夜间判断（用于“用户未手动开关灯前的自动开灯”）
  function isNightTime() {
    const tp = P.Time.now();
    const ast = P.Time.astro(tp, P.Time.season(tp).id);
    return ast.night || tp.hour < 6.2;
  }

  // 灯的有效状态：用户手动开关后以手动为准；否则夜间自动开灯
  function lampOn(kind, room) {
    const st = P.Storage.state;
    const manual = st.lamps[kind];
    if (st.lamps.touched) {
      if (kind === 'ceiling') return !!st.lamps.ceiling[room];
      return !!manual;
    }
    if (kind === 'ceiling') {
      if (room === 0) return !!st.lamps.ceiling[0]; // 卧室吊灯夜间默认关（睡觉）
      return !!st.lamps.ceiling[room] || isNightTime();
    }
    if (kind === 'deskLamp' || kind === 'nightLamp') return !!manual || isNightTime();
    return false;
  }

  // ---- 对外数据 ----
  function windows() {
    const out = [];
    for (let i = 0; i < 4; i++) {
      const fw = FURN[C.ROOM_IDS[i]].window;
      out.push({ x: fw.x, y: fw.y, w: fw.w, h: fw.h, cx: fw.x + fw.w / 2, cy: fw.y + fw.h / 2 });
    }
    return out;
  }

  function lights() {
    const out = [];
    for (let i = 0; i < 4; i++) {
      const lx = FURN[C.ROOM_IDS[i]].ceilingLamp.x;
      out.push({ kind: 'ceiling', room: i, x: lx, y: 50, r: 46, a: 0.5, on: lampOn('ceiling', i), seed: i * 3 + 1 });
    }
    out.push({ kind: 'deskLamp', x: 139, y: 97, r: 24, a: 0.68, on: lampOn('deskLamp'), seed: 11 });
    out.push({ kind: 'nightLamp', x: 50.5, y: 102, r: 24, a: 0.55, on: lampOn('nightLamp'), seed: 17 });
    return out;
  }

  // 可点击区域（电脑 / 灯 / 灯）
  function hits() {
    const out = [];
    const mon = FURN.workspace.monitor;
    out.push({ type: 'computer', x: mon.x - 3, y: mon.y - 3, w: mon.w + 6, h: mon.h + 6 });
    for (let i = 0; i < 4; i++) {
      const lx = FURN[C.ROOM_IDS[i]].ceilingLamp.x;
      out.push({ type: 'lamp', lamp: 'ceiling', room: i, x: lx - 7, y: 44, w: 14, h: 12 });
    }
    out.push({ type: 'lamp', lamp: 'deskLamp', x: 134, y: 92, w: 11, h: 16 });
    out.push({ type: 'lamp', lamp: 'nightLamp', x: 46, y: 98, w: 10, h: 16 });
    return out;
  }

  function monitorRect() { return FURN.workspace.monitor; }

  // ============================================================
  // 静态场景（离屏缓存）：结构 + 墙面装饰 + 窗户静态 + 中景 + 前景
  // ============================================================
  function drawHouse(ctx, st) {
    drawStructureBase(ctx, st);      // z=0 结构
    drawWallDecor(ctx, st);          // z=0 墙面装饰/材质
    drawWindowsStatic(ctx, st);      // z=0 窗户静态（窗帘/外框/窗台）
    drawMidFurniture(ctx, st);       // z=1 靠墙家具
    drawForeFurniture(ctx, st);      // z=2 前景家具
    drawSeasonItemsStatic(ctx, st);  // 季节小物件（静态部分）
    drawItemObjects(ctx, st);        // 动态物品（猫粮碗/快递箱/拆出物件）
  }

  // 每帧动态内容：窗内天空/中梃/反光、屏幕内容、蒸汽/水珠、风扇、吊灯、餐桌食物、冰箱门、猫桌面效果
  function drawDynamic(ctx, st, t) {
    drawWindowsDynamic(ctx, st);
    drawMonitorDynamic(ctx, st, t);
    drawSteamDrops(ctx, st, t);
    drawMealFood(ctx, st, t);
    drawSeasonItemsDynamic(ctx, st, t);
    drawCeilingLamps(ctx, st);
    drawFridgeDoorDynamic(ctx, st, t);
    drawDeskCatEffects(ctx, st, t);
  }

  // ============================================================
  // z=0 结构：屋顶、墙面、地板材质、门槛、踢脚线、门、轮廓
  // ============================================================
  function drawStructureBase(ctx, st) {
    // 屋顶（楼板）
    px(ctx, 0, SKY_H, W, CEIL - SKY_H, '#3a3238');
    px(ctx, 0, CEIL - 2, W, 2, '#2c262c');
    px(ctx, 0, SKY_H, W, 1, '#241f24');

    // 后墙基底色 + 墙纸花纹（卧室/工作区保留条纹，卫生间/厨房由墙面装饰覆盖）
    for (let i = 0; i < 4; i++) {
      const x0 = i * RW;
      const wall = C.COLORS.wall[i];
      const wallD = C.COLORS.wallDark[i];
      px(ctx, x0, CEIL, RW, FLOOR - CEIL, wall);
      px(ctx, x0, FLOOR - 18, RW, 18, wallD);
      px(ctx, x0, FLOOR - 18, RW, 1, shade(wall, -0.16));
      px(ctx, x0, CEIL, RW, 2, shade(wall, 0.22));
      px(ctx, x0, CEIL + 2, RW, 1, shade(wall, -0.14));
      if (i === 0 || i === 1) {
        // 墙纸花纹（细竖线）
        ctx.fillStyle = 'rgba(0,0,0,0.045)';
        for (let gx = x0 + 6; gx < x0 + RW; gx += 8) ctx.fillRect(gx, CEIL + 6, 1, FLOOR - 18 - CEIL - 6);
        // 墙纸噪点
        sprinkle(ctx, x0 + 2, CEIL + 3, RW - 4, FLOOR - 20 - CEIL, 'rgba(0,0,0,0.05)', 'rgba(255,255,255,0.05)');
      }
    }

    // 地板：四种材质
    drawFloorBedroom(ctx, 0, FLOOR, RW, H - FLOOR);
    drawFloorCarpet(ctx, RW, FLOOR, RW, H - FLOOR);
    drawFloorBath(ctx, RW * 2, FLOOR, RW, H - FLOOR);
    drawFloorKitchen(ctx, RW * 3, FLOOR, RW, H - FLOOR);

    // 门槛线：1px 深色 + 1px 高光
    for (let i = 0; i < 3; i++) {
      const bx = (i + 1) * RW;
      px(ctx, bx - 1, FLOOR, 1, H - FLOOR, C.COLORS.thresholdLight);
      px(ctx, bx, FLOOR, 1, H - FLOOR, C.COLORS.thresholdDark);
    }

    // 踢脚线
    for (let i = 0; i < 4; i++) px(ctx, i * RW, FLOOR, RW, 2, C.COLORS.baseboard);

    // 地毯（地板上、家具下）
    drawRugs(ctx, st);

    // 分隔墙 + 门洞
    for (let i = 0; i < 3; i++) {
      const bx = (i + 1) * RW;
      px(ctx, bx - 2, CEIL, 4, C.DOOR_Y - CEIL, '#4a4148');
      px(ctx, bx - 2, C.DOOR_Y, 4, FLOOR - C.DOOR_Y, '#5c525a');
      px(ctx, bx - 3, C.DOOR_Y - 2, 2, FLOOR - C.DOOR_Y + 2, '#3f383f');
      px(ctx, bx + 1, C.DOOR_Y - 2, 2, FLOOR - C.DOOR_Y + 2, '#3f383f');
      px(ctx, bx - 3, FLOOR, 6, 2, '#3a343a');
      // 门框高光
      px(ctx, bx - 2, CEIL, 1, C.DOOR_Y - CEIL, '#5c545c');
      px(ctx, bx + 1, CEIL, 1, C.DOOR_Y - CEIL, '#3a343a');
    }

    // 外轮廓
    px(ctx, 0, CEIL, 2, H - CEIL, '#332d33');
    px(ctx, W - 2, CEIL, 2, H - CEIL, '#332d33');
    px(ctx, 0, H - 2, W, 2, '#241f24');
  }

  // ---- 地面材质 ----
  function drawFloorBedroom(ctx, x0, y0, w, h) {
    // 暖棕色木地板：横向板条，相邻板色差 ±5%，板缝 + 木纹
    const planks = C.COLORS.floorBedroomPlanks;
    let row = 0;
    for (let y = y0; y < y0 + h; y += 4, row++) {
      const c = planks[row % planks.length];
      const ph = Math.min(4, y0 + h - y);
      px(ctx, x0, y, w, ph, c);
      // 板缝（横向）
      px(ctx, x0, y + ph - 1, w, 1, C.COLORS.floorBedroomJoint);
      // 板端错缝（竖向）
      const off = (row % 2) * 8;
      for (let gx = x0 + 6 + off; gx < x0 + w - 3; gx += 16) {
        px(ctx, gx, y, 1, ph - 1, C.COLORS.floorBedroomJoint);
      }
      // 木纹（细短线）
      ctx.fillStyle = 'rgba(80,50,25,0.30)';
      const rand = makeRand(x0 * 13 + y * 7 + 3);
      for (let i = 0; i < 3; i++) {
        const gx = x0 + 2 + ((rand() * (w - 6)) | 0);
        ctx.fillRect(gx, y + 1 + ((rand() * (ph - 2)) | 0), 2 + ((rand() * 3) | 0), 1);
      }
    }
    sprinkle(ctx, x0, y0, w, h, 'rgba(70,45,20,0.12)', 'rgba(255,235,200,0.10)');
  }

  function drawFloorCarpet(ctx, x0, y0, w, h) {
    // 深灰色地毯：边缘收边线 + 细密点阵
    px(ctx, x0, y0, w, h, C.COLORS.floorCarpet);
    // 点阵
    ctx.fillStyle = C.COLORS.floorCarpetDot;
    for (let y = y0 + 1; y < y0 + h; y += 2) {
      const off = (y - y0) % 2;
      for (let x = x0 + 1 + off; x < x0 + w; x += 2) ctx.fillRect(x, y, 1, 1);
    }
    // 收边线（深色 1px + 高光 1px）
    px(ctx, x0, y0, w, 1, C.COLORS.floorCarpetEdge);
    px(ctx, x0, y0 + h - 1, w, 1, C.COLORS.floorCarpetEdge);
    px(ctx, x0, y0, 1, h, C.COLORS.floorCarpetEdge);
    px(ctx, x0 + w - 1, y0, 1, h, C.COLORS.floorCarpetEdge);
    px(ctx, x0, y0 + 1, w, 1, 'rgba(160,175,200,0.10)');
    // 噪点
    sprinkle(ctx, x0, y0, w, h, 'rgba(30,36,48,0.25)', 'rgba(160,175,200,0.12)');
  }

  function drawFloorBath(ctx, x0, y0, w, h) {
    // 浅蓝/白方格瓷砖 + 灰缝 + 釉面高光点
    for (let gy = y0; gy < y0 + h; gy += 8) {
      for (let gx = x0; gx < x0 + w; gx += 8) {
        const cw = Math.min(8, x0 + w - gx), ch = Math.min(8, y0 + h - gy);
        const alt = ((gx - x0) / 8 + (gy - y0) / 8) % 2 === 0;
        px(ctx, gx, gy, cw, ch, alt ? C.COLORS.floorBathBase : C.COLORS.floorBathDark);
        // 灰缝（右 + 下）
        px(ctx, gx + cw - 1, gy, 1, ch, C.COLORS.floorBathGrout);
        px(ctx, gx, gy + ch - 1, cw, 1, C.COLORS.floorBathGrout);
        // 釉面高光点（左上角）
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(gx + 1, gy + 1, 2, 1);
        ctx.fillRect(gx + 1, gy + 1, 1, 2);
      }
    }
    sprinkle(ctx, x0, y0, w, h, 'rgba(60,90,100,0.10)', 'rgba(255,255,255,0.12)');
  }

  function drawFloorKitchen(ctx, x0, y0, w, h) {
    // 深色棋盘格地砖（红棕陶土）+ 磨损做旧
    for (let gy = y0; gy < y0 + h; gy += 8) {
      for (let gx = x0; gx < x0 + w; gx += 8) {
        const cw = Math.min(8, x0 + w - gx), ch = Math.min(8, y0 + h - gy);
        const chk = ((gx - x0) / 8 + (gy - y0) / 8) % 2 === 0;
        px(ctx, gx, gy, cw, ch, chk ? C.COLORS.floorKitchA : C.COLORS.floorKitchB);
        // 砖缝
        ctx.fillStyle = 'rgba(40,22,14,0.55)';
        ctx.fillRect(gx + cw - 1, gy, 1, ch);
        ctx.fillRect(gx, gy + ch - 1, cw, 1);
        // 磨损做旧：暗斑 + 磨亮边（确定性）
        const hsh = (gx * 7 + gy * 13) % 11;
        if (hsh === 0 || hsh === 5) {
          ctx.fillStyle = C.COLORS.floorKitchDark;
          ctx.fillRect(gx + 2 + ((gx * 3) % 4), gy + 2 + ((gy * 3) % 4), 2, 1);
        }
        if ((gx * 3 + gy * 5) % 7 === 0) {
          ctx.fillStyle = C.COLORS.floorKitchWear;
          ctx.fillRect(gx + 1, gy + 1, 3, 1);
        }
        if ((gx * 11 + gy * 3) % 9 === 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(gx + 4, gy + 4, 2, 2);
        }
      }
    }
    sprinkle(ctx, x0, y0, w, h, 'rgba(30,16,10,0.20)', 'rgba(200,150,120,0.10)');
  }

  function drawRugs(ctx, st) {
    // 卧室地毯（编织感）
    const R = FURN.bedroom.rug;
    px(ctx, R.x, R.y, R.w, R.h, '#c96f4a');
    px(ctx, R.x + 1, R.y + 1, R.w - 2, R.h - 2, '#d9825e');
    px(ctx, R.x + 3, R.y + 2, R.w - 6, 1, '#e89a78');
    px(ctx, R.x + 1, R.y + R.h - 1, R.w - 2, 1, '#a85535');
    ctx.fillStyle = 'rgba(120,50,30,0.35)';
    for (let gx = R.x + 4; gx < R.x + R.w - 3; gx += 4) ctx.fillRect(gx, R.y + 2, 1, 1);
    // 工作区地毯
    const W2 = FURN.workspace.rug;
    px(ctx, W2.x, W2.y, W2.w, W2.h, '#6a788e');
    px(ctx, W2.x + 1, W2.y + 1, W2.w - 2, W2.h - 2, '#7c8aa2');
    px(ctx, W2.x + 1, W2.y + W2.h - 1, W2.w - 2, 1, '#566276');
    ctx.fillStyle = 'rgba(30,40,60,0.35)';
    for (let gx = W2.x + 4; gx < W2.x + W2.w - 3; gx += 4) ctx.fillRect(gx, W2.y + 2, 1, 1);
  }

  // ============================================================
  // z=0 墙面装饰与材质：瓷砖墙/墙裙/腰线/挂画/镜子/毛巾/置物架/插座
  // ============================================================
  function drawWallDecor(ctx, st) {
    drawBedroomDecor(ctx, st);
    drawWorkspaceDecor(ctx, st);
    drawBathroomDecor(ctx, st);
    drawKitchenDecor(ctx, st);
  }

  function drawBedroomDecor(ctx, st) {
    const R = FURN.bedroom;
    // 挂画（像素画 + 画框高光）
    const arts = [
      { c: '#c85a6a', c2: '#e88a9a', scene: 'sunset' },
      { c: '#4a7bd0', c2: '#7aa8e8', scene: 'mountain' }
    ];
    for (let i = 0; i < 2; i++) {
      const f = R.frames[i];
      const art = arts[i];
      px(ctx, f.x, f.y, f.w, f.h, '#7a5c40');
      px(ctx, f.x, f.y, f.w, 1, '#a08058');
      px(ctx, f.x + 1, f.y + 1, f.w - 2, f.h - 2, '#f5ead2');
      if (st.season.id === 'winter') {
        // 冬景
        px(ctx, f.x + 2, f.y + 3, 3, 3, '#bcd8ee');
        px(ctx, f.x + 4, f.y + 5, 2, 2, '#eef6fc');
        px(ctx, f.x + 3, f.y + 6, 1, 2, '#8aa8c0');
      } else if (i === 0) {
        // 落日画
        px(ctx, f.x + 2, f.y + 2, 3, 3, art.c2);
        px(ctx, f.x + 2, f.y + 4, 3, 1, '#ffd98a');
        px(ctx, f.x + 1, f.y + 6, 5, 2, '#a05540');
        px(ctx, f.x + 3, f.y + 3, 1, 1, '#fff0d0');
      } else {
        // 山景画
        px(ctx, f.x + 2, f.y + 4, 3, 2, art.c);
        px(ctx, f.x + 3, f.y + 3, 2, 1, '#5a9a5a');
        px(ctx, f.x + 1, f.y + 6, 5, 2, '#4a7a4a');
        px(ctx, f.x + 4, f.y + 5, 1, 1, '#fff8e8');
      }
      // 玻璃反光
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.fillRect(f.x + 1, f.y + 2, 1, 2);
    }
    // 床头钟
    const cl = R.clock;
    px(ctx, cl.x, cl.y, cl.w, cl.h, '#d8d2c4');
    px(ctx, cl.x, cl.y, cl.w, 1, '#f0ece0');
    px(ctx, cl.x + 1, cl.y + 1, cl.w - 2, cl.h - 2, '#ffffff');
    px(ctx, cl.x + 3, cl.y + 3, 1, 1, '#3a3a4a');
    px(ctx, cl.x + 3, cl.y + 3, 1, 2, '#c85a6a');
    px(ctx, cl.x + 1, cl.y + 1, 1, cl.h - 2, 'rgba(0,0,0,0.12)');
    // 挂钟阴影
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(cl.x + 1, cl.y + cl.h, cl.w, 1);
  }

  function drawWorkspaceDecor(ctx, st) {
    const R = FURN.workspace;
    // 小海报
    const p = R.poster;
    px(ctx, p.x, p.y, p.w, p.h, '#b8b0a0');
    px(ctx, p.x, p.y, p.w, 1, '#d8d0c0');
    px(ctx, p.x + 1, p.y + 1, p.w - 2, p.h - 2, '#2a3a4a');
    // 海报内容：抽象几何
    px(ctx, p.x + 2, p.y + 3, 4, 3, '#5ac8ff');
    px(ctx, p.x + 3, p.y + 2, 2, 1, '#ffd05a');
    px(ctx, p.x + 2, p.y + 6, 5, 2, '#ff8a9a');
    px(ctx, p.x + 4, p.y + 4, 1, 1, '#ffffff');
    // 插座 + 线缆
    const s = R.socket;
    px(ctx, s.x, s.y, s.w, s.h, '#d8d8de');
    px(ctx, s.x, s.y, s.w, 1, '#f0f0f4');
    px(ctx, s.x + 1, s.y + 1, 1, s.h - 2, 'rgba(0,0,0,0.15)');
    px(ctx, s.x + 2, s.y + 2, 1, 2, '#8a8a94');
    px(ctx, s.x + 2, s.y + 5, 1, 2, '#8a8a94');
    // 线缆（垂到桌面后方）
    ctx.fillStyle = '#3a3a44';
    ctx.fillRect(s.x + 2, s.y + s.h - 1, 1, 9);
    ctx.fillRect(s.x + 2, s.y + s.h + 6, 2, 2);
    ctx.fillRect(s.x + 3, s.y + s.h + 7, 1, 3);
  }

  function drawBathroomDecor(ctx, st) {
    const R = FURN.bathroom;
    const x0 = 160, y0 = CEIL;
    // 上半墙：浅色瓷砖 8x8
    for (let gy = y0; gy < 74; gy += 8) {
      for (let gx = x0; gx < 240; gx += 8) {
        const cw = Math.min(8, 240 - gx), ch = Math.min(8, 74 - gy);
        const alt = ((gx - x0) / 8 + (gy - y0) / 8) % 2 === 0;
        px(ctx, gx, gy, cw, ch, alt ? C.COLORS.wallTileUpper : C.COLORS.wallTileUpperGrout);
        ctx.fillStyle = C.COLORS.wallTileUpperGrout;
        ctx.fillRect(gx + cw - 1, gy, 1, ch);
        ctx.fillRect(gx, gy + ch - 1, cw, 1);
        ctx.fillStyle = 'rgba(255,255,255,0.30)';
        ctx.fillRect(gx + 1, gy + 1, 2, 1);
      }
    }
    // 腰线（74-76）
    px(ctx, x0, 74, 80, 2, C.COLORS.waistline);
    px(ctx, x0, 74, 80, 1, C.COLORS.waistlineLight);
    // 下半墙：深色防水墙裙
    px(ctx, x0, 76, 80, FLOOR - 76, C.COLORS.wallWainscotBath);
    for (let gy = 76; gy < FLOOR; gy += 8) px(ctx, x0, gy, 80, 1, C.COLORS.wallWainscotBathDark);
    for (let gx = x0 + 8; gx < 240; gx += 16) px(ctx, gx, 76, 1, FLOOR - 76, C.COLORS.wallWainscotBathDark);
    px(ctx, x0, FLOOR - 2, 80, 1, C.COLORS.wallWainscotBathDark);
    sprinkle(ctx, x0, 78, 80, FLOOR - 80, 'rgba(0,0,0,0.08)', 'rgba(255,255,255,0.08)');

    // 圆形镜子（带渐变反光）
    const m = R.mirror;
    const cx = m.x + m.w / 2, cy = m.y + m.h / 2, rad = m.w / 2;
    // 镜框
    ctx.fillStyle = '#a08058';
    for (let dy = -rad; dy <= rad; dy++) {
      const dxr = Math.floor(Math.sqrt(rad * rad - dy * dy));
      ctx.fillRect(cx - dxr - 1, cy + dy, (dxr + 1) * 2 + 1, 1);
    }
    // 镜面（渐变：左上亮右下暗）
    const gg = ctx.createLinearGradient(cx - rad, cy - rad, cx + rad, cy + rad);
    gg.addColorStop(0, '#e8f6fa');
    gg.addColorStop(0.55, '#b8d8e2');
    gg.addColorStop(1, '#8ab0be');
    ctx.fillStyle = gg;
    for (let dy = -rad + 1; dy <= rad - 1; dy++) {
      const dxr = Math.floor(Math.sqrt((rad - 1) * (rad - 1) - dy * dy));
      ctx.fillRect(cx - dxr, cy + dy, dxr * 2 + 1, 1);
    }
    // 反光高光弧
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let dy = -rad + 2; dy <= -rad + 5; dy++) {
      const dxr = Math.floor(Math.sqrt((rad - 2) * (rad - 2) - dy * dy));
      ctx.fillRect(cx - dxr + 1, cy + dy, Math.max(2, dxr - 1), 1);
    }
    // 镜面内人物倒影（简化：淡色小点）
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.fillRect(cx - 2, cy + 2, 4, 1);

    // 毛巾架 + 毛巾
    const t = R.towel;
    px(ctx, t.x - 2, t.y - 1, 8, 1, '#c0b8a8');
    px(ctx, t.x - 2, t.y - 1, 8, 1, '#d8d0c0');
    px(ctx, t.x, t.y, t.w, t.h, '#e8e2d2');
    px(ctx, t.x, t.y + 3, 1, 6, '#7ac0d0');
    px(ctx, t.x + 1, t.y + 2, 1, 7, '#5aa0b0');
    px(ctx, t.x + 2, t.y + 4, 1, 6, '#7ac0d0');
    px(ctx, t.x, t.y, t.w, 1, '#f8f4ec');
  }

  function drawKitchenDecor(ctx, st) {
    const R = FURN.kitchen;
    const x0 = 240;
    // 上半墙：米白小方格瓷砖 4x4
    for (let gy = CEIL; gy < 84; gy += 4) {
      for (let gx = x0; gx < 320; gx += 4) {
        const cw = Math.min(4, 320 - gx), ch = Math.min(4, 84 - gy);
        const alt = ((gx - x0) / 4 + (gy - CEIL) / 4) % 2 === 0;
        px(ctx, gx, gy, cw, ch, alt ? C.COLORS.wallTileSmall : '#dce4e6');
        ctx.fillStyle = C.COLORS.wallTileSmallGrout;
        ctx.fillRect(gx + cw - 1, gy, 1, ch);
        ctx.fillRect(gx, gy + ch - 1, cw, 1);
      }
    }
    // 下半墙：深绿色护墙板
    px(ctx, x0, 84, 80, FLOOR - 84, C.COLORS.wallWainscotKitchen);
    for (let gy = 84; gy < FLOOR; gy += 8) px(ctx, x0, gy, 80, 1, C.COLORS.wallWainscotKitchenDark);
    for (let gx = x0 + 8; gx < 320; gx += 16) px(ctx, gx, 84, 1, FLOOR - 84, C.COLORS.wallWainscotKitchenDark);
    px(ctx, x0, FLOOR - 2, 80, 1, C.COLORS.wallWainscotKitchenDark);
    // 护墙板上沿高光
    px(ctx, x0, 84, 80, 1, '#5a8a5a');
    sprinkle(ctx, x0, 86, 80, FLOOR - 88, 'rgba(0,0,0,0.08)', 'rgba(160,220,160,0.08)');

    // 锅铲挂钩
    const pr = R.potRack;
    px(ctx, pr.x, pr.y, pr.w, 1, '#7a7a88');
    px(ctx, pr.x, pr.y, pr.w, 1, '#9a9aa8');
    px(ctx, pr.x + 2, pr.y + 1, 1, 1, '#8a8a98');
    px(ctx, pr.x + 7, pr.y + 1, 1, 1, '#8a8a98');
    px(ctx, pr.x + 13, pr.y + 1, 1, 1, '#8a8a98');
    // 挂锅 1（深灰）
    px(ctx, pr.x + 1, pr.y + 2, 4, 3, '#5a5a66');
    px(ctx, pr.x + 1, pr.y + 2, 4, 1, '#6a6a76');
    px(ctx, pr.x + 3, pr.y + 5, 2, 2, '#4a4a56');
    // 挂锅 2（红棕）
    px(ctx, pr.x + 6, pr.y + 2, 4, 4, '#8a4a3a');
    px(ctx, pr.x + 6, pr.y + 2, 4, 1, '#a05a48');
    // 锅铲
    px(ctx, pr.x + 13, pr.y + 2, 1, 6, '#8a6a4a');
    px(ctx, pr.x + 12, pr.y + 7, 3, 1, '#c0a880');

    // 置物架 + 调料罐
    const sh = R.wallShelf;
    px(ctx, sh.x, sh.y, sh.w, 2, C.COLORS.woodLight);
    px(ctx, sh.x, sh.y + 2, sh.w, 1, C.COLORS.woodDark);
    // 罐子
    px(ctx, sh.x + 2, sh.y - 4, 3, 4, '#e8e4d8');
    px(ctx, sh.x + 2, sh.y - 5, 3, 1, '#a08058');
    px(ctx, sh.x + 7, sh.y - 5, 3, 5, '#b8d8b0');
    px(ctx, sh.x + 7, sh.y - 6, 3, 1, '#7a9a6a');
    px(ctx, sh.x + 13, sh.y - 4, 3, 4, '#e0a080');
    px(ctx, sh.x + 13, sh.y - 5, 3, 1, '#c08060');
  }

  // ============================================================
  // 窗户：静态部分（窗帘/外框/窗台/小花）+ 动态部分（天空/中梃/反光/霜）
  // ============================================================
  function drawWindowsStatic(ctx, st) {
    for (let i = 0; i < 4; i++) drawWindowStatic(ctx, st, i);
  }
  function drawWindowsDynamic(ctx, st) {
    for (let i = 0; i < 4; i++) drawWindowDynamic(ctx, st, i);
  }

  function drawWindowStatic(ctx, st, roomIdx) {
    const win = FURN[C.ROOM_IDS[roomIdx]].window;
    const x = win.x, y = win.y, w = win.w, h = win.h;
    const season = st.season.id;
    const curtainCol = season === 'spring' ? '#f0a8b8' : season === 'summer' ? '#9cc8e8' : season === 'autumn' ? '#d8a05a' : '#b0605a';

    // 窗帘
    px(ctx, x - 5, y - 2, 5, h + 4, shade(curtainCol, -0.2));
    px(ctx, x - 4, y - 2, 4, h + 4, curtainCol);
    px(ctx, x - 4, y - 2, 1, h + 4, shade(curtainCol, 0.22));
    px(ctx, x + w, y - 2, 5, h + 4, shade(curtainCol, -0.2));
    px(ctx, x + w + 1, y - 2, 4, h + 4, curtainCol);
    px(ctx, x + w + 1, y - 2, 1, h + 4, shade(curtainCol, 0.22));
    px(ctx, x - 6, y - 3, w + 12, 2, shade(curtainCol, -0.35));

    // 窗框外沿（玻璃区域由动态绘制填充）
    px(ctx, x - 2, y - 2, w + 4, 2, '#e8e2d2');
    px(ctx, x - 2, y - 2, 2, h + 2, '#e8e2d2');
    px(ctx, x + w, y - 2, 2, h + 2, '#e8e2d2');
    // 窗台 + 阴影
    px(ctx, x - 3, y + h + 2, w + 6, 2, '#c9bfa8');
    px(ctx, x - 3, y + h + 4, w + 6, 1, 'rgba(0,0,0,0.22)');

    // 窗台小花（春夏）
    if (season === 'spring' || season === 'summer') {
      px(ctx, x + 1, y + h + 1, 4, 3, '#a0522d');
      px(ctx, x + 2, y + h - 3, 2, 4, '#3d7a3a');
      const fc = season === 'spring' ? '#ff7ba2' : '#ffd23e';
      px(ctx, x + 1, y + h - 5, 1, 2, fc);
      px(ctx, x + 3, y + h - 5, 1, 2, fc);
      px(ctx, x + 2, y + h - 6, 1, 1, '#ffffff');
    }
  }

  function drawWindowDynamic(ctx, st, roomIdx) {
    const win = FURN[C.ROOM_IDS[roomIdx]].window;
    const x = win.x, y = win.y, w = win.w, h = win.h;
    const season = st.season.id;
    // 天空底（动态：太阳/月亮/云）
    P.Lighting.drawWindowBackdrop(ctx, st, x, y, w, h);
    // 中梃
    px(ctx, x + (w >> 1), y, 1, h, '#e8e2d2');
    px(ctx, x, y + (h >> 1), w, 1, '#e8e2d2');
    // 玻璃反光
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x + 2, y + 2, (w >> 1) - 2, 3);
    ctx.fillRect(x + 2, y + 8, (w >> 2) - 1, 2);
    // 冬季窗霜
    if (season === 'winter') {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      for (let i = 0; i < 6; i++) ctx.fillRect(x + 1 + (i % 4) * 3, y + 1 + ((i * 7) % (h - 4)), 2, 2);
    }
  }

  // ============================================================
  // z=1 中景家具：衣柜/书架/灶台/洗手台/冰箱/吊柜/浴室
  // ============================================================
  function drawMidFurniture(ctx, st) {
    drawWardrobe(ctx, st);            // 卧室衣柜
    drawBookshelf(ctx, st);           // 工作区书架
    drawCounterGroup(ctx, st);        // 厨房台面+灶台+水槽
    drawFridge(ctx, st);              // 厨房冰箱
    drawKitchenCabinets(ctx, st);     // 厨房吊柜
    drawVanityGroup(ctx, st);         // 卫生间洗手台
    drawToilet(ctx, st);              // 马桶
    drawShower(ctx, st);              // 淋浴间
    drawBathCabinet(ctx, st);         // 卫生间吊柜
  }

  function drawWardrobe(ctx, st) {
    const R = FURN.bedroom.wardrobe;
    // 地面投影
    groundShadow(ctx, R.x - 1, R.y + R.h - 1, R.w + 2, 3);
    // 柜体
    px(ctx, R.x, R.y, R.w, R.h, C.COLORS.woodMid);
    // 顶面（亮 15-20%）
    px(ctx, R.x, R.y, R.w, 2, C.COLORS.woodLight);
    px(ctx, R.x, R.y + 2, R.w, 1, 'rgba(255,255,255,0.14)');
    // 侧面阴影
    px(ctx, R.x, R.y + 2, 1, R.h - 2, C.COLORS.woodDark);
    px(ctx, R.x + R.w - 1, R.y + 2, 1, R.h - 2, C.COLORS.woodDark);
    // 底座
    px(ctx, R.x, R.y + R.h - 2, R.w, 2, C.COLORS.woodDarkest);
    // 柜门缝
    px(ctx, R.x + 6, R.y + 2, 1, R.h - 4, C.COLORS.woodDarkest);
    // 门板内框 + 木纹
    px(ctx, R.x + 1, R.y + 5, 4, 12, '#a08050');
    px(ctx, R.x + 8, R.y + 5, 4, 12, '#a08050');
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    for (let gy = R.y + 6; gy < R.y + 16; gy += 3) { ctx.fillRect(R.x + 2, gy, 2, 1); ctx.fillRect(R.x + 9, gy, 2, 1); }
    // 拉手
    px(ctx, R.x + 2, R.y + 20, 1, 2, C.COLORS.metalLight);
    px(ctx, R.x + 9, R.y + 20, 1, 2, C.COLORS.metalLight);
    px(ctx, R.x + 2, R.y + 20, 1, 1, '#ffffff');
  }

  function drawBookshelf(ctx, st) {
    const R = FURN.workspace.bookshelf;
    groundShadow(ctx, R.x - 1, R.y + R.h - 1, R.w + 2, 3);
    // 柜体
    px(ctx, R.x, R.y, R.w, R.h, C.COLORS.woodMid);
    px(ctx, R.x, R.y, R.w, 2, C.COLORS.woodLight);
    px(ctx, R.x, R.y + 2, 1, R.h - 4, C.COLORS.woodDark);
    px(ctx, R.x + R.w - 1, R.y + 2, 1, R.h - 4, C.COLORS.woodLight);
    px(ctx, R.x, R.y + R.h - 2, R.w, 2, C.COLORS.woodDark);
    // 书本
    const books = ['#c85a6a', '#4a7bd0', '#e0a84a', '#5a8f5a', '#9a6ac8'];
    for (let row = 0; row < 3; row++) {
      const shelfY = R.y + 2 + row * 9;
      let bx = R.x + 1;
      const cols = row === 0 ? 4 : row === 1 ? 3 : 5;
      for (let i = 0; i < cols; i++) {
        const bh = 5 + ((row + i) % 3);
        const c = books[(row * 7 + i * 3) % books.length];
        px(ctx, bx, shelfY - bh, 2, bh, c);
        px(ctx, bx, shelfY - bh, 2, 1, shade(c, 0.35));
        px(ctx, bx + 1, shelfY - 1, 1, 1, 'rgba(0,0,0,0.30)');
        bx += 3;
      }
      // 隔板
      px(ctx, R.x, shelfY, R.w, 1, '#96683e');
      px(ctx, R.x, shelfY, R.w, 1, '#b08050');
    }
    // 摆件（杯子 + 小雕像）
    px(ctx, R.x + 12, R.y + 8 - 3, 2, 3, '#e06060');
    px(ctx, R.x + 12, R.y + 8 - 3, 2, 1, '#f08080');
    px(ctx, R.x + 4, R.y + 17 - 2, 2, 2, '#d8a84a');
    px(ctx, R.x + 4, R.y + 19 - 2, 2, 1, '#e8c060');
    // 顶部绿植
    drawPlant(ctx, R.x + 12, R.y - 12, st.season.id);
  }

  function drawCounterGroup(ctx, st) {
    const R = FURN.kitchen;
    const cnt = R.counter;
    groundShadow(ctx, cnt.x - 1, cnt.y + 22, cnt.w + 2, 3);
    // 台面顶面（亮）+ 前缘
    px(ctx, cnt.x, cnt.y, cnt.w, 2, '#d8c8a8');
    px(ctx, cnt.x, cnt.y, cnt.w, 1, '#e8dcc0');
    px(ctx, cnt.x, cnt.y + 2, cnt.w, 2, '#c8b896');
    px(ctx, cnt.x, cnt.y + 4, cnt.w, 1, 'rgba(0,0,0,0.20)');
    // 柜门（凹槽线 + 拉手）
    px(ctx, cnt.x, cnt.y + 5, cnt.w, 19, '#a0927e');
    for (let i = 0; i < 3; i++) {
      const cx2 = cnt.x + 2 + i * 12;
      px(ctx, cx2, cnt.y + 7, 10, 16, '#b0a28e');
      px(ctx, cx2 + 1, cnt.y + 7, 1, 16, '#c2b4a0');
      px(ctx, cx2 + 9, cnt.y + 7, 1, 16, '#8a8070');
      // 凹槽把手
      px(ctx, cx2 + 4, cnt.y + 13, 2, 4, '#7a7060');
      px(ctx, cx2 + 4, cnt.y + 13, 1, 4, '#5a5040');
    }
    // 灶台（台面上）
    drawStoveTop(ctx, st);
    // 水槽（台面上，内凹）
    drawKitchenSink(ctx, st);
    // 台面绿植
    drawPlant(ctx, R.plant.x, R.plant.y, st.season.id);
    // 台面噪点
    sprinkle(ctx, cnt.x, cnt.y, cnt.w, 4, 'rgba(0,0,0,0.06)', 'rgba(255,255,255,0.08)');
  }

  function drawStoveTop(ctx, st) {
    const R = FURN.kitchen;
    const x = R.stove.x, y = 99; // 灶台主体在台面顶
    // 灶体
    px(ctx, x, y, R.stove.w, 5, '#3a3a44');
    px(ctx, x, y, R.stove.w, 1, '#55555f');
    // 燃烧器（内凹圈）
    px(ctx, x + 1, y + 1, 3, 2, '#23232c');
    px(ctx, x + 1, y + 1, 1, 1, '#45454f');
    px(ctx, x + 8, y + 1, 3, 2, '#23232c');
    px(ctx, x + 8, y + 1, 1, 1, '#45454f');
    // 旋钮
    px(ctx, x + 5, y + 3, 1, 2, '#6a6a76');
    px(ctx, x + 10, y + 3, 1, 2, '#6a6a76');
    // 锅（左灶上）
    px(ctx, x + 1, y - 4, 5, 3, '#6a6a76');
    px(ctx, x + 1, y - 5, 2, 1, '#7a7a86');
    // 平底锅（右灶上）
    px(ctx, x + 7, y - 3, 4, 2, '#8a4a3a');
    px(ctx, x + 8, y - 4, 2, 1, '#a05a48');
  }

  function drawKitchenSink(ctx, st) {
    const R = FURN.kitchen.sink; // (298,100,10,6)
    // 水槽内凹（深色盆地 + 亮边）
    px(ctx, R.x, 102, R.w, 5, '#9aa0a8');
    px(ctx, R.x, 102, R.w, 1, '#e8e8ec');
    px(ctx, R.x + 1, 103, R.w - 2, 3, '#7a828a');
    px(ctx, R.x + 1, 104, R.w - 2, 1, '#5a626a');
    // 水龙头（金属高光）
    px(ctx, R.x + 4, 96, 2, 4, C.COLORS.metalMid);
    px(ctx, R.x + 5, 95, 1, 1, C.COLORS.metalLight);
    px(ctx, R.x + 4, 96, 1, 4, C.COLORS.metalLight);
    px(ctx, R.x + 3, 99, 4, 1, C.COLORS.metalDark);
    // 出水嘴
    px(ctx, R.x + 4, 93, 3, 1, C.COLORS.metalMid);
    px(ctx, R.x + 5, 93, 1, 1, '#ffffff');
    // 水槽里的碗（饭后出现，下次洗漱时洗掉）
    if ((P.Storage.state.items || {}).dishes) {
      px(ctx, R.x + 3, 103, 3, 2, '#f0ead8');
      px(ctx, R.x + 3, 103, 3, 1, '#ffffff');
      px(ctx, R.x + 4, 105, 1, 1, 'rgba(0,0,0,0.3)');
    }
  }

  function drawFridge(ctx, st) {
    const R = FURN.kitchen.fridge;
    groundShadow(ctx, R.x - 1, R.y + R.h - 1, R.w + 2, 3);
    // 柜体（圆角：上下两角去 1px）
    px(ctx, R.x + 1, R.y, R.w - 2, R.h, '#d8dce4');
    px(ctx, R.x, R.y + 1, 1, R.h - 1, '#d8dce4');
    px(ctx, R.x + R.w - 1, R.y + 1, 1, R.h - 1, '#d8dce4');
    // 顶面高光 + 圆角高光
    px(ctx, R.x + 1, R.y, R.w - 2, 2, '#eef1f6');
    px(ctx, R.x, R.y + 1, 1, 2, '#eef1f6');
    px(ctx, R.x + R.w - 1, R.y + 1, 1, 2, '#eef1f6');
    // 侧面阴影/高光
    px(ctx, R.x, R.y + 3, 1, R.h - 4, '#c0c4cc');
    px(ctx, R.x + R.w - 1, R.y + 3, 1, R.h - 4, '#e8ecf2');
    // 门缝线
    px(ctx, R.x + 2, R.y + (R.h >> 1) - 1, R.w - 4, 1, '#b8bcc8');
    px(ctx, R.x + 2, R.y + (R.h >> 1), R.w - 4, 1, 'rgba(255,255,255,0.25)');
    // 拉手
    px(ctx, R.x + R.w - 4, R.y + 8, 1, 4, '#9aa0ae');
    px(ctx, R.x + R.w - 4, R.y + (R.h >> 1) + 8, 1, 4, '#9aa0ae');
    // 磁性贴
    px(ctx, R.x + 3, R.y + 6, 2, 2, '#ff8a5a');
    px(ctx, R.x + 7, R.y + 5, 2, 2, '#5ac8ff');
    // 底部
    px(ctx, R.x + 1, R.y + R.h - 2, R.w - 2, 2, '#c4c8d0');
  }

  function drawKitchenCabinets(ctx, st) {
    const R = FURN.kitchen.cabinets;
    // 吊柜（木质）
    px(ctx, R.x, R.y, R.w, R.h, C.COLORS.woodMid);
    px(ctx, R.x, R.y, R.w, 1, C.COLORS.woodLight);
    px(ctx, R.x, R.y + 1, 1, R.h - 1, C.COLORS.woodDark);
    px(ctx, R.x + R.w - 1, R.y + 1, 1, R.h - 1, C.COLORS.woodDark);
    px(ctx, R.x, R.y + (R.h >> 1), R.w, 1, C.COLORS.woodDarkest);
    // 门板 + 拉手
    px(ctx, R.x + 1, R.y + 2, R.w / 2 - 2, R.h / 2 - 2, '#c2baa8');
    px(ctx, R.x + R.w / 2, R.y + 2, R.w / 2 - 2, R.h / 2 - 2, '#c2baa8');
    px(ctx, R.x + 2, R.y + 6, 1, 2, C.COLORS.metalLight);
    px(ctx, R.x + R.w - 3, R.y + 6, 1, 2, C.COLORS.metalLight);
    px(ctx, R.x + 1, R.y + R.h / 2 + 2, R.w / 2 - 2, R.h / 2 - 2, '#c2baa8');
    px(ctx, R.x + R.w / 2, R.y + R.h / 2 + 2, R.w / 2 - 2, R.h / 2 - 2, '#c2baa8');
    px(ctx, R.x + 2, R.y + R.h / 2 + 6, 1, 2, C.COLORS.metalLight);
    px(ctx, R.x + R.w - 3, R.y + R.h / 2 + 6, 1, 2, C.COLORS.metalLight);
  }

  function drawVanityGroup(ctx, st) {
    const R = FURN.bathroom.sink;
    groundShadow(ctx, R.x - 1, R.y + 24, R.w + 2, 3);
    // 柜体
    px(ctx, R.x, R.y + 12, R.w, 14, C.COLORS.woodMid);
    px(ctx, R.x, R.y + 12, R.w, 1, C.COLORS.woodDark);
    // 柜门缝 + 拉手
    px(ctx, R.x + R.w / 2, R.y + 13, 1, 12, C.COLORS.woodDarkest);
    px(ctx, R.x + R.w / 2 - 2, R.y + 17, 1, 2, C.COLORS.metalLight);
    px(ctx, R.x + R.w / 2 + 2, R.y + 17, 1, 2, C.COLORS.metalLight);
    // 台面（顶面高光 + 前缘）
    px(ctx, R.x, R.y, R.w, 3, '#e8e8ec');
    px(ctx, R.x, R.y, R.w, 1, '#f8f8fc');
    px(ctx, R.x, R.y + 3, R.w, 2, '#d4d4dc');
    px(ctx, R.x, R.y + 5, R.w, 1, 'rgba(0,0,0,0.18)');
    // 台盆（内凹弧线）
    px(ctx, R.x + 2, R.y + 2, R.w - 4, 5, '#b8bcc4');
    px(ctx, R.x + 2, R.y + 2, R.w - 4, 1, '#f4f4f8');
    px(ctx, R.x + 3, R.y + 3, R.w - 6, 3, '#8a9098');
    px(ctx, R.x + 3, R.y + 4, R.w - 6, 1, '#6a7078');
    // 水龙头（金属高光）
    px(ctx, R.x + R.w / 2, R.y - 3, 2, 3, C.COLORS.metalMid);
    px(ctx, R.x + R.w / 2, R.y - 4, 1, 1, '#ffffff');
    px(ctx, R.x + R.w / 2, R.y - 3, 1, 3, C.COLORS.metalLight);
    px(ctx, R.x + R.w / 2 - 1, R.y, 4, 1, C.COLORS.metalDark);
    // 台面皂盒
    px(ctx, R.x + 1, R.y + 1, 2, 2, '#a8d8c8');
  }

  function drawToilet(ctx, st) {
    const R = FURN.bathroom.toilet;
    groundShadow(ctx, R.x - 1, R.y + R.h - 1, R.w + 2, 3);
    // 水箱（上）
    px(ctx, R.x + 2, R.y - 2, R.w - 2, 8, '#e8e8ec');
    px(ctx, R.x + 2, R.y - 2, R.w - 2, 1, '#ffffff');
    px(ctx, R.x + 2, R.y - 1, 1, 7, 'rgba(0,0,0,0.12)');
    px(ctx, R.x + R.w - 3, R.y - 1, 1, 7, 'rgba(0,0,0,0.08)');
    // 冲水钮
    px(ctx, R.x + 6, R.y, 2, 1, '#c8c8d0');
    // 坐面（降低到小人膝盖以下：y=114，坐下腿可自然弯曲）
    px(ctx, R.x, 114, R.w, 4, '#f4f4f8');
    px(ctx, R.x, 114, R.w, 1, '#ffffff');
    px(ctx, R.x + 1, 117, R.w - 2, 1, 'rgba(0,0,0,0.10)');
    // 桶身（喇叭形，落至地面）
    px(ctx, R.x + 1, 118, R.w - 2, 10, '#d8d8e0');
    px(ctx, R.x + 1, 118, 2, 10, '#e8e8f0');
    px(ctx, R.x + R.w - 3, 118, 2, 10, '#c8c8d0');
    // 底座
    px(ctx, R.x, 126, R.w, 2, '#c0c0cc');
    px(ctx, R.x + 4, 120, 1, 1, '#c0c0cc');
  }

  function drawShower(ctx, st) {
    const R = FURN.bathroom.shower;
    groundShadow(ctx, R.x, R.y + R.h - 2, R.w, 2);
    // 顶部框架 + 玻璃面板（半透明）
    ctx.fillStyle = 'rgba(160,220,230,0.32)';
    ctx.fillRect(R.x, R.y, R.w, R.h);
    // 玻璃边框
    px(ctx, R.x, R.y, R.w, 2, '#b8c8d0');
    px(ctx, R.x, R.y, 2, R.h, '#b8c8d0');
    px(ctx, R.x + R.w - 2, R.y, 2, R.h, '#b8c8d0');
    px(ctx, R.x, R.y + R.h - 1, R.w, 1, '#9aa8b0');
    // 玻璃高光斜线
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(R.x + 3, R.y + 2, 2, R.h - 4);
    ctx.fillRect(R.x + 7, R.y + 2, 1, R.h - 4);
    // 排水格
    px(ctx, R.x + 8, R.y + R.h - 1, 4, 1, '#8a9a98');
    px(ctx, R.x + 9, R.y + R.h - 2, 2, 1, '#6a7a78');
    // 花洒管（墙上）
    const sh = FURN.bathroom.showerHead;
    px(ctx, sh.x + 1, sh.y + 6, 1, 38, '#b8b8c0');
    px(ctx, sh.x + 1, sh.y + 6, 1, 3, '#d8d8e0');
    px(ctx, sh.x, sh.y + 42, 4, 2, '#c8c8d0');
    px(ctx, sh.x, sh.y + 42, 1, 1, '#e8e8f0');
  }

  function drawBathCabinet(ctx, st) {
    const R = FURN.bathroom.cabinet;
    px(ctx, R.x, R.y, R.w, R.h, '#b0a896');
    px(ctx, R.x, R.y, R.w, 1, '#c8c0ae');
    px(ctx, R.x, R.y + 1, 1, R.h - 1, '#8a8272');
    px(ctx, R.x + R.w - 1, R.y + 1, 1, R.h - 1, '#c8c0ae');
    px(ctx, R.x, R.y + (R.h >> 1), R.w, 1, '#9a9080');
    // 门板
    px(ctx, R.x + 1, R.y + 2, R.w / 2 - 1, R.h / 2 - 2, '#c2baa8');
    px(ctx, R.x + R.w / 2, R.y + 2, R.w / 2 - 1, R.h / 2 - 2, '#c2baa8');
    px(ctx, R.x + 1, R.y + R.h / 2 + 1, R.w / 2 - 1, R.h / 2 - 2, '#c2baa8');
    px(ctx, R.x + R.w / 2, R.y + R.h / 2 + 1, R.w / 2 - 1, R.h / 2 - 2, '#c2baa8');
    px(ctx, R.x + 2, R.y + 6, 1, 2, C.COLORS.metalLight);
    px(ctx, R.x + R.w - 3, R.y + 6, 1, 2, C.COLORS.metalLight);
    px(ctx, R.x + 2, R.y + R.h / 2 + 5, 1, 2, C.COLORS.metalLight);
    px(ctx, R.x + R.w - 3, R.y + R.h / 2 + 5, 1, 2, C.COLORS.metalLight);
  }

  // ============================================================
  // z=2 前景家具：床/床头柜/电脑桌/餐桌椅
  // ============================================================
  function drawForeFurniture(ctx, st) {
    drawBed(ctx, st);
    drawNightstand(ctx, st);
    drawDeskGroup(ctx, st);
    drawTableGroup(ctx, st);
  }

  function drawBed(ctx, st) {
    const R = FURN.bedroom;
    // 地面投影
    groundShadow(ctx, R.bed.x + 1, R.bed.y + 15, R.bed.w - 2, 3);
    // 床头板（厚度 + 顶面高光）
    px(ctx, R.bed.x, 100, 4, 28, C.COLORS.woodMid);
    px(ctx, R.bed.x, 100, 4, 2, C.COLORS.woodLight);
    px(ctx, R.bed.x, 100, 1, 28, C.COLORS.woodDark);
    px(ctx, R.bed.x + 3, 100, 1, 28, C.COLORS.woodLight);
    px(ctx, R.bed.x + 1, 106, 1, 18, C.COLORS.woodDark);
    // 床架
    px(ctx, R.bed.x, R.bed.y + 10, R.bed.w, 6, '#7a4a2c');
    px(ctx, R.bed.x, R.bed.y + 10, R.bed.w, 2, '#8f5a36');
    px(ctx, R.bed.x, R.bed.y + 10, 1, 6, '#96683e');
    // 床垫（高度 + 顶面高光）
    px(ctx, R.bed.x, R.bed.y, R.bed.w, 9, '#f4e8d4');
    px(ctx, R.bed.x, R.bed.y, R.bed.w, 1, '#fff8ec');
    px(ctx, R.bed.x, R.bed.y + 8, R.bed.w, 1, '#e0d8cc');
    // 枕头（立体感）
    px(ctx, R.pillow.x, R.pillow.y, R.pillow.w, R.pillow.h, '#ffffff');
    px(ctx, R.pillow.x, R.pillow.y, R.pillow.w, 1, '#fffdf6');
    px(ctx, R.pillow.x, R.pillow.y + R.pillow.h - 1, R.pillow.w, 1, '#d8d0c4');
    px(ctx, R.pillow.x, R.pillow.y + 2, 1, 4, '#e8e2d8');
    // 被子（随状态变化：睡觉盖身 / 睡前铺好 / 白天乱糟糟）
    drawBlanketMode(ctx, R, st);
    // 床腿（前后层次）
    px(ctx, R.bed.x + 1, R.bed.y + 16, 2, 2, C.COLORS.woodDarkest);
    px(ctx, R.bed.x + R.bed.w - 3, R.bed.y + 16, 2, 2, C.COLORS.woodDarkest);
  }

  // 被子三种形态（状态存于 P.Storage.state.items.blanket）
  function drawBlanketMode(ctx, R, st) {
    const mode = (P.Storage.state.items || {}).blanket || 'cover';
    const b = R.blanket; // (17,112,27,8)
    if (mode === 'cover') {
      // 睡觉：平整盖在身上
      px(ctx, b.x, b.y, b.w, b.h, '#5a8fc8');
      px(ctx, b.x, b.y, b.w, 2, '#6fa3d8');
      px(ctx, b.x, b.y, b.w, 1, '#7db1e0');
      px(ctx, b.x, b.y + b.h - 1, b.w, 1, '#4a78a8');
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      for (let i = 0; i < 4; i++) ctx.fillRect(b.x + 4 + i * 6, b.y + 3, 3, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let i = 0; i < 4; i++) ctx.fillRect(b.x + 5 + i * 6, b.y + 5, 1, b.h - 5);
    } else if (mode === 'made') {
      // 睡前铺好：整齐叠在床尾
      px(ctx, 31, 112, 13, 8, '#5a8fc8');
      px(ctx, 31, 112, 13, 1, '#7db1e0');
      px(ctx, 31, 116, 13, 1, '#4a78a8');
      px(ctx, 31, 119, 13, 1, '#4a78a8');
      px(ctx, 31, 112, 1, 8, '#4a78a8');
      px(ctx, 43, 112, 1, 8, '#6fa3d8');
    } else {
      // 白天：乱糟糟堆在床尾 + 歪斜 + 垂落
      px(ctx, 27, 113, 17, 7, '#5a8fc8');
      px(ctx, 29, 111, 11, 4, '#6fa3d8');
      px(ctx, 35, 112, 9, 5, '#5584b8');
      px(ctx, 39, 117, 5, 3, '#6fa3d8');
      px(ctx, 30, 115, 14, 1, '#4a78a8');
      px(ctx, 33, 113, 1, 7, '#4a78a8');
      px(ctx, 37, 114, 1, 6, '#4a78a8');
      px(ctx, 41, 116, 1, 4, '#4a78a8');
    }
  }

  function drawNightstand(ctx, st) {
    const R = FURN.bedroom;
    // 床头柜
    groundShadow(ctx, R.nightstand.x - 1, R.nightstand.y + 11, R.nightstand.w + 2, 2);
    px(ctx, R.nightstand.x, R.nightstand.y, R.nightstand.w, 2, C.COLORS.woodLight);
    px(ctx, R.nightstand.x, R.nightstand.y + 2, R.nightstand.w, 7, C.COLORS.woodMid);
    px(ctx, R.nightstand.x, R.nightstand.y + 2, 1, 7, C.COLORS.woodDark);
    px(ctx, R.nightstand.x + 2, R.nightstand.y + 6, R.nightstand.w - 4, 1, C.COLORS.woodDarkest);
    px(ctx, R.nightstand.x + R.nightstand.w - 2, R.nightstand.y + 6, 1, 1, C.COLORS.metalLight);
    px(ctx, R.nightstand.x, R.nightstand.y + 9, R.nightstand.w, 3, C.COLORS.woodDark);
    // 台灯（立体感）
    const lampOn = lampOnF('nightLamp');
    px(ctx, R.nightLamp.x + 1, R.nightLamp.y + 11, 2, 3, '#4a4a5a');
    px(ctx, R.nightLamp.x, R.nightLamp.y + 14, 4, 2, '#3a3a4a');
    px(ctx, R.nightLamp.x, R.nightLamp.y, 4, 4, lampOn ? '#ffe9b0' : '#d8d2c8');
    px(ctx, R.nightLamp.x, R.nightLamp.y, 4, 1, lampOn ? '#fff3c4' : '#e8e2d8');
    px(ctx, R.nightLamp.x + 3, R.nightLamp.y + 1, 1, 3, 'rgba(0,0,0,0.18)');
    px(ctx, R.nightLamp.x + 1, R.nightLamp.y + 4, 2, 2, lampOn ? '#fff3c4' : '#c8c2b8');
  }

  function drawDeskGroup(ctx, st) {
    const R = FURN.workspace;
    // 桌面 + 腿（前后层次）
    groundShadow(ctx, R.desk.x - 1, R.desk.y + 18, R.desk.w + 2, 3);
    px(ctx, R.desk.x, R.desk.y, R.desk.w, 2, C.COLORS.woodLight);
    px(ctx, R.desk.x, R.desk.y + 2, R.desk.w, 2, C.COLORS.woodMid);
    px(ctx, R.desk.x, R.desk.y + 4, R.desk.w, 1, 'rgba(0,0,0,0.22)');
    // 后腿（暗）
    px(ctx, R.desk.x + 2, R.desk.y + 5, 3, 15, C.COLORS.woodDarkest);
    px(ctx, R.desk.x + R.desk.w - 5, R.desk.y + 5, 3, 15, C.COLORS.woodDarkest);
    // 前腿（亮，带高光）
    px(ctx, R.desk.x + 1, R.desk.y + 5, 3, 15, C.COLORS.woodMid);
    px(ctx, R.desk.x + R.desk.w - 4, R.desk.y + 5, 3, 15, C.COLORS.woodMid);
    px(ctx, R.desk.x + 1, R.desk.y + 5, 1, 15, C.COLORS.woodLight);
    px(ctx, R.desk.x + R.desk.w - 4, R.desk.y + 5, 1, 15, C.COLORS.woodLight);
    // 抽屉线
    px(ctx, R.desk.x + 1, R.desk.y + 8, 7, 1, C.COLORS.woodDark);
    // 便签
    px(ctx, R.desk.x + 2, R.desk.y - 2, 10, 2, '#e8d8b0');
    px(ctx, R.desk.x + 3, R.desk.y - 1, 6, 1, '#c8b890');
    // 显示器外壳（静态部分：边框/支架；屏幕内容动态）
    drawMonitorShell(ctx, st);
    // 键盘（凸起）
    px(ctx, R.keyboard.x, R.keyboard.y - 1, R.keyboard.w, 1, '#4a4a58');
    px(ctx, R.keyboard.x, R.keyboard.y, R.keyboard.w, R.keyboard.h, '#3a3a46');
    for (let i = 0; i < 6; i++) px(ctx, R.keyboard.x + 2 + i * 2, R.keyboard.y, 1, 1, '#55555f');
    px(ctx, R.keyboard.x, R.keyboard.y + R.keyboard.h, R.keyboard.w, 1, '#2a2a34');
    // 咖啡杯（液面随状态变化；猫在桌面时被推歪）
    drawCoffeeCup(ctx, st);
    // 台灯
    const dlOn = lampOnF('deskLamp');
    px(ctx, R.deskLamp.x + 3, R.deskLamp.y + 11, 1, 6, '#3a3a46');
    px(ctx, R.deskLamp.x + 2, R.deskLamp.y + 15, 3, 2, '#2e2e3a');
    px(ctx, R.deskLamp.x, R.deskLamp.y, 6, 3, dlOn ? '#ffe9b0' : '#cfc8c0');
    px(ctx, R.deskLamp.x, R.deskLamp.y, 6, 1, dlOn ? '#fff6d8' : '#e0dac8');
    px(ctx, R.deskLamp.x + 5, R.deskLamp.y + 1, 1, 2, 'rgba(0,0,0,0.2)');
    px(ctx, R.deskLamp.x + 1, R.deskLamp.y + 3, 4, 2, dlOn ? '#fff3c4' : '#b8b2a8');
    // 椅子（立体感）
    drawChair(ctx, st);
  }

  function drawMonitorShell(ctx, st) {
    const R = FURN.workspace.monitor;
    // 支架（前后层次）
    px(ctx, R.x + 6, R.y + 20, 2, 4, '#3a3e4e');
    px(ctx, R.x + 5, R.y + 21, 1, 3, '#4a4e5e');
    px(ctx, R.x + 4, R.y + 24, 6, 2, '#2e2e3a');
    px(ctx, R.x + 4, R.y + 24, 6, 1, '#4a4e5e');
    // 底座阴影（落在桌面上）
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(R.x + 4, R.y + 26, 6, 1);
    // 外壳（顶面高光 + 侧面阴影）
    px(ctx, R.x, R.y, R.w, R.h, '#2a2d3a');
    px(ctx, R.x, R.y, R.w, 2, '#3a3e4e');
    px(ctx, R.x, R.y + 2, R.w, 1, '#4a4e5e');
    px(ctx, R.x, R.y + 2, 2, R.h - 4, '#1c1e28');
    px(ctx, R.x + R.w - 2, R.y + 2, 2, R.h - 4, '#343847');
    px(ctx, R.x, R.y + R.h - 2, R.w, 2, '#1c1e28');
    // 屏幕凹槽（动态内容绘制其上）
    px(ctx, R.x + 1, R.y + 2, R.w - 2, R.h - 6, '#0d1017');
    px(ctx, R.x + 1, R.y + 2, R.w - 2, 1, '#1a1d28');
  }

  // 咖啡杯：液面高度随存档状态变化（猫在桌面时被推歪 + 咖啡泼溅）
  function drawCoffeeCup(ctx, st) {
    const R = FURN.workspace;
    const it = P.Storage.state.items || {};
    const cupLvl = it.cup != null ? it.cup : 4;
    const perch = P.Cat.perchId ? P.Cat.perchId() : null;
    const pushed = perch === 'desk';
    const cx = R.mug.x + (pushed ? 1 : 0);
    // 杯身
    px(ctx, cx, R.mug.y, R.mug.w, R.mug.h, '#e06060');
    px(ctx, cx, R.mug.y, R.mug.w, 1, '#f08080');
    px(ctx, cx, R.mug.y + 1, 1, R.mug.h - 1, '#f0a0a0');
    // 咖啡液面（高度 0-3px）
    const fillH = Math.round((cupLvl / 4) * 3);
    if (fillH > 0) {
      px(ctx, cx + 1, R.mug.y + R.mug.h - fillH, R.mug.w - 2, fillH, '#4a2a1a');
      px(ctx, cx + 1, R.mug.y + R.mug.h - fillH, R.mug.w - 2, 1, '#6a4030');
    }
    // 杯把
    px(ctx, cx + 2, R.mug.y + R.mug.h - 1, 1, 1, '#c04040');
    px(ctx, cx + 3, R.mug.y + R.mug.h - 2, 1, 1, '#e08080');
  }

  function drawChair(ctx, st) {
    const R = FURN.workspace.chair;
    groundShadow(ctx, R.x - 1, R.y + 11, R.w + 1, 2);
    // 座面（顶面高光）
    px(ctx, R.x, R.y + 3, R.w - 4, 2, C.COLORS.woodLight);
    px(ctx, R.x, R.y + 5, R.w - 4, 3, C.COLORS.woodMid);
    px(ctx, R.x, R.y + 3, R.w - 4, 1, '#b08050');
    // 靠背
    px(ctx, R.x + R.w - 4, R.y, 4, R.h - 6, C.COLORS.woodMid);
    px(ctx, R.x + R.w - 4, R.y, 4, 1, C.COLORS.woodLight);
    px(ctx, R.x + R.w - 4, R.y + 1, 1, R.h - 7, C.COLORS.woodDark);
    px(ctx, R.x + R.w - 2, R.y + 1, 1, R.h - 7, C.COLORS.woodLight);
    // 腿
    px(ctx, R.x + 1, R.y + 8, 2, 4, C.COLORS.woodDark);
    px(ctx, R.x + 7, R.y + 8, 2, 4, C.COLORS.woodDark);
    px(ctx, R.x + 1, R.y + 8, 1, 4, C.COLORS.woodDarkest);
    px(ctx, R.x + 7, R.y + 8, 1, 4, C.COLORS.woodDarkest);
  }

  function drawTableGroup(ctx, st) {
    const R = FURN.kitchen;
    // 餐桌
    groundShadow(ctx, R.table.x - 1, R.table.y + 16, R.table.w + 2, 2);
    px(ctx, R.table.x, R.table.y, R.table.w, 2, C.COLORS.woodLight);
    px(ctx, R.table.x, R.table.y + 2, R.table.w, 2, C.COLORS.woodMid);
    px(ctx, R.table.x, R.table.y + 4, R.table.w, 1, 'rgba(0,0,0,0.22)');
    px(ctx, R.table.x + 2, R.table.y + 5, 2, 13, C.COLORS.woodDark);
    px(ctx, R.table.x + R.table.w - 4, R.table.y + 5, 2, 13, C.COLORS.woodDark);
    px(ctx, R.table.x + 2, R.table.y + 5, 1, 13, C.COLORS.woodMid);
    // 凳子
    groundShadow(ctx, R.stoolA.x - 1, R.stoolA.y + 11, R.stoolA.w + 2, 2);
    px(ctx, R.stoolA.x, R.stoolA.y, R.stoolA.w, 2, C.COLORS.woodLight);
    px(ctx, R.stoolA.x + 1, R.stoolA.y + 2, 2, 10, C.COLORS.woodDark);
    groundShadow(ctx, R.stoolB.x - 1, R.stoolB.y + 11, R.stoolB.w + 2, 2);
    px(ctx, R.stoolB.x, R.stoolB.y, R.stoolB.w, 2, C.COLORS.woodLight);
    px(ctx, R.stoolB.x + 1, R.stoolB.y + 2, 2, 10, C.COLORS.woodDark);
    // 餐盘（静态底），食物与蒸汽动态绘制
    px(ctx, R.meal.x, R.meal.y + 2, R.meal.w + 2, 2, '#e8e8ec');
    px(ctx, R.meal.x, R.meal.y + 2, R.meal.w + 2, 1, '#f8f8fc');
    px(ctx, R.meal.x + 1, R.meal.y + 3, R.meal.w, 1, 'rgba(0,0,0,0.12)');
    px(ctx, R.meal.x + 1, R.meal.y + 1, 2, 1, '#ffffff'); // 空盘高光
  }

  // 花盆
  function drawPlant(ctx, x, y, season) {
    px(ctx, x + 1, y + 8, 5, 2, '#a0522d');
    px(ctx, x, y + 10, 7, 3, '#8a4423');
    px(ctx, x + 1, y + 10, 5, 1, '#b5623a');
    px(ctx, x + 1, y + 10, 1, 2, '#c07040');
    const leafCol = season === 'autumn' ? '#c89a3a' : season === 'winter' ? '#5a8a5a' : '#4a9a4a';
    ctx.fillStyle = leafCol;
    ctx.fillRect(x + 2, y + 2, 2, 6);
    ctx.fillRect(x + 4, y, 2, 8);
    ctx.fillRect(x + 1, y + 3, 1, 4);
    ctx.fillRect(x + 5, y + 2, 1, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x + 4, y + 1, 1, 3);
    if (season === 'spring' || season === 'summer') {
      ctx.fillStyle = season === 'spring' ? '#ff7ba2' : '#ffd23e';
      ctx.fillRect(x + 4, y - 2, 2, 2);
      ctx.fillRect(x + 2, y - 1, 1, 1);
      ctx.fillRect(x + 5, y + 1, 1, 1);
    }
  }

  // ============================================================
  // 季节小物件（静态部分）
  // ============================================================
  function drawSeasonItemsStatic(ctx, st) {
    const s = st.season.id;
    if (s === 'summer') {
      // 卧室空调
      const a = FURN.bedroom.acSpot;
      px(ctx, a.x, a.y, a.w, a.h, '#e8e8ee');
      px(ctx, a.x, a.y, a.w, 1, '#f8f8fe');
      px(ctx, a.x, a.y, 1, a.h, 'rgba(0,0,0,0.12)');
      for (let i = 0; i < 4; i++) px(ctx, a.x + 2 + i * 3, a.y + 4, 2, 1, '#8a8a96');
      px(ctx, a.x + 2, a.y + 6, 3, 2, '#7ad8ff');
      // 工作区风扇（静态机身）
      const f = FURN.workspace.fanSpot;
      px(ctx, f.x, f.y + 2, 3, 6, '#5a5a66');
      px(ctx, f.x + 1, f.y, 1, 3, '#6a6a76');
      px(ctx, f.x, f.y + 7, 4, 1, '#4a4a56');
    } else if (s === 'winter') {
      // 卧室暖气
      const h = FURN.bedroom.heaterSpot;
      px(ctx, h.x, h.y, h.w, h.h, '#c86a5a');
      for (let i = 0; i < 5; i++) px(ctx, h.x + 2 + i * 2, h.y + 2, 1, h.h - 4, '#e08070');
      px(ctx, h.x + 1, h.y, h.w - 2, 1, '#e89a8a');
      px(ctx, h.x + 1, h.y + 2, 1, h.h - 4, 'rgba(0,0,0,0.15)');
      px(ctx, h.x, h.y + h.h, h.w, 1, 'rgba(0,0,0,0.2)');
      // 工作区加湿器（静态机身）
      const u = FURN.workspace.humidSpot;
      px(ctx, u.x, u.y + 6, u.w, u.h - 6, '#8ac8d8');
      px(ctx, u.x, u.y + 8, u.w, 1, '#a0d8e8');
      px(ctx, u.x, u.y + 6, 1, u.h - 6, 'rgba(0,0,0,0.12)');
      px(ctx, u.x, u.y + u.h - 2, u.w, 2, 'rgba(0,0,0,0.2)');
      // 厨房保温壶
      px(ctx, 256, 106, 3, 4, '#b0503a');
      px(ctx, 257, 104, 1, 2, '#c0604a');
      px(ctx, 256, 106, 1, 1, '#d0705a');
    } else {
      // 春秋：卧室窗台外花
      if (s === 'spring') {
        px(ctx, 74, 92, 2, 2, '#ff7ba2');
        px(ctx, 75, 90, 1, 1, '#ffb0c4');
      }
    }
  }

  // 季节小物件（动态部分：风扇叶片 / 加湿器蒸汽）
  function drawSeasonItemsDynamic(ctx, st, t) {
    const s = st.season.id;
    if (s === 'summer') {
      const f = FURN.workspace.fanSpot;
      ctx.fillStyle = '#8a8a96';
      px(ctx, f.x - 1, f.y, 5, 2);
      px(ctx, f.x + 1, f.y - 1 + Math.round(Math.sin(t * 12) * 0.5), 1, 1, '#c0c0cc');
      // 厨房小风扇
      px(ctx, 302, 96, 2, 2, '#8a8a96');
    } else if (s === 'winter') {
      const u = FURN.workspace.humidSpot;
      ctx.fillStyle = 'rgba(200,240,255,0.85)';
      px(ctx, u.x + 2, u.y + 4 - (Math.floor(t * 3) % 3), 1, 1);
      px(ctx, u.x + 4, u.y + 2 - (Math.floor(t * 3 + 1) % 3), 1, 1);
      px(ctx, u.x + 6, u.y + 4 - (Math.floor(t * 3 + 2) % 3), 1, 1);
    }
  }

  // ============================================================
  // 动态：屏幕内容 / 蒸汽 / 水珠 / 吊灯
  // ============================================================
  function drawMonitorDynamic(ctx, st, t) {
    const R = FURN.workspace;
    const m = R.monitor;
    const on = st.activity && st.activity.id === 'work';
    const screen = { x: m.x + 1, y: m.y + 2, w: m.w - 2, h: m.h - 6 };
    if (on) {
      drawMonitorContent(ctx, P.Character.screenMode(), t, screen.x, screen.y, screen.w, screen.h);
    } else {
      // 待机时钟
      const tp = P.Time.now();
      px(ctx, screen.x, screen.y, screen.w, screen.h, '#0d1017');
      px(ctx, screen.x + 3, screen.y + 5, 1, 8, '#5a6a8a');
      px(ctx, screen.x + 5, screen.y + 5, 1, 8, '#5a6a8a');
      px(ctx, screen.x + 9, screen.y + 5, 1, 8, '#5a6a8a');
      px(ctx, screen.x + 11, screen.y + 5, 1, 8, '#5a6a8a');
      px(ctx, screen.x + 7, screen.y + 7, 1, 1, '#8a9ab8');
      px(ctx, screen.x + 7, screen.y + 10, 1, 1, '#8a9ab8');
      px(ctx, screen.x + 6, screen.y + 14, 5, 1, '#3a4a6a');
      void tp;
    }
    // 指示灯
    px(ctx, m.x + m.w - 3, m.y + m.h - 2, 1, 1, on ? '#4ae07a' : '#55555f');
  }

  function drawSteamDrops(ctx, st, t) {
    // 淋浴水珠
    if (st.activity && st.activity.id === 'wash' && st.washPhase === 'shower') {
      const R = FURN.bathroom.shower;
      ctx.fillStyle = 'rgba(120,200,255,0.8)';
      for (let i = 0; i < 10; i++) {
        const dx = R.x + 3 + (((i * 13 + Math.floor(t * 5) * 3) % 16));
        const dy = R.y + 6 + (((i * 7 + Math.floor(t * 22)) % (R.h - 8)));
        ctx.fillRect(dx, dy, 1, 2);
      }
    }
  }

  function drawCeilingLamps(ctx, st) {
    for (let i = 0; i < 4; i++) {
      const lx = FURN[C.ROOM_IDS[i]].ceilingLamp.x;
      const on = lampOn('ceiling', i);
      // 灯杆
      px(ctx, lx - 1, CEIL, 2, 6, '#6a6268');
      px(ctx, lx - 1, CEIL, 1, 6, '#8a8288');
      // 灯罩（上亮下暗）
      px(ctx, lx - 5, CEIL + 6, 10, 5, on ? '#ffe9b0' : '#cfc8c0');
      px(ctx, lx - 5, CEIL + 6, 10, 1, on ? '#fff6d8' : '#e0dac8');
      px(ctx, lx - 5, CEIL + 10, 10, 1, on ? '#e8c888' : '#b8b2a8');
      // 灯泡
      px(ctx, lx - 3, CEIL + 11, 6, 3, on ? '#fff6d8' : '#b0aaa2');
      px(ctx, lx - 2, CEIL + 11, 2, 1, '#ffffff');
    }
  }

  // ============================================================
  // 屏幕内容（与放大弹窗共用）
  // ============================================================
  function drawMonitorContent(ctx, mode, t, x, y, w, h) {
    // 关键：屏幕内容的所有坐标取整，避免半像素坐标触发抗锯齿产生条纹
    x = Math.floor(x);
    y = Math.floor(y);
    w = Math.floor(w);
    h = Math.floor(h);

    // 屏幕背景
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(x, y, w, h);

    // 边框（不透明，覆盖屏幕边缘；小屏 1px / 放大屏 2px）
    const fw = w >= 100 ? 2 : 1;
    ctx.fillStyle = '#3d3d3d';
    ctx.fillRect(x - fw, y - fw, w + fw * 2, fw);   // 上
    ctx.fillRect(x - fw, y + h, w + fw * 2, fw);    // 下
    ctx.fillRect(x - fw, y, fw, h);                 // 左
    ctx.fillRect(x + w, y, fw, h);                  // 右

    // 状态栏
    px(ctx, x, y, w, 2, '#232936');
    px(ctx, x + 2, y + 1, 1, 1, '#5aa0ff');
    px(ctx, x + 4, y + 1, 1, 1, '#5affa0');
    px(ctx, x + 6, y + 1, 1, 1, '#ffd05a');
    px(ctx, x + w - 3, y + 1, 2, 1, '#8a94a8');

    switch (mode) {
      case 'coding': {
        px(ctx, x, y + 4, 4, h - 4, '#161a26');
        px(ctx, x + 4, y + 4, w - 4, h - 4, '#1b2030');
        const lines = 16;
        const scroll = Math.floor(t * 2.4);
        for (let i = 0; i < lines; i++) {
          const ly = Math.floor(y + 8 + i * 4 - (scroll % 8) * 2);
          if (ly < y + 5 || ly > y + h - 4) continue;
          const n = (i + scroll) % 8;
          const len = [4, 9, 6, 12, 5, 8, 10, 3][n];
          const col = ['#7ac9ff', '#7affa0', '#ffd05a', '#ff8a9a', '#c9a0ff', '#7affa0'][n % 6];
          px(ctx, x + 6, ly, len, 1, col);
          if (n % 3 === 0) px(ctx, x + 6, ly + 1, 2, 1, '#4a5468');
        }
        if (Math.floor(t * 2) % 2 === 0) {
          // 光标：按屏幕高度限制位置，避免在小屏上落到屏幕外
          const cN = Math.max(1, Math.min(12, Math.floor((h - 12) / 4)));
          const cy = y + 8 + (Math.floor(t * 3) % cN) * 4;
          if (cy + 4 <= y + h) px(ctx, x + 10, cy, 1, 4, '#ffffff');
        }
        break;
      }
      case 'video': {
        px(ctx, x, y + 4, w, h - 4, '#141824');
        const bx = x + 4, by = y + 8;
        ctx.fillStyle = '#ffd05a';
        ctx.beginPath();
        ctx.moveTo(bx, by); ctx.lineTo(bx + 3, by + 2); ctx.lineTo(bx, by + 4);
        ctx.closePath(); ctx.fill();
        px(ctx, x + 4, y + h - 6, w - 8, 1, '#3a4156');
        const prog = (t * 0.8) % 1;
        px(ctx, x + 4, y + h - 6, Math.max(1, Math.round((w - 8) * prog)), 1, '#ff5a7a');
        if (Math.floor(t) % 3 !== 2) {
          px(ctx, x + ((w * 0.3) | 0), y + h - 14, (w * 0.4) | 0, 1, '#cfd6e8');
          px(ctx, x + ((w * 0.35) | 0), y + h - 12, (w * 0.3) | 0, 1, '#cfd6e8');
        }
        break;
      }
      case 'chat': {
        px(ctx, x, y + 4, w, h - 4, '#10141f');
        // ---- 顶部标题栏：聊天对象名 MOMO ----
        let headerH = 0;
        if (w >= 42 && h >= 16) {
          // 完整标题栏（放大屏）：底色 + 顶边 + 点阵名字 + 分隔线
          headerH = 7;
          px(ctx, x, y + 4, w, headerH, '#1a2132');
          px(ctx, x, y + 4, w, 1, '#2e3a56');
          const name = 'MOMO', cw = 4, ch = 5, gap = 1;
          let sx = x + 3;
          for (let ci = 0; ci < name.length; ci++) {
            const glyph = PIXEL_FONT[name[ci]];
            if (!glyph) continue;
            for (let gy = 0; gy < ch; gy++) {
              const bits = glyph[gy];
              for (let gx = 0; gx < cw; gx++) {
                if (bits & (1 << (3 - gx))) px(ctx, sx + gx, y + 5 + gy, 1, 1, '#8ab4ff');
              }
            }
            sx += cw + gap;
          }
          px(ctx, x, y + 4 + headerH - 1, w, 1, '#2e3a56');
        } else if (w >= 6) {
          // 极小屏（室内显示器）：只画在线绿点，不影响气泡布局
          px(ctx, x + 2, y + 5, 2, 2, '#4ae07a');
        }
        // 气泡数量随屏幕高度自适应（小屏不溢出），标题栏占位后下移
        const bn = Math.min(5, Math.max(1, Math.floor((h - 10 - headerH) / 4)));
        const bubbleTop = y + 8 + headerH;
        for (let i = 0; i < bn; i++) {
          const at = ((t * 0.6 + i * 0.7) % 5);
          const mw = [10, 14, 8, 12, 9][i];
          const bw = Math.min(mw, Math.max(4, w - 8)); // 小屏限宽
          if (at > 0.15) {
            const my = Math.floor(bubbleTop + i * 4);
            if (i % 2 === 0) {
              px(ctx, x + 3, my, bw, 3, '#2a3a5e');
              px(ctx, x + 3, my + 3, 2, 1, '#2a3a5e');
            } else {
              px(ctx, x + w - 3 - bw, my, bw, 3, '#3e5a34');
              px(ctx, x + w - 5 - bw, my + 3, 2, 1, '#3e5a34');
            }
          }
        }
        // 输入框：仅当高度足够时绘制（小屏省略）
        if (h >= 20) {
          px(ctx, x + 2, y + h - 5, w - 4, 3, '#1d2330');
          if (Math.floor(t * 2) % 2 === 0) px(ctx, x + 3, y + h - 4, 2, 1, '#cfd6e8');
        }
        break;
      }
      case 'slacking': {
        px(ctx, x, y + 4, w, h - 4, '#0f1220');
        // 狐狸位置限制在屏幕内（小屏不落到屏幕外/上方）
        const fx = Math.max(x + 3, Math.min(Math.floor(x + (((t * 6) % (w + 8)) | 0) - 4), x + w - 5));
        const fy = Math.max(y + 6, Math.min(Math.floor(y + Math.round(h / 2) - 5), y + h - 4));
        ctx.fillStyle = '#ffb03a';
        px(ctx, fx, fy, 3, 2);
        px(ctx, fx - 1, fy + 1, 5, 2);
        px(ctx, fx - 1, fy + 1, 1, 1, '#ffd98a');
        px(ctx, fx + 1, fy, 1, 1, '#2a2a3a');
        ctx.fillStyle = '#e08020';
        px(ctx, fx - 2, fy + 1, 1, 2);
        px(ctx, fx - 3, fy + 2, 1, 1);
        if (Math.floor(t * 2) % 2) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; px(ctx, fx + 3, fy - 2, 1, 1); }
        px(ctx, x + 2, y + 5, 9, 7, '#f5e9c9');
        px(ctx, x + 3, y + 7, 7, 1, '#8a8a9a');
        px(ctx, x + 3, y + 9, 5, 1, '#8a8a9a');
        px(ctx, x + 3, y + h - 4, 6, 1, '#6a7a9a');
        break;
      }
      case 'art': {
        px(ctx, x, y + 4, w, h - 4, '#1a1a24');
        const cols = ['#ff5a7a', '#5aa0ff', '#ffd05a', '#5affa0', '#c9a0ff', '#ff9a5a'];
        for (let i = 0; i < 8; i++) {
          const bx = Math.floor(x + 4 + ((i * 13 + Math.floor(t * 1.5)) % (w - 10)));
          const by = Math.floor(y + 8 + ((i * 7) % (h - 14)));
          px(ctx, bx, by, 4, 3, cols[i % 6]);
          px(ctx, bx + 2, by + 3, 3, 2, cols[(i + 1) % 6]);
        }
        for (let i = 0; i < 6; i++) px(ctx, x + 2 + i * 2, y + h - 4, 1, 2, cols[i]);
        break;
      }
      default: {
        px(ctx, x, y + 4, w, h - 4, '#10131c');
        px(ctx, x + 3, y + 6, 1, 8, '#5a6a8a');
        px(ctx, x + 5, y + 6, 1, 8, '#5a6a8a');
        px(ctx, x + 9, y + 6, 1, 8, '#5a6a8a');
        px(ctx, x + 11, y + 6, 1, 8, '#5a6a8a');
        break;
      }
    }
  }

  // 供内部使用的 lampOn（避免与模块导出对象冲突）
  function lampOnF(kind) { return lampOn(kind); }

  // ============================================================
  // 动态物品（状态存于 P.Storage.state.items，跨天保持）
  // ============================================================

  // 猫粮碗（厨房角落地面；余粮随猫进食减少，次日续满）
  function drawCatBowl(ctx, st) {
    const it = P.Storage.state.items || {};
    const B = FURN.kitchen.bowlSpot; // (305,124,5,3)
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(B.x - 1, B.y + 3, B.w + 2, 1);
    // 碗
    px(ctx, B.x, B.y, B.w, 2, '#e8e2d8');
    px(ctx, B.x, B.y, B.w, 1, '#fdfaf2');
    px(ctx, B.x + 1, B.y + 2, B.w - 2, 2, '#b8b0a0');
    px(ctx, B.x, B.y + 3, B.w, 1, '#8a8272');
    // 猫粮（3=满 2=半 1=少 0=空）
    const food = it.bowl || 0;
    if (food >= 1) {
      px(ctx, B.x + 1, B.y - 1, 3, 1, '#c89050');
      if (food >= 2) {
        px(ctx, B.x + 1, B.y - 2, 3, 1, '#d8a060');
        if (food >= 3) {
          px(ctx, B.x, B.y - 2, 5, 1, '#e0b070');
          px(ctx, B.x + 2, B.y - 3, 1, 1, '#a06828');
        }
      }
    }
  }

  // 狗窝（厨房角落地面；腊肠狗蜷在上面睡觉）
  function drawDogBed(ctx, st) {
    const B = FURN.kitchen.dogBed; // (286,124,12,4)
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(B.x - 1, B.y + 4, B.w + 2, 1);
    // 外沿（红棕）
    px(ctx, B.x, B.y, B.w, B.h, '#b0605a');
    px(ctx, B.x, B.y, B.w, 1, '#d0806a');
    px(ctx, B.x, B.y, 1, B.h, '#c86a5a');
    px(ctx, B.x + B.w - 1, B.y, 1, B.h, '#8a4a3a');
    // 内垫（浅色）
    px(ctx, B.x + 1, B.y + 1, B.w - 2, B.h - 1, '#d8907a');
    px(ctx, B.x + 2, B.y + 2, B.w - 4, 1, '#e8a890');
    // 缝线点
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(B.x + 3, B.y + 3, 1, 1);
    ctx.fillRect(B.x + 7, B.y + 3, 1, 1);
  }

  // 狗粮碗（厨房角落地面；余粮随狗进食减少，次日续满）
  function drawDogBowl(ctx, st) {
    const it = P.Storage.state.items || {};
    const B = FURN.kitchen.dogBowl; // (300,124,5,3)
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(B.x - 1, B.y + 3, B.w + 2, 1);
    // 碗（红色，与猫碗区分）
    px(ctx, B.x, B.y, B.w, 2, '#c85a4a');
    px(ctx, B.x, B.y, B.w, 1, '#e07060');
    px(ctx, B.x + 1, B.y + 2, B.w - 2, 2, '#a04838');
    px(ctx, B.x, B.y + 3, B.w, 1, '#8a3a2a');
    // 狗粮（3=满 2=半 1=少 0=空）
    const food = it.dogBowl || 0;
    if (food >= 1) {
      px(ctx, B.x + 1, B.y - 1, 3, 1, '#8a5a2a');
      if (food >= 2) {
        px(ctx, B.x + 1, B.y - 2, 3, 1, '#a07038');
        if (food >= 3) {
          px(ctx, B.x, B.y - 2, 5, 1, '#b88248');
          px(ctx, B.x + 2, B.y - 3, 1, 1, '#6a4020');
        }
      }
    }
  }

  // 快递箱（门口/墙边；几天后被拆开消失）
  function drawPackage(ctx, st) {
    const pkg = (P.Storage.state.items || {}).pkg || {};
    if (pkg.state !== 'arrived') return;
    const B = FURN.kitchen.pkgSpot; // (310,118,7,7)
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.fillRect(B.x - 1, B.y + 8, B.w + 2, 2);
    // 纸箱
    px(ctx, B.x, B.y, B.w, B.h, '#c89a5a');
    px(ctx, B.x, B.y, B.w, 1, '#e0b878');
    px(ctx, B.x, B.y, 1, B.h, '#a87848');
    px(ctx, B.x, B.y + 2, B.w, 1, '#a87848');
    // 胶带
    px(ctx, B.x + 1, B.y, 1, B.h, '#e8d8a8');
    px(ctx, B.x, B.y + 3, B.w, 1, '#e8d8a8');
    // 面单
    px(ctx, B.x + 3, B.y + 4, 2, 2, '#f8f0e0');
    px(ctx, B.x + 3, B.y + 4, 2, 1, '#d8d0c0');
  }

  // 快递拆出的小物件（从预设列表随机，出现在房间各处）
  const PKG_ITEMS = {
    figurine: function (ctx) { // 书架摆件：金色小雕像
      px(ctx, 95, 54, 2, 3, '#e0b060');
      px(ctx, 96, 53, 1, 1, '#f0d080');
      px(ctx, 94, 57, 5, 1, 'rgba(0,0,0,0.2)');
    },
    mug: function (ctx) { // 厨房杯子：台面彩色杯
      px(ctx, 308, 102, 3, 3, '#5ac8e8');
      px(ctx, 308, 102, 3, 1, '#8adcf0');
      px(ctx, 311, 103, 1, 1, '#e8f8fc');
    },
    painting: function (ctx) { // 卧室挂画
      px(ctx, 42, 61, 5, 6, '#7a5c40');
      px(ctx, 43, 62, 3, 4, '#4a7bd0');
      px(ctx, 44, 63, 1, 1, '#ffffff');
      px(ctx, 43, 62, 3, 1, '#7aa8e8');
    },
    plant: function (ctx) { // 工作区桌面小盆栽
      px(ctx, 126, 103, 3, 4, '#8a4423');
      px(ctx, 127, 100, 2, 3, '#4a9a4a');
      px(ctx, 126, 101, 1, 2, '#5aac5a');
    },
    vase: function (ctx) { // 卫生间柜上花瓶
      px(ctx, 230, 52, 2, 4, '#c86ab0');
      px(ctx, 230, 52, 2, 1, '#e88ac8');
      px(ctx, 231, 50, 1, 2, '#4a9a4a');
    }
  };

  function drawOpenedItem(ctx, st) {
    const pkg = (P.Storage.state.items || {}).pkg || {};
    if (pkg.state !== 'opened' || !pkg.item) return;
    const fn = PKG_ITEMS[pkg.item];
    if (fn) fn(ctx);
  }

  function drawItemObjects(ctx, st) {
    drawCatBowl(ctx, st);
    drawDogBed(ctx, st);
    drawDogBowl(ctx, st);
    drawPackage(ctx, st);
    drawOpenedItem(ctx, st);
  }

  // 餐桌食物（小人吃饭时出现，吃完消失；食物随机 + 热气）
  function drawMealFood(ctx, st, t) {
    const mf = P.Character.mealFood ? P.Character.mealFood() : null;
    if (!mf) return;
    const m = FURN.kitchen.meal;
    const bx = m.x + 2, by = m.y;
    const type = mf.type;
    if (type === 'baozi') {
      // 包子
      px(ctx, bx + 1, by - 3, 3, 3, '#fdf8f0');
      px(ctx, bx + 4, by - 3, 3, 3, '#fdf8f0');
      px(ctx, bx + 2, by - 2, 1, 1, 'rgba(200,180,160,0.9)');
      px(ctx, bx + 5, by - 2, 1, 1, 'rgba(200,180,160,0.9)');
    } else if (type === 'bread') {
      // 面包
      px(ctx, bx, by - 2, 7, 2, '#d8a050');
      px(ctx, bx, by - 2, 7, 1, '#a06828');
      px(ctx, bx + 1, by - 3, 1, 1, '#f0c878');
    } else if (type === 'noodles') {
      // 面条（碗 + 面条 + 筷子）
      px(ctx, bx - 1, by - 1, 6, 3, '#e8e8ec');
      px(ctx, bx, by - 2, 4, 1, '#f0d8a0');
      px(ctx, bx + 1, by - 3, 1, 1, '#d0a860');
      px(ctx, bx + 3, by - 3, 1, 1, '#d0a860');
      px(ctx, bx + 5, by - 4, 1, 4, '#8a6a4a');
    } else if (type === 'egg') {
      // 鸡蛋
      px(ctx, bx, by - 3, 5, 3, '#fdf8f0');
      px(ctx, bx + 1, by - 2, 3, 2, '#ffd05a');
      px(ctx, bx + 1, by - 3, 1, 1, '#fff8f0');
    } else if (type === 'rice') {
      // 米饭炒菜
      px(ctx, bx, by - 2, 6, 2, '#f8f4e8');
      px(ctx, bx + 1, by - 3, 2, 1, '#5a9a4a');
      px(ctx, bx + 4, by - 3, 2, 1, '#c85a4a');
      px(ctx, bx + 2, by - 4, 1, 1, '#e8a04a');
    } else if (type === 'takeout') {
      // 外卖盒
      px(ctx, bx, by - 3, 7, 4, '#c89a5a');
      px(ctx, bx, by - 3, 7, 1, '#b08040');
      px(ctx, bx + 2, by - 5, 3, 1, '#e8d8a8');
      px(ctx, bx + 1, by - 1, 1, 1, '#e06060');
    } else if (type === 'instant') {
      // 泡面
      px(ctx, bx + 1, by - 4, 4, 5, '#e06060');
      px(ctx, bx + 1, by - 2, 4, 1, '#f8f0e0');
      px(ctx, bx + 2, by - 5, 2, 1, '#f0d8a0');
      px(ctx, bx + 5, by - 6, 1, 2, '#ffffff');
    } else if (type === 'hotpot') {
      // 火锅
      px(ctx, bx - 1, by - 2, 8, 3, '#c04838');
      px(ctx, bx, by - 3, 6, 1, '#e88850');
      px(ctx, bx + 1, by - 4, 1, 1, '#5a9a4a');
      px(ctx, bx + 4, by - 4, 1, 1, '#f0f0f0');
    }
    // 热气（2-3 帧白色像素上升）
    const s1 = Math.floor(t * 2.5) % 3;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(bx + 2, by - 6 - s1, 1, 1);
    ctx.fillRect(bx + 4, by - 7 - ((s1 + 1) % 3), 1, 1);
    ctx.fillRect(bx + 6, by - 6 - ((s1 + 2) % 3), 1, 1);
  }

  // 冰箱门开合（小人取食材时）：内部层板+食物色块 + 门平移开合 + 冷气白雾
  function drawFridgeDoorDynamic(ctx, st, t) {
    const open = P.Character.fridgeOpen ? P.Character.fridgeOpen() : null;
    if (!open || !open.open) return;
    const R = FURN.kitchen.fridge; // (268,86,13,42)
    const p = Math.max(0, Math.min(1, open.p));
    // 内侧（打开后可见：层板 + 食物色块）
    px(ctx, R.x + 1, R.y + 2, R.w - 3, R.h - 4, '#2a3038');
    px(ctx, R.x + 2, R.y + 12, R.w - 5, 1, '#4a5260');
    px(ctx, R.x + 2, R.y + 24, R.w - 5, 1, '#4a5260');
    px(ctx, R.x + 2, R.y + 4, 2, 5, '#e8f0f8');    // 牛奶
    px(ctx, R.x + 5, R.y + 4, 2, 3, '#7ac85a');    // 蔬菜
    px(ctx, R.x + 8, R.y + 4, 2, 4, '#e0a060');    // 果汁
    px(ctx, R.x + 2, R.y + 14, 3, 3, '#f0d8a0');   // 鸡蛋
    px(ctx, R.x + 7, R.y + 14, 2, 2, '#c85a4a');   // 番茄
    px(ctx, R.x + 2, R.y + 26, 3, 4, '#d8a04a');   // 面包
    px(ctx, R.x + 6, R.y + 26, 2, 2, '#5a8fc8');   // 冰格
    // 门（向左平移开合：宽度随 p 收缩，露出内部）
    const doorW = Math.round((R.w - 2) * (1 - p));
    if (doorW > 0) {
      const doorX = R.x + 1;
      px(ctx, doorX, R.y + 1, doorW, R.h - 2, '#d8dce4');
      px(ctx, doorX, R.y + 1, doorW, 2, '#eef1f6');
      px(ctx, doorX + doorW - 1, R.y + 3, 1, R.h - 4, '#e8ecf2');
      px(ctx, doorX, R.y + 1 + (R.h >> 1) - 1, doorW, 1, '#b8bcc8');
      px(ctx, doorX + doorW - 4, R.y + 8, 1, 4, '#9aa0ae');
      px(ctx, doorX + doorW - 4, R.y + (R.h >> 1) + 8, 1, 4, '#9aa0ae');
    }
    // 冷气白雾（从开口向上飘散）
    const f1 = Math.floor(t * 2.5) % 3;
    ctx.fillStyle = 'rgba(230,245,255,0.8)';
    ctx.fillRect(R.x + 3, R.y - 2 - f1, 1, 1);
    ctx.fillRect(R.x + 7, R.y - 3 - ((f1 + 1) % 3), 1, 1);
    ctx.fillRect(R.x + 10, R.y - 2 - ((f1 + 2) % 3), 1, 1);
    ctx.fillStyle = 'rgba(230,245,255,0.5)';
    ctx.fillRect(R.x + 5, R.y - 4 - f1, 1, 1);
  }

  // 猫在工作区桌面：踩键盘 + 推咖啡杯（泼溅）
  function drawDeskCatEffects(ctx, st, t) {
    const perch = P.Cat.perchId ? P.Cat.perchId() : null;
    if (perch !== 'desk') return;
    const k = FURN.workspace.keyboard;
    // 键盘上的猫爪（踩键盘）
    if (Math.floor(t * 4) % 2 === 0) {
      ctx.fillStyle = '#e89a4a';
      ctx.fillRect(k.x + 2, k.y - 1, 2, 1);
    }
    // 咖啡杯被推歪的泼溅
    const it = P.Storage.state.items || {};
    if ((it.cup || 0) > 1) {
      ctx.fillStyle = 'rgba(74,42,26,0.8)';
      ctx.fillRect(135, 104, 1, 1);
    }
  }

  P.RoomLayout = {
    windows: windows,
    lights: lights,
    lampOn: lampOn,
    hits: hits,
    monitorRect: monitorRect,
    drawHouse: drawHouse,
    drawDynamic: drawDynamic,
    drawMonitorContent: drawMonitorContent,
    drawWindowBackdrop: P.Lighting ? P.Lighting.drawWindowBackdrop : null
  };
})();