/* ============================================================
 * renderer.js —— Canvas 主渲染循环（纯绘制）
 * ============================================================ */
(function () {
  'use strict';
  const P = window.PixelRoom; if (!P) return;
  const C = P.Config;

  let canvas = null, ctx = null;

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
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

  function draw(t) {
    const st = buildState(t);
    ctx.setTransform(C.PIXEL, 0, 0, C.PIXEL, 0, 0);
    ctx.clearRect(0, 0, C.LOGICAL_W, C.LOGICAL_H);

    // 1) 天空
    P.Lighting.drawSky(ctx, st);
    // 2) 房间结构 + 家具
    P.RoomLayout.drawHouse(ctx, st);
    // 3) 小人
    P.Character.draw(ctx, st);
    // 4) 猫
    P.Cat.draw(ctx, st);
    // 5) 雨雪粒子
    P.WeatherEffects.draw(ctx, st);
    // 6) 室内光照叠加
    P.Lighting.applyInterior(ctx, st);
    // 7) 电脑放大画面
    if (P.Interaction && P.Interaction.isOpen()) P.Interaction.drawComputer(t);
  }

  P.Renderer = {
    init: init,
    draw: draw,
    buildState: buildState
  };
})();
