/* ============================================================
 * main.js —— 入口：初始化所有模块并启动主循环
 * ============================================================ */
(function () {
  'use strict';
  const P = window.PixelRoom; if (!P) return;

  let last = 0;

  // 画布 CSS 显示尺寸取整到逻辑像素（×PIXEL）的整数倍，
  // 显示比例跟随逻辑画布，避免紧凑房间被重新拉高。
  function fitSceneSize() {
    const c = document.getElementById('scene');
    if (!c || !P.Config) return;
    const PIXEL = P.Config.PIXEL;
    const availW = window.innerWidth - 24;
    const availH = window.innerHeight - 24;
    const ratio = P.Config.LOGICAL_W / P.Config.LOGICAL_H;
    let w = Math.min(availW, availH * ratio);
    w = Math.max(PIXEL, Math.floor(w / PIXEL) * PIXEL);
    let h = Math.round(w / ratio);
    h = Math.max(PIXEL, Math.floor(h / PIXEL) * PIXEL);
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    const wrap = document.getElementById('scene-wrap');
    wrap.style.width = w + 'px';
    wrap.style.height = h + 'px';
  }

  function init() {
    P.Storage.load();
    if (P.Storage.ensureDaily) P.Storage.ensureDaily(); // 跨天更新（猫粮续满/快递箱）
    if (P.Lighting && P.Lighting.initDailyRandom) P.Lighting.initDailyRandom();
    const canvas = document.getElementById('scene');
    if (!canvas) return;

    canvas.width = P.Config.CANVAS_W;
    canvas.height = P.Config.CANVAS_H;
    P.Renderer.init(canvas);
    fitSceneSize();
    window.addEventListener('resize', fitSceneSize);
    P.Character.init();
    P.Cat.init();
    P.Dog.init();
    P.WeatherEffects.init();
    P.Audio.init();
    P.Interaction.init(canvas);
    P.UI.init();

    // 异步拉取北京天气（失败自动兜底）
    P.Weather.refresh();

    window.addEventListener('beforeunload', function () { P.Storage.save(true); });
    requestAnimationFrame(loop);
  }

  function loop(now) {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;

    // ---- 更新 ----
    if (P.Storage && P.Storage.ensureDaily) P.Storage.ensureDaily(); // 检测跨天
    if (P.Storage && P.Storage.syncItems) P.Storage.syncItems();     // 时变物品状态
    P.Character.update(dt);
    if (P.Lighting && P.Lighting.checkAutoLights) P.Lighting.checkAutoLights();
    P.Cat.update(dt);
    P.Dog.update(dt);
    P.WeatherEffects.update(dt);
    P.UI.update(dt);
    // 低频更新环境音与天气刷新
    if (Math.random() < dt * 0.4) P.Audio.updateAmbient();
    if (Math.random() < dt / 30) P.Weather.refresh();

    // ---- 渲染 ----
    P.Renderer.draw(now);

    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
