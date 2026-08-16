/* ============================================================
 * roomLayout.js —— 房间布局数据与绘制（卧室/工作区/卫生间/厨房）
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
      bed: { x: 8, y: 112, w: 36, h: 16 },
      pillow: { x: 10, y: 104, w: 7, h: 8 },
      blanket: { x: 17, y: 112, w: 27, h: 6 },
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
      desk: { x: 104, y: 108, w: 40, h: 20 },
      monitor: { x: 106, y: 84, w: 18, h: 24 },
      keyboard: { x: 116, y: 106, w: 16, h: 2 },
      mug: { x: 132, y: 104, w: 3, h: 4 },
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
      mirror: { x: 188, y: 76, w: 13, h: 16 },
      sink: { x: 186, y: 102, w: 16, h: 26 },
      toilet: { x: 210, y: 98, w: 12, h: 30 },
      towel: { x: 204, y: 62, w: 2, h: 12 },
      cabinet: { x: 226, y: 56, w: 12, h: 22 },
      ceilingLamp: { x: 200 }
    },
    kitchen: {
      window: { x: 296, y: 52, w: 14, h: 32 },
      cabinets: { x: 282, y: 56, w: 12, h: 22 },
      table: { x: 244, y: 110, w: 22, h: 18 },
      stoolA: { x: 244, y: 116, w: 8, h: 12 },
      stoolB: { x: 258, y: 116, w: 8, h: 12 },
      fridge: { x: 268, y: 86, w: 13, h: 42 },
      counter: { x: 282, y: 104, w: 38, h: 24 },
      stove: { x: 284, y: 98, w: 12, h: 8 },
      sink: { x: 298, y: 100, w: 10, h: 6 },
      plant: { x: 312, y: 92, w: 7, h: 16 },
      meal: { x: 250, y: 104, w: 7, h: 6 },
      ceilingLamp: { x: 280 }
    }
  };

  // ---- 工具 ----
  function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (f < 0) { const k = 1 + f; r *= k; g *= k; b *= k; }
    else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
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
      out.push({ kind: 'ceiling', room: i, x: lx, y: 50, r: 50, a: 0.5, on: lampOn('ceiling', i), seed: i * 3 + 1 });
    }
    out.push({ kind: 'deskLamp', x: 139, y: 97, r: 26, a: 0.6, on: lampOn('deskLamp'), seed: 11 });
    out.push({ kind: 'nightLamp', x: 50.5, y: 102, r: 26, a: 0.5, on: lampOn('nightLamp'), seed: 17 });
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
  // 绘制主体
  // ============================================================
  function drawHouse(ctx, st) {
    drawStructure(ctx, st);
    for (let i = 0; i < 4; i++) drawFurniture(ctx, st, i);
    drawSeasonItems(ctx, st);
    for (let i = 0; i < 4; i++) drawCeilingLamp(ctx, i);
  }

  function drawStructure(ctx, st) {
    // 屋顶（楼板）
    px(ctx, 0, SKY_H, W, CEIL - SKY_H, '#3a3238');
    px(ctx, 0, CEIL - 2, W, 2, '#2c262c');
    px(ctx, 0, SKY_H, W, 1, '#241f24');

    // 后墙
    for (let i = 0; i < 4; i++) {
      const x0 = i * RW;
      const wall = C.COLORS.wall[i];
      const wallD = C.COLORS.wallDark[i];
      px(ctx, x0, CEIL, RW, FLOOR - CEIL, wall);
      px(ctx, x0, FLOOR - 18, RW, 18, wallD);
      px(ctx, x0, FLOOR - 18, RW, 1, shade(wall, -0.16));
      px(ctx, x0, CEIL, RW, 2, shade(wall, 0.22));
      px(ctx, x0, CEIL + 2, RW, 1, shade(wall, -0.14));
      // 墙纸花纹（细竖线）
      ctx.fillStyle = 'rgba(0,0,0,0.045)';
      for (let gx = x0 + 6; gx < x0 + RW; gx += 8) ctx.fillRect(gx, CEIL + 6, 1, FLOOR - 18 - CEIL - 6);
    }

    // 窗户
    for (let i = 0; i < 4; i++) drawWindow(ctx, st, i);

    // 地板
    for (let i = 0; i < 4; i++) {
      const x0 = i * RW;
      if (i === 2 || i === 3) {
        px(ctx, x0, FLOOR, RW, H - FLOOR, C.COLORS.floorTile);
        for (let gx = x0 + 8; gx < x0 + RW; gx += 8) px(ctx, gx, FLOOR, 1, H - FLOOR, C.COLORS.floorTileDark);
        for (let gy = FLOOR + 8; gy < H; gy += 8) px(ctx, x0, gy, RW, 1, C.COLORS.floorTileDark);
      } else {
        px(ctx, x0, FLOOR, RW, H - FLOOR, C.COLORS.floorWood);
        for (let gx = x0 + 8; gx < x0 + RW; gx += 8) px(ctx, gx, FLOOR, 1, H - FLOOR, C.COLORS.floorWoodDark);
        px(ctx, x0, FLOOR, RW, 2, shade(C.COLORS.floorWood, -0.25));
      }
      px(ctx, x0, FLOOR, RW, 2, C.COLORS.baseboard);
    }

    // 分隔墙 + 门洞
    for (let i = 0; i < 3; i++) {
      const bx = (i + 1) * RW;
      px(ctx, bx - 2, CEIL, 4, C.DOOR_Y - CEIL, '#4a4148');
      px(ctx, bx - 2, C.DOOR_Y, 4, FLOOR - C.DOOR_Y, '#5c525a');
      px(ctx, bx - 3, C.DOOR_Y - 2, 2, FLOOR - C.DOOR_Y + 2, '#3f383f');
      px(ctx, bx + 1, C.DOOR_Y - 2, 2, FLOOR - C.DOOR_Y + 2, '#3f383f');
      px(ctx, bx - 3, FLOOR, 6, 2, '#3a343a');
    }

    // 外轮廓
    px(ctx, 0, CEIL, 2, H - CEIL, '#332d33');
    px(ctx, W - 2, CEIL, 2, H - CEIL, '#332d33');
    px(ctx, 0, H - 2, W, 2, '#241f24');
  }

  function drawWindow(ctx, st, roomIdx) {
    const win = FURN[C.ROOM_IDS[roomIdx]].window;
    const x = win.x, y = win.y, w = win.w, h = win.h;
    const season = st.season.id;

    // 窗帘（季节色）
    const curtainCol = season === 'spring' ? '#f0a8b8' : season === 'summer' ? '#9cc8e8' : season === 'autumn' ? '#d8a05a' : '#b0605a';
    px(ctx, x - 5, y - 2, 5, h + 4, shade(curtainCol, -0.2));
    px(ctx, x - 4, y - 2, 4, h + 4, curtainCol);
    px(ctx, x + w, y - 2, 5, h + 4, shade(curtainCol, -0.2));
    px(ctx, x + w + 1, y - 2, 4, h + 4, curtainCol);
    px(ctx, x - 6, y - 3, w + 12, 2, shade(curtainCol, -0.35));

    // 天空底
    P.Lighting.drawWindowBackdrop(ctx, st, x, y, w, h);

    // 窗框
    px(ctx, x - 2, y - 2, w + 4, 2, '#e8e2d2');
    px(ctx, x - 2, y + h, w + 4, 3, '#8a8074');
    px(ctx, x - 2, y - 2, 2, h + 2, '#e8e2d2');
    px(ctx, x + w, y - 2, 2, h + 2, '#e8e2d2');
    px(ctx, x + (w >> 1), y, 1, h, '#e8e2d2');
    px(ctx, x, y + (h >> 1), w, 1, '#e8e2d2');

    // 玻璃反光
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x + 2, y + 2, (w >> 1) - 2, 3);
    ctx.fillRect(x + 2, y + 8, (w >> 2) - 1, 2);

    // 窗台
    px(ctx, x - 3, y + h + 2, w + 6, 2, '#c9bfa8');

    // 窗台小花（春夏）
    if (season === 'spring' || season === 'summer') {
      px(ctx, x + 1, y + h + 1, 4, 3, '#a0522d');
      px(ctx, x + 2, y + h - 3, 2, 4, '#3d7a3a');
      const fc = season === 'spring' ? '#ff7ba2' : '#ffd23e';
      px(ctx, x + 1, y + h - 5, 1, 2, fc);
      px(ctx, x + 3, y + h - 5, 1, 2, fc);
      px(ctx, x + 2, y + h - 6, 1, 1, '#ffffff');
    }
    // 冬季窗霜
    if (season === 'winter') {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      for (let i = 0; i < 6; i++) ctx.fillRect(x + 1 + (i % 4) * 3, y + 1 + ((i * 7) % (h - 4)), 2, 2);
    }
  }

  // ============================================================
  // 家具
  // ============================================================
  function drawFurniture(ctx, st, roomIdx) {
    if (roomIdx === 0) drawBedroom(ctx, st);
    else if (roomIdx === 1) drawWorkspace(ctx, st);
    else if (roomIdx === 2) drawBathroom(ctx, st);
    else drawKitchen(ctx, st);
  }

  function drawBedroom(ctx, st) {
    const R = FURN.bedroom;
    // 地毯
    px(ctx, R.rug.x, R.rug.y, R.rug.w, R.rug.h, '#c96f4a');
    px(ctx, R.rug.x + 1, R.rug.y + 1, R.rug.w - 2, R.rug.h - 2, '#d9825e');
    px(ctx, R.rug.x + 3, R.rug.y + 2, R.rug.w - 6, 1, '#e89a78');

    // 挂画
    const arts = ['#c85a6a', '#4a7bd0'];
    for (let i = 0; i < 2; i++) {
      const f = R.frames[i];
      px(ctx, f.x, f.y, f.w, f.h, '#8a6a4a');
      px(ctx, f.x + 1, f.y + 1, f.w - 2, f.h - 2, '#f5ead2');
      const art = arts[i];
      if (st.season.id === 'winter') {
        px(ctx, f.x + 2, f.y + 3, 3, 3, '#bcd8ee');
      } else {
        px(ctx, f.x + 2, f.y + 2, 2, 2, art);
        px(ctx, f.x + 4, f.y + 4, 2, 2, shade(art, 0.3));
      }
    }

    // 床头钟
    const cl = R.clock;
    px(ctx, cl.x, cl.y, cl.w, cl.h, '#e8e2d2');
    px(ctx, cl.x + 1, cl.y + 1, cl.w - 2, cl.h - 2, '#ffffff');
    px(ctx, cl.x + 3, cl.y + 3, 1, 1, '#3a3a4a');
    px(ctx, cl.x + 3, cl.y + 3, 1, 2, '#c85a6a');

    // 床
    px(ctx, R.bed.x, R.bed.y + 10, R.bed.w, 6, '#7a4a2c');     // 床架底
    px(ctx, R.bed.x, R.bed.y + 8, R.bed.w, 2, '#8f5a36');     // 床架顶
    px(ctx, R.bed.x, R.bed.y, R.bed.w, 9, '#f4e8d4');         // 床垫
    px(ctx, R.bed.x, R.bed.y, R.bed.w, 1, '#fff8ec');
    // 枕头
    px(ctx, R.pillow.x, R.pillow.y, R.pillow.w, R.pillow.h, '#ffffff');
    px(ctx, R.pillow.x, R.pillow.y + R.pillow.h - 1, R.pillow.w, 1, '#e0d8cc');
    // 被子（人物睡眠时头部会盖在上面，身体藏在下面）
    px(ctx, R.blanket.x, R.blanket.y, R.blanket.w, R.blanket.h, '#5a8fc8');
    px(ctx, R.blanket.x, R.blanket.y, R.blanket.w, 2, '#6fa3d8');
    px(ctx, R.blanket.x, R.blanket.y + R.blanket.h - 1, R.blanket.w, 1, '#4a78a8');
    // 被子花纹
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 4; i++) ctx.fillRect(R.blanket.x + 4 + i * 6, R.blanket.y + 3, 3, 2);
    // 床腿
    px(ctx, R.bed.x + 1, R.bed.y + 16, 2, 4, '#5a3a22');
    px(ctx, R.bed.x + R.bed.w - 3, R.bed.y + 16, 2, 4, '#5a3a22');

    // 床头柜
    px(ctx, R.nightstand.x, R.nightstand.y, R.nightstand.w, R.nightstand.h, '#8a5a34');
    px(ctx, R.nightstand.x, R.nightstand.y, R.nightstand.w, 2, '#9c6a40');
    px(ctx, R.nightstand.x + 2, R.nightstand.y + 6, R.nightstand.w - 4, 1, '#6e4626');
    // 台灯
    const lampOn = P.RoomLayout.lampOn ? P.RoomLayout.lampOn('nightLamp') : false;
    px(ctx, R.nightLamp.x + 1, R.nightLamp.y + 11, 2, 3, '#4a4a5a');   // 杆
    px(ctx, R.nightLamp.x, R.nightLamp.y + 14, 4, 2, '#3a3a4a');       // 底座
    px(ctx, R.nightLamp.x, R.nightLamp.y, 4, 4, lampOn ? '#ffe9b0' : '#d8d2c8'); // 灯罩
    px(ctx, R.nightLamp.x + 1, R.nightLamp.y + 4, 2, 2, lampOn ? '#fff3c4' : '#c8c2b8'); // 灯泡
  }

  function drawWorkspace(ctx, st) {
    const R = FURN.workspace;
    // 地毯
    px(ctx, R.rug.x, R.rug.y, R.rug.w, R.rug.h, '#7a8aa0');
    px(ctx, R.rug.x + 1, R.rug.y + 1, R.rug.w - 2, R.rug.h - 2, '#8e9cb2');

    // 书架
    px(ctx, R.bookshelf.x, R.bookshelf.y, R.bookshelf.w, R.bookshelf.h, '#7a5230');
    px(ctx, R.bookshelf.x, R.bookshelf.y, R.bookshelf.w, 2, '#96683e');
    const books = ['#c85a6a', '#4a7bd0', '#e0a84a', '#5a8f5a', '#9a6ac8'];
    for (let row = 0; row < 3; row++) {
      const shelfY = R.bookshelf.y + 1 + row * 10;
      let bx = R.bookshelf.x + 1;
      const cols = row === 0 ? 4 : row === 1 ? 3 : 5;
      for (let i = 0; i < cols; i++) {
        const bh = 5 + ((row + i) % 3);
        const c = books[(row * 7 + i * 3) % books.length];
        px(ctx, bx, shelfY - bh, 2, bh, c);
        px(ctx, bx, shelfY - bh, 2, 1, shade(c, 0.35));
        bx += 3;
      }
      px(ctx, R.bookshelf.x, shelfY, R.bookshelf.w, 1, '#96683e');
    }

    // 桌面
    px(ctx, R.desk.x, R.desk.y, R.desk.w, 4, '#8a5a34');
    px(ctx, R.desk.x, R.desk.y + 4, R.desk.w, 2, '#9c6a40');
    px(ctx, R.desk.x + 1, R.desk.y + 6, 3, 14, '#6e4626');
    px(ctx, R.desk.x + R.desk.w - 4, R.desk.y + 6, 3, 14, '#6e4626');
    px(ctx, R.desk.x + 2, R.desk.y - 2, 10, 2, '#e8d8b0'); // 桌面便签

    // 显示器
    drawMonitor(ctx, st);
    // 键盘
    px(ctx, R.keyboard.x, R.keyboard.y, R.keyboard.w, R.keyboard.h, '#3a3a46');
    for (let i = 0; i < 6; i++) px(ctx, R.keyboard.x + 2 + i * 2, R.keyboard.y, 1, 1, '#55555f');
    // 马克杯
    px(ctx, R.mug.x, R.mug.y, R.mug.w, R.mug.h, '#e06060');
    px(ctx, R.mug.x, R.mug.y, R.mug.w, 1, '#f08080');

    // 台灯
    const dlOn = P.RoomLayout.lampOn ? P.RoomLayout.lampOn('deskLamp') : false;
    px(ctx, R.deskLamp.x + 3, R.deskLamp.y + 11, 1, 6, '#3a3a46');
    px(ctx, R.deskLamp.x + 2, R.deskLamp.y + 15, 3, 2, '#2e2e3a');
    px(ctx, R.deskLamp.x, R.deskLamp.y, 6, 3, dlOn ? '#ffe9b0' : '#cfc8c0');
    px(ctx, R.deskLamp.x + 1, R.deskLamp.y + 3, 4, 2, dlOn ? '#fff3c4' : '#b8b2a8');

    // 椅子
    px(ctx, R.chair.x, R.chair.y + 4, R.chair.w - 4, 3, '#8a5a34');
    px(ctx, R.chair.x + R.chair.w - 4, R.chair.y, 4, R.chair.h - 4, '#7a4a2c');
    px(ctx, R.chair.x + R.chair.w - 2, R.chair.y + 1, 1, R.chair.h - 5, '#96683e');
    px(ctx, R.chair.x + 1, R.chair.y + 7, 2, 5, '#6e4626');
    px(ctx, R.chair.x + 7, R.chair.y + 7, 2, 5, '#6e4626');
  }

  function drawMonitor(ctx, st) {
    const R = FURN.workspace;
    const m = R.monitor;
    const on = st.activity && st.activity.id === 'work';
    // 支架
    px(ctx, m.x + 6, m.y + 20, 2, 4, '#2e2e3a');
    px(ctx, m.x + 4, m.y + 24, 6, 2, '#2e2e3a');
    // 外壳
    px(ctx, m.x, m.y, m.w, m.h, '#2a2d3a');
    px(ctx, m.x, m.y, m.w, 2, '#3a3e4e');
    // 屏幕
    const screen = { x: m.x + 1, y: m.y + 2, w: m.w - 2, h: m.h - 6 };
    if (on) {
      drawMonitorContent(ctx, P.Character.screenMode(), performance.now() / 1000, screen.x, screen.y, screen.w, screen.h);
    } else {
      px(ctx, screen.x, screen.y, screen.w, screen.h, '#10131c');
      // 待机时钟
      const tp = P.Time.now();
      const timeStr = ('0' + tp.hourInt).slice(-2) + ':' + ('0' + tp.min).slice(-2);
      // 简易像素数字：用点阵太复杂，画简单横条
      px(ctx, screen.x + 3, screen.y + 5, 1, 8, '#5a6a8a');
      px(ctx, screen.x + 5, screen.y + 5, 1, 8, '#5a6a8a');
      px(ctx, screen.x + 9, screen.y + 5, 1, 8, '#5a6a8a');
      px(ctx, screen.x + 11, screen.y + 5, 1, 8, '#5a6a8a');
      px(ctx, screen.x + 7, screen.y + 7, 1, 1, '#8a9ab8');
      px(ctx, screen.x + 7, screen.y + 10, 1, 1, '#8a9ab8');
      px(ctx, screen.x + 6, screen.y + 14, 5, 1, '#3a4a6a');
    }
    // 指示灯
    px(ctx, m.x + m.w - 3, m.y + m.h - 2, 1, 1, on ? '#4ae07a' : '#55555f');
  }

  // 屏幕内容（与放大弹窗共用）
  function drawMonitorContent(ctx, mode, t, x, y, w, h) {
    px(ctx, x, y, w, h, '#0e1119');
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
          const ly = y + 8 + i * 4 - (scroll % 8) * 2;
          if (ly < y + 5 || ly > y + h - 4) continue;
          const n = (i + scroll) % 8;
          const len = [4, 9, 6, 12, 5, 8, 10, 3][n];
          const col = ['#7ac9ff', '#7affa0', '#ffd05a', '#ff8a9a', '#c9a0ff', '#7affa0'][n % 6];
          px(ctx, x + 6, ly, len, 1, col);
          if (n % 3 === 0) px(ctx, x + 6, ly + 1, 2, 1, '#4a5468');
        }
        if (Math.floor(t * 2) % 2 === 0) px(ctx, x + 10, y + 8 + ((Math.floor(t * 3) % 12)) * 4, 1, 4, '#ffffff');
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
        for (let i = 0; i < 5; i++) {
          const at = ((t * 0.6 + i * 0.7) % 5);
          const mw = [10, 14, 8, 12, 9][i];
          if (at > 0.15) {
            const my = y + 8 + i * 4;
            if (i % 2 === 0) {
              px(ctx, x + 3, my, mw, 3, '#2a3a5e');
              px(ctx, x + 3, my + 3, 2, 1, '#2a3a5e');
            } else {
              px(ctx, x + w - 3 - mw, my, mw, 3, '#3e5a34');
              px(ctx, x + w - 5 - mw, my + 3, 2, 1, '#3e5a34');
            }
          }
        }
        px(ctx, x + 2, y + h - 5, w - 4, 3, '#1d2330');
        if (Math.floor(t * 2) % 2 === 0) px(ctx, x + 3, y + h - 4, 2, 1, '#cfd6e8');
        break;
      }
      case 'slacking': {
        px(ctx, x, y + 4, w, h - 4, '#0f1220');
        const fx = x + (((t * 6) % (w + 8)) | 0) - 4;
        const fy = y + Math.round(h / 2) - 5;
        ctx.fillStyle = '#ffb03a';
        px(ctx, fx, fy, 3, 2);
        px(ctx, fx - 1, fy + 1, 5, 2);
        px(ctx, fx - 1, fy + 1, 1, 1, '#ffd98a');
        px(ctx, fx + 1, fy, 1, 1, '#2a2a3a');
        ctx.fillStyle = '#e08020';
        px(ctx, fx - 2, fy + 1, 1, 2);
        px(ctx, fx - 3, fy + 2, 1, 1);
        if (Math.floor(t * 2) % 2) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; px(ctx, fx + 3, fy - 2, 1, 1); }
        // 便签
        px(ctx, x + 2, y + 5, 9, 7, '#f5e9c9');
        px(ctx, x + 3, y + 7, 7, 1, '#8a8a9a');
        px(ctx, x + 3, y + 9, 5, 1, '#8a8a9a');
        // 摸鱼小提示
        px(ctx, x + 3, y + h - 4, 6, 1, '#6a7a9a');
        break;
      }
      case 'art': {
        px(ctx, x, y + 4, w, h - 4, '#1a1a24');
        const cols = ['#ff5a7a', '#5aa0ff', '#ffd05a', '#5affa0', '#c9a0ff', '#ff9a5a'];
        for (let i = 0; i < 8; i++) {
          const bx = x + 4 + ((i * 13 + Math.floor(t * 1.5)) % (w - 10));
          const by = y + 8 + ((i * 7) % (h - 14));
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

  function drawBathroom(ctx, st) {
    const R = FURN.bathroom;
    // 镜子
    px(ctx, R.mirror.x, R.mirror.y, R.mirror.w, R.mirror.h, '#a8d8e0');
    px(ctx, R.mirror.x + 1, R.mirror.y + 1, R.mirror.w - 2, R.mirror.h - 2, '#cdeef2');
    px(ctx, R.mirror.x + 2, R.mirror.y + 2, 3, 2, 'rgba(255,255,255,0.6)');
    px(ctx, R.mirror.x + 1, R.mirror.y + 1, 1, R.mirror.h - 2, '#8ab8c8');

    // 毛巾架
    px(ctx, R.towel.x, R.towel.y, R.towel.w, R.towel.h, '#e8e2d2');
    px(ctx, R.towel.x, R.towel.y + 3, 1, 6, '#7ac0d0');
    px(ctx, R.towel.x + 1, R.towel.y + 2, 1, 7, '#5aa0b0');

    // 墙柜
    px(ctx, R.cabinet.x, R.cabinet.y, R.cabinet.w, R.cabinet.h, '#b0a896');
    px(ctx, R.cabinet.x, R.cabinet.y + (R.cabinet.h >> 1), R.cabinet.w, 1, '#9a9080');
    px(ctx, R.cabinet.x + 2, R.cabinet.y + 2, 3, R.cabinet.h / 2 - 2, '#c2baa8');

    // 洗手台
    px(ctx, R.sink.x, R.sink.y + 16, R.sink.w, 10, '#b0a896');
    px(ctx, R.sink.x, R.sink.y + 16, R.sink.w, 2, '#c2baa8');
    px(ctx, R.sink.x, R.sink.y + 10, R.sink.w, 6, '#e8e8ec');
    px(ctx, R.sink.x + 2, R.sink.y + 10, R.sink.w - 4, 2, '#f4f4f8');
    px(ctx, R.sink.x + 6, R.sink.y + 6, 2, 4, '#c8c8d0');

    // 马桶
    px(ctx, R.toilet.x + 4, R.toilet.y, R.toilet.w - 4, 12, '#e8e8ec');
    px(ctx, R.toilet.x + 2, R.toilet.y + 12, R.toilet.w - 2, 5, '#f4f4f8');
    px(ctx, R.toilet.x + 2, R.toilet.y + 12, R.toilet.w - 2, 2, '#ffffff');
    px(ctx, R.toilet.x + 2, R.toilet.y + 17, R.toilet.w - 2, 13, '#d8d8e0');
    px(ctx, R.toilet.x + 4, R.toilet.y + 2, 1, 1, '#c0c0cc');

    // 浴室
    // 玻璃隔断
    ctx.fillStyle = 'rgba(160,220,230,0.35)';
    ctx.fillRect(R.shower.x + 18, R.shower.y + 2, 2, R.shower.h - 2);
    ctx.fillRect(R.shower.x, R.shower.y, R.shower.w, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(R.shower.x + 16, R.shower.y + 2, 1, R.shower.h - 2);
    // 排水格
    px(ctx, R.shower.x + 8, R.shower.y + R.shower.h - 1, 4, 1, '#8a9a98');
    // 花洒
    px(ctx, R.showerHead.x + 1, R.showerHead.y + 6, 1, 38, '#b8b8c0');
    px(ctx, R.showerHead.x, R.showerHead.y + 42, 4, 2, '#c8c8d0');
    // 水珠（淋浴时）
    if (st.activity && st.activity.id === 'wash' && st.washPhase === 'shower') {
      const t = performance.now() / 1000;
      ctx.fillStyle = 'rgba(120,200,255,0.8)';
      for (let i = 0; i < 10; i++) {
        const dx = R.shower.x + 3 + (((i * 13 + Math.floor(t * 5) * 3) % 16));
        const dy = R.shower.y + 6 + (((i * 7 + Math.floor(t * 22)) % (R.shower.h - 8)));
        ctx.fillRect(dx, dy, 1, 2);
      }
    }
  }

  function drawKitchen(ctx, st) {
    const R = FURN.kitchen;
    // 吊柜
    px(ctx, R.cabinets.x, R.cabinets.y, R.cabinets.w, R.cabinets.h, '#b0a896');
    px(ctx, R.cabinets.x, R.cabinets.y + (R.cabinets.h >> 1), R.cabinets.w, 1, '#9a9080');
    px(ctx, R.cabinets.x + 3, R.cabinets.y + 2, 2, R.cabinets.h / 2 - 3, '#c2baa8');

    // 冰箱
    px(ctx, R.fridge.x, R.fridge.y, R.fridge.w, R.fridge.h, '#d8dce4');
    px(ctx, R.fridge.x, R.fridge.y, R.fridge.w, 2, '#eef1f6');
    px(ctx, R.fridge.x + 2, R.fridge.y + (R.fridge.h >> 1), R.fridge.w - 4, 1, '#b8bcc8');
    px(ctx, R.fridge.x + R.fridge.w - 3, R.fridge.y + 8, 1, 4, '#9aa0ae');
    px(ctx, R.fridge.x + R.fridge.w - 3, R.fridge.y + (R.fridge.h >> 1) + 8, 1, 4, '#9aa0ae');
    px(ctx, R.fridge.x + 3, R.fridge.y + 6, 2, 2, '#ff8a5a');
    px(ctx, R.fridge.x + 7, R.fridge.y + 5, 2, 2, '#5ac8ff');

    // 台面
    px(ctx, R.counter.x, R.counter.y, R.counter.w, 4, '#c8b896');
    px(ctx, R.counter.x, R.counter.y + 4, R.counter.w, 2, '#d8c8a8');
    px(ctx, R.counter.x, R.counter.y + 6, R.counter.w, 18, '#a0927e');
    for (let i = 0; i < 3; i++) {
      const cx2 = R.counter.x + 2 + i * 12;
      px(ctx, cx2, R.counter.y + 8, 8, 14, '#b0a28e');
      px(ctx, cx2 + 7, R.counter.y + 14, 1, 3, '#8a8070');
    }

    // 灶台 + 锅
    px(ctx, R.stove.x, R.stove.y + 2, R.stove.w, 4, '#3a3a44');
    px(ctx, R.stove.x + 2, R.stove.y + 2, 3, 1, '#55555f');
    px(ctx, R.stove.x + 7, R.stove.y + 2, 3, 1, '#55555f');
    px(ctx, R.stove.x + 2, R.stove.y - 4, 5, 3, '#6a6a76');
    px(ctx, R.stove.x + 1, R.stove.y - 5, 2, 1, '#7a7a86');
    px(ctx, R.stove.x + 7, R.stove.y - 3, 4, 2, '#8a4a3a');
    px(ctx, R.stove.x + 8, R.stove.y - 4, 2, 1, '#a05a48');

    // 水槽
    px(ctx, R.sink.x, R.sink.y + 2, R.sink.w, 3, '#e8e8ec');
    px(ctx, R.sink.x + 2, R.sink.y + 2, R.sink.w - 4, 1, '#f4f4f8');
    px(ctx, R.sink.x + 4, R.sink.y - 2, 2, 4, '#c8c8d0');

    // 台面绿植
    drawPlant(ctx, R.plant.x, R.plant.y, st.season.id);

    // 餐桌 + 凳
    px(ctx, R.table.x, R.table.y, R.table.w, 3, '#8a5a34');
    px(ctx, R.table.x, R.table.y + 3, R.table.w, 2, '#9c6a40');
    px(ctx, R.table.x + 2, R.table.y + 5, 2, 13, '#6e4626');
    px(ctx, R.table.x + R.table.w - 4, R.table.y + 5, 2, 13, '#6e4626');
    px(ctx, R.stoolA.x, R.stoolA.y, R.stoolA.w, 2, '#7a5230');
    px(ctx, R.stoolA.x + 1, R.stoolA.y + 2, 2, 10, '#6e4626');
    px(ctx, R.stoolB.x, R.stoolB.y, R.stoolB.w, 2, '#7a5230');
    px(ctx, R.stoolB.x + 1, R.stoolB.y + 2, 2, 10, '#6e4626');

    // 餐桌上的餐盘（早餐/午/晚餐时段有饭）
    const eating = st.activity && (st.activity.id === 'breakfast' || st.activity.id === 'lunch' || st.activity.id === 'dinner');
    px(ctx, R.meal.x, R.meal.y + 2, R.meal.w, 2, '#e8e8ec');
    if (eating) {
      px(ctx, R.meal.x + 1, R.meal.y, R.meal.w - 2, 2, '#f4e8d0'); // 米饭
      px(ctx, R.meal.x + 2, R.meal.y - 1, 2, 1, '#e0b060');        // 菜
      px(ctx, R.meal.x + 5, R.meal.y - 3, 1, 3, '#8a6a4a');        // 筷子
      // 蒸汽
      const t = performance.now() / 1000;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      const s1 = Math.floor(t * 2.5) % 3;
      ctx.fillRect(R.meal.x + 3, R.meal.y - 4 - s1, 1, 1);
      ctx.fillRect(R.meal.x + 5, R.meal.y - 5 - ((s1 + 1) % 3), 1, 1);
    } else {
      px(ctx, R.meal.x + 1, R.meal.y + 1, 2, 1, '#ffffff'); // 空盘
    }
  }

  function drawPlant(ctx, x, y, season) {
    // 花盆
    px(ctx, x + 1, y + 8, 5, 2, '#a0522d');
    px(ctx, x, y + 10, 7, 3, '#8a4423');
    px(ctx, x + 1, y + 10, 5, 1, '#b5623a');
    // 叶子
    const leafCol = season === 'autumn' ? '#c89a3a' : season === 'winter' ? '#5a8a5a' : '#4a9a4a';
    ctx.fillStyle = leafCol;
    ctx.fillRect(x + 2, y + 2, 2, 6);
    ctx.fillRect(x + 4, y, 2, 8);
    ctx.fillRect(x + 1, y + 3, 1, 4);
    ctx.fillRect(x + 5, y + 2, 1, 5);
    // 花（春夏）
    if (season === 'spring' || season === 'summer') {
      ctx.fillStyle = season === 'spring' ? '#ff7ba2' : '#ffd23e';
      ctx.fillRect(x + 4, y - 2, 2, 2);
      ctx.fillRect(x + 2, y - 1, 1, 1);
      ctx.fillRect(x + 5, y + 1, 1, 1);
    }
  }

  // 季节小物件（空调/风扇/暖气/加湿器）
  function drawSeasonItems(ctx, st) {
    const s = st.season.id;
    const t = performance.now() / 1000;
    if (s === 'summer') {
      // 卧室空调
      const a = FURN.bedroom.acSpot;
      px(ctx, a.x, a.y, a.w, a.h, '#e8e8ee');
      px(ctx, a.x, a.y, a.w, 1, '#f8f8fe');
      for (let i = 0; i < 4; i++) px(ctx, a.x + 2 + i * 3, a.y + 4, 2, 1, '#8a8a96');
      px(ctx, a.x + 2, a.y + 6, 3, 2, '#7ad8ff');
      // 工作区风扇
      const f = FURN.workspace.fanSpot;
      px(ctx, f.x, f.y + 2, 3, 6, '#5a5a66');
      px(ctx, f.x + 1, f.y, 1, 3, '#6a6a76');
      px(ctx, f.x - 1, f.y, 5, 2, '#8a8a96');
      px(ctx, f.x + 1, f.y - 1 + Math.round(Math.sin(t * 12) * 0.5), 1, 1, '#c0c0cc');
      // 厨房小风扇（台面）
      px(ctx, 302, 96, 2, 2, '#8a8a96');
    } else if (s === 'winter') {
      // 卧室暖气
      const h = FURN.bedroom.heaterSpot;
      px(ctx, h.x, h.y, h.w, h.h, '#c86a5a');
      for (let i = 0; i < 5; i++) px(ctx, h.x + 2 + i * 2, h.y + 2, 1, h.h - 4, '#e08070');
      px(ctx, h.x + 1, h.y, h.w - 2, 1, '#e89a8a');
      // 工作区加湿器
      const u = FURN.workspace.humidSpot;
      px(ctx, u.x, u.y + 6, u.w, u.h - 6, '#8ac8d8');
      px(ctx, u.x, u.y + 8, u.w, 1, '#a0d8e8');
      ctx.fillStyle = 'rgba(200,240,255,0.85)';
      px(ctx, u.x + 2, u.y + 4 - (Math.floor(t * 3) % 3), 1, 1);
      px(ctx, u.x + 4, u.y + 2 - (Math.floor(t * 3 + 1) % 3), 1, 1);
      px(ctx, u.x + 6, u.y + 4 - (Math.floor(t * 3 + 2) % 3), 1, 1);
      // 厨房保温壶
      px(ctx, 256, 106, 3, 4, '#b0503a');
      px(ctx, 257, 104, 1, 2, '#c0604a');
    } else {
      // 春秋：卧室窗台外花 + 厨房植物已画
      if (s === 'spring') {
        px(ctx, 74, 92, 2, 2, '#ff7ba2');
        px(ctx, 75, 90, 1, 1, '#ffb0c4');
      }
    }
  }

  function drawCeilingLamp(ctx, roomIdx) {
    const lx = FURN[C.ROOM_IDS[roomIdx]].ceilingLamp.x;
    const on = lampOn('ceiling', roomIdx);
    px(ctx, lx - 1, CEIL, 2, 6, '#6a6268');
    px(ctx, lx - 5, CEIL + 6, 10, 5, on ? '#ffe9b0' : '#cfc8c0');
    px(ctx, lx - 3, CEIL + 11, 6, 3, on ? '#fff6d8' : '#b0aaa2');
  }

  P.RoomLayout = {
    windows: windows,
    lights: lights,
    lampOn: lampOn,
    hits: hits,
    monitorRect: monitorRect,
    drawHouse: drawHouse,
    drawMonitorContent: drawMonitorContent,
    drawWindowBackdrop: P.Lighting ? P.Lighting.drawWindowBackdrop : null
  };
})();
