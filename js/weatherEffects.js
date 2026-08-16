/* ============================================================
 * weatherEffects.js —— 雨雪粒子效果（天空带 + 窗外 + 闪电）
 * ============================================================ */
(function () {
  'use strict';
  const P = window.PixelRoom; if (!P) return;
  const C = P.Config;
  const W = C.LOGICAL_W, H = C.LOGICAL_H;

  let enabled = true;
  let rain = [], snow = [];
  let flashT = -1;      // 闪电剩余时间
  let thunderAt = 0;
  const MAX_RAIN = 90, MAX_SNOW = 60;

  function newRain() {
    return { x: Math.random() * W, y: Math.random() * C.SKY_H * 3, sp: 26 + Math.random() * 22, len: 4 + Math.random() * 3 };
  }
  function newSnow() {
    return { x: Math.random() * W, y: Math.random() * H, sp: 2.2 + Math.random() * 2.2, s: 1, ph: Math.random() * 6.28, sway: Math.random() * 6.28 };
  }

  function ensureCounts() {
    const inten = P.Weather.intensity();
    const targetR = P.Weather.isRain() ? Math.round(MAX_RAIN * Math.max(0.3, inten)) : 0;
    const targetS = P.Weather.isSnow() ? Math.round(MAX_SNOW * Math.max(0.3, inten)) : 0;
    while (rain.length < targetR) rain.push(newRain());
    while (snow.length < targetS) snow.push(newSnow());
    if (rain.length > targetR) rain.length = targetR;
    if (snow.length > targetS) snow.length = targetS;
  }

  function update(dt) {
    if (!enabled) return;
    ensureCounts();
    const wind = (P.Weather.get().wind || 0) * 0.05;
    for (let i = 0; i < rain.length; i++) {
      const d = rain[i];
      d.y += d.sp * dt;
      d.x += wind * dt;
      if (d.y > H + 8) { d.y = -8; d.x = Math.random() * W; }
    }
    for (let i = 0; i < snow.length; i++) {
      const s = snow[i];
      s.ph += dt * 2.4;
      s.x += Math.sin(s.ph * 1.3 + s.sway) * 7 * dt + wind * 0.35 * dt;
      s.y += s.sp * dt;
      if (s.y > H + 4) { s.y = -4; s.x = Math.random() * W; }
    }
    // 闪电（雷雨时随机触发）
    if (P.Weather.get().condition.key === 'storm' && Math.random() < dt * 0.14) {
      flashT = 0.13;
      if (Date.now() > thunderAt) {
        thunderAt = Date.now() + 2500;
        setTimeout(function () { if (P.Audio) P.Audio.thunder(); }, 250 + Math.random() * 700);
      }
    }
    if (flashT > -1) flashT -= dt;
  }

  function draw(ctx, st) {
    const rainOn = P.Weather.isRain(), snowOn = P.Weather.isSnow();
    if (!enabled || (!rainOn && !snowOn)) return;

    // 闪电全屏闪白
    if (flashT > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + ((flashT / 0.13) * 0.42).toFixed(2) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    const alpha = st.weather.condition.key === 'storm' ? 0.9 : 0.72;

    if (rainOn) {
      ctx.strokeStyle = 'rgba(168, 198, 255, ' + alpha + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      // 天空带内
      for (let i = 0; i < rain.length; i++) {
        const d = rain[i];
        if (d.y < C.SKY_H + 2) {
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - 1.2, d.y + d.len);
        }
      }
      // 窗内雨丝
      const wins = P.RoomLayout ? P.RoomLayout.windows() : [];
      for (let wIdx = 0; wIdx < wins.length; wIdx++) {
        const w = wins[wIdx];
        for (let i = 0; i < rain.length; i++) {
          const d = rain[i];
          if (d.x >= w.x && d.x <= w.x + w.w) {
            const span = w.h + 8;
            let yy = ((d.y - w.y) % span + span) % span + w.y - 4;
            if (yy >= w.y - 2 && yy <= w.y + w.h) {
              ctx.moveTo(d.x, yy);
              ctx.lineTo(d.x - 1.2, yy + d.len);
            }
          }
        }
      }
      ctx.stroke();
    }

    if (snowOn) {
      for (let i = 0; i < snow.length; i++) {
        const s = snow[i];
        if (s.y < C.SKY_H + 2) {
          ctx.fillStyle = 'rgba(240, 244, 255, ' + (alpha * 0.9).toFixed(2) + ')';
          ctx.fillRect(Math.round(s.x), Math.round(s.y), s.s, s.s);
        }
      }
      // 窗外雪
      const wins2 = P.RoomLayout ? P.RoomLayout.windows() : [];
      for (let wIdx = 0; wIdx < wins2.length; wIdx++) {
        const w = wins2[wIdx];
        for (let i = 0; i < snow.length; i++) {
          const s = snow[i];
          if (s.x >= w.x && s.x <= w.x + w.w) {
            const span = w.h + 2;
            let yy = ((s.y - w.y) % span + span) % span + w.y - 1;
            ctx.fillStyle = 'rgba(240, 244, 255, ' + (alpha * 0.9).toFixed(2) + ')';
            ctx.fillRect(Math.round(s.x), Math.round(yy), s.s, s.s);
          }
        }
      }
    }
  }

  P.WeatherEffects = {
    init() { enabled = P.Storage.state.settings.particles; },
    update: update,
    draw: draw
  };
})();
