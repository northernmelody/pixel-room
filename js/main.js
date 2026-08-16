/* ============================================================
 * main.js —— 入口：初始化所有模块并启动主循环
 * ============================================================ */
(function () {
  'use strict';
  const P = window.PixelRoom; if (!P) return;

  let last = 0;

  // 画布 CSS 显示尺寸取整到逻辑像素（×PIXEL）的整数倍，
  // 避免浏览器把 1280×720 位图缩放到非整数尺寸，导致像素行错位、出现条纹
  function fitSceneSize() {
    const c = document.getElementById('scene');
    if (!c || !P.Config) return;
    const PIXEL = P.Config.PIXEL;
    const availW = window.innerWidth - 24;
    const availH = window.innerHeight - 24;
    let w = Math.min(availW, availH * 16 / 9);
    w = Math.max(320, Math.floor(w / PIXEL) * PIXEL);
    let h = Math.round(w * 9 / 16);
    h = Math.max(180, Math.floor(h / PIXEL) * PIXEL);
    c.style.width = w + 'px';
    c.style.height = h + 'px';
  }

  function init() {
    P.Storage.load();
    if (P.Storage.ensureDaily) P.Storage.ensureDaily(); // 跨天更新（猫粮续满/快递箱）
    if (P.Lighting && P.Lighting.initDailyRandom) P.Lighting.initDailyRandom();
    const canvas = document.getElementById('scene');
    if (!canvas) return;

    P.Renderer.init(canvas);
    fitSceneSize();
    window.addEventListener('resize', fitSceneSize);
    P.Character.init();
    P.Cat.init();
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
