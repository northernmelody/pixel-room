/* ============================================================
 * main.js —— 入口：初始化所有模块并启动主循环
 * ============================================================ */
(function () {
  'use strict';
  const P = window.PixelRoom; if (!P) return;

  let last = 0;

  function init() {
    P.Storage.load();
    const canvas = document.getElementById('scene');
    if (!canvas) return;

    P.Renderer.init(canvas);
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
    P.Character.update(dt);
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
