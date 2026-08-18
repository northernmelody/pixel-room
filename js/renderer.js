/* ============================================================
 * renderer.js —— Canvas 主渲染循环（纯绘制）
 * 视觉强化：离屏 Canvas 缓存静态场景，动态光影/动画逐帧更新
 * ============================================================ */
(function () {
  'use strict';
  const P = window.PixelRoom; if (!P) return;
  const C = P.Config;

  let canvas = null, ctx = null;
  let staticCanvas = null, staticCtx = null, staticSig = '';

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    // 离屏静态缓存
    staticCanvas = document.createElement('canvas');
    staticCanvas.width = C.LOGICAL_W;
    staticCanvas.height = C.LOGICAL_H;
    staticCtx = staticCanvas.getContext('2d');
    staticCtx.imageSmoothingEnabled = false;
  }

  // 每帧构建光照/天气/作息状态
  function buildState(t) {
    const tp = P.Time.now();
    const season = P.Time.season(tp);
    const weather = P.Weather.get();
    const st = P.Lighting.compute(tp, season, weather);
    st.tp = tp;
    st.season = season;
    st.weather = weather;
    st.activity = P.Time.getSchedule(tp);
    st.washPhase = tp.hour >= 22 ? 'shower' : 'brush';
    return st;
  }

  // 静态场景缓存签名（季节/灯状态/动态物品状态变化时需要重建）
  function staticSignature(st) {
    const lampState = P.RoomLayout.lights().map(function (l) { return l.on ? '1' : '0'; }).join('');
    const it = P.Storage.state.items || {};
    const pkg = it.pkg || {};
    const collectibles = Array.isArray(it.collectibles) ? it.collectibles.join(',') : '';
    const meal = P.Character.mealFood ? (P.Character.mealFood() || {}).type || '' : '';
    const perch = P.Cat.perchId ? (P.Cat.perchId() || '') : '';
    const guitarTaken = P.Character.guitarTaken ? (P.Character.guitarTaken() ? '1' : '0') : '0';
    return st.season.id + '|' + lampState + '|' + (P.Storage.state.settings.anim ? '1' : '0') +
      '|' + (it.cup != null ? it.cup : '') + '|' + (it.blanket || '') +
      '|' + (it.bowl != null ? it.bowl : '') + '|' + (it.dogBowl != null ? it.dogBowl : '') + '|' + (it.dishes || 0) +
      '|' + (pkg.state || '') + '|' + collectibles + '|' + meal + '|' + perch + '|g' + guitarTaken;
  }

  function ensureStaticCache(st) {
    const sig = staticSignature(st);
    if (staticCtx && staticSig === sig) return;
    staticSig = sig;
    staticCtx.setTransform(1, 0, 0, 1, 0, 0);
    staticCtx.clearRect(0, 0, C.LOGICAL_W, C.LOGICAL_H);
    P.RoomLayout.drawHouse(staticCtx, st);
  }

  function draw(t) {
    const st = buildState(t);
    ensureStaticCache(st);
    ctx.setTransform(C.PIXEL, 0, 0, C.PIXEL, 0, 0);
    ctx.clearRect(0, 0, C.LOGICAL_W, C.LOGICAL_H);

    // 1) 天空（动态）
    P.Lighting.drawSky(ctx, st);
    // 2) 静态场景（离屏缓存：结构/墙面/地板/家具）
    ctx.drawImage(staticCanvas, 0, 0);
    // 3) 动态家具内容（窗内天空/屏幕/蒸汽/水珠/吊灯）
    P.RoomLayout.drawDynamic(ctx, st, t / 1000);
    // 4) 小人（z=2）
    P.Character.draw(ctx, st);
    // 5) 猫（z=2）
    P.Cat.draw(ctx, st);
    // 6) 腊肠狗（z=2）
    P.Dog.draw(ctx, st);
    // 7) 雨雪粒子
    P.WeatherEffects.draw(ctx, st);
    // 7) 室内光照叠加（光斑/冷光/灯晕/暗角）
    P.Lighting.applyInterior(ctx, st);
    // 8) 电脑放大画面
    if (P.Interaction && P.Interaction.isOpen()) P.Interaction.drawComputer(t);
  }

  P.Renderer = {
    init: init,
    draw: draw,
    buildState: buildState,
    _cacheSig: function () { return staticSig; }
  };
})();
