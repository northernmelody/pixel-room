/* ============================================================
 * lighting.js —— 昼夜光影系统：天空、太阳/月亮、室内灯光
 * ============================================================ */
(function () {
  'use strict';
  const P = window.PixelRoom; if (!P) return;
  const C = P.Config;
  const W = C.LOGICAL_W, H = C.LOGICAL_H;

  // ---- 颜色工具 ----
  function parseColor(c) {
    const t = String(c).trim();
    if (t.charAt(0) === '#') {
      const n = parseInt(t.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const m = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(t);
    if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
    return [0, 0, 0];
  }
  function mix(h1, h2, t) {
    const a = parseColor(h1), b = parseColor(h2);
    t = Math.max(0, Math.min(1, t));
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' +
      Math.round(a[1] + (b[1] - a[1]) * t) + ',' +
      Math.round(a[2] + (b[2] - a[2]) * t) + ')';
  }
  function rgba(r, g, b, a) {
    return 'rgba(' + r + ',' + g + ',' + b + ',' + (Math.round(a * 1000) / 1000) + ')';
  }

  // 星空（预生成固定位置）
  let stars = null;
  function ensureStars() {
    if (stars) return;
    stars = [];
    for (let i = 0; i < 70; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * C.SKY_H,
        s: Math.random() < 0.25 ? 1 : 1,
        c: ['#ffffff', '#aeb8ff', '#ffe8b0', '#cfe8ff'][(Math.random() * 4) | 0],
        ph: Math.random() * 6.28
      });
    }
  }

  // 计算光照状态
  function compute(tp, season, weather) {
    const ast = P.Time.astro(tp, season.id);
    const day = ast.sunElev > 0 ? Math.min(1, ast.sunElev * 1.35) : 0;
    // 暮光：太阳接近地平线（±16°）时非零，深夜里归零
    const tw = Math.max(0, Math.min(1, 1 - Math.abs(ast.sunElev) * 6));
    const dim = weather.condition.dim || 1;
    const ambient = (0.16 + 0.84 * day) * dim;
    return { ast: ast, day: day, tw: tw, dim: dim, ambient: ambient };
  }

  // 在指定竖直区间绘制太阳/月亮（天空带与窗户共用）
  function drawCelestial(ctx, st, x0, x1, y0, y1, alphaMul) {
    const ast = st.ast;
    const alphaMul2 = alphaMul || 1;
    const wSpan = x1 - x0;
    const hSpan = y1 - y0;
    if (ast.sunElev > 0) {
      const sx = x0 + wSpan * (0.12 + ast.sunT * 0.76);
      const sy = y0 + hSpan * (1 - ast.sunElev * 0.92);
      const r = Math.max(2, hSpan * 0.24);
      // 光晕
      const glow = ctx.createRadialGradient(sx, sy, 1, sx, sy, r * 3.2);
      const ga = 0.5 * ast.sunElev * alphaMul2;
      glow.addColorStop(0, rgba(255, 236, 170, Math.min(0.55, ga * 1.4)));
      glow.addColorStop(1, rgba(255, 236, 170, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(sx - r * 3.2, sy - r * 3.2, r * 6.4, r * 6.4);
      // 日轮
      ctx.fillStyle = mix('#ffd968', '#fff0c0', Math.min(1, ast.sunElev * 1.5));
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(sx - r + 1, sy - r + 1, Math.max(1, r), Math.max(1, r * 0.6));
    } else if (ast.moonElev > 0) {
      const mx = x0 + wSpan * (0.88 - ast.moonT * 0.76);
      const my = y0 + hSpan * (1 - ast.moonElev * 0.92);
      const r = Math.max(2, hSpan * 0.22);
      const glow = ctx.createRadialGradient(mx, my, 1, mx, my, r * 3);
      const ga = 0.4 * ast.moonElev * alphaMul2;
      glow.addColorStop(0, rgba(210, 220, 255, Math.min(0.5, ga)));
      glow.addColorStop(1, rgba(210, 220, 255, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(mx - r * 3, my - r * 3, r * 6, r * 6);
      // 月轮 + 缺口
      ctx.fillStyle = C.COLORS.moon;
      ctx.fillRect(mx - r, my - r, r * 2, r * 2);
      ctx.fillStyle = '#131a3a';
      ctx.fillRect(mx - r * 0.4, my - r * 0.9, r * 1.4, r * 1.8);
      ctx.fillStyle = 'rgba(180,190,220,0.5)';
      ctx.fillRect(mx - r + 1, my - r + 2, 2, 2);
      ctx.fillRect(mx + 1, my + 1, 2, 2);
    }
  }

  // 云（天空带）
  function drawCloud(ctx, x, y, s, alpha) {
    ctx.fillStyle = rgba(226, 232, 244, alpha);
    ctx.fillRect(x, y, 10 * s, 3 * s);
    ctx.fillRect(x + 2 * s, y - 2 * s, 6 * s, 3 * s);
    ctx.fillRect(x + 3 * s, y + 2 * s, 5 * s, 2 * s);
  }

  // 顶部天空带
  function drawSky(ctx, st) {
    ensureStars();
    const day = st.day, tw = st.tw;
    const cloudiness = st.weather.condition.cloud || 0;
    const t = performance.now() / 1000;

    // 三层天空色
    let top = mix(C.COLORS.skyNightTop, C.COLORS.skyDayTop, day);
    let mid = mix(C.COLORS.skyNightMid, C.COLORS.skyDayMid, day);
    let bot = mix(C.COLORS.skyNightBot, C.COLORS.skyDayBot, day);
    if (tw > 0.02) {
      const d2 = Math.min(1, tw * 1.5);
      mid = mix(mid, C.COLORS.skyDawnMid, d2);
      bot = mix(bot, C.COLORS.skyDawnBot, d2);
      top = mix(top, '#2c2f62', d2 * 0.6);
    }
    // 阴天/雨雪变灰
    if (cloudiness > 0.1) {
      const g = cloudiness * 0.72;
      top = mix(top, '#3f4654', g);
      mid = mix(mid, '#5a6472', g);
      bot = mix(bot, '#8b94a0', g * 0.7);
    }

    const grad = ctx.createLinearGradient(0, 0, 0, C.SKY_H);
    grad.addColorStop(0, top);
    grad.addColorStop(0.55, mid);
    grad.addColorStop(1, bot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, C.SKY_H);
    // 天空带以下基底（房子会盖住）
    ctx.fillStyle = bot;
    ctx.fillRect(0, C.SKY_H, W, H - C.SKY_H);

    // 星空
    const starsOn = P.Storage.state.settings.stars;
    const starA = Math.max(0, 1 - day * 1.2) * (1 - cloudiness * 0.85);
    if (starsOn && starA > 0.03) {
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const twinkle = 0.45 + 0.55 * Math.sin(t * 1.6 + s.ph);
        ctx.fillStyle = rgba(240, 244, 255, starA * twinkle * 0.85);
        ctx.fillRect(s.x, s.y, s.s, s.s);
      }
    }

    // 太阳/月亮（天空带）
    drawCelestial(ctx, st, 0, W, 0, C.SKY_H, 1);

    // 云层
    const cloudA = 0.15 + cloudiness * 0.7;
    if (cloudA > 0.05) {
      const n = st.weather.condition.key === 'storm' ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const sp = 0.6 + i * 0.35;
        const cx = ((i * 97 + t * sp * 14) % (W + 30)) - 15;
        const cy = 6 + ((i * 29) % 22);
        const s = 1 + ((i % 2) * 0.5);
        const a = cloudA * (st.weather.condition.key === 'storm' ? 1 : 0.8) * (0.7 + ((i * 37) % 30) / 100);
        drawCloud(ctx, Math.round(cx), Math.round(cy), s, a);
      }
    }

    // 雾
    if (st.weather.condition.key === 'fog') {
      ctx.fillStyle = 'rgba(220,228,240,0.35)';
      ctx.fillRect(0, 0, W, C.SKY_H);
    }
  }

  // 窗户内的天空底 + 天体
  function drawWindowBackdrop(ctx, st, x, y, w, h) {
    const day = st.day, tw = st.tw;
    const cloudiness = st.weather.condition.cloud || 0;
    let top = mix(C.COLORS.skyNightMid, C.COLORS.skyDayMid, day);
    let bot = mix(C.COLORS.skyNightBot, C.COLORS.skyDayBot, day);
    if (tw > 0.02) {
      top = mix(top, C.COLORS.skyDawnMid, Math.min(1, tw * 1.4));
      bot = mix(bot, C.COLORS.skyDawnBot, Math.min(1, tw * 1.4));
    }
    if (cloudiness > 0.1) {
      top = mix(top, '#4a5260', cloudiness);
      bot = mix(bot, '#7d8794', cloudiness * 0.8);
    }
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, top);
    g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    // 天体（按窗口比例）
    drawCelestial(ctx, st, x, x + w, y, y + h, 0.9);
    // 窗内小云
    if (cloudiness > 0.25 && st.day > 0.05) {
      const t = performance.now() / 1000;
      const cx = x + ((t * 5) % (w + 8)) - 4;
      drawCloud(ctx, Math.round(cx), y + 4, 0.55, 0.6);
    }
  }

  // ---- 窗户光斑（平行四边形投影，随太阳位置变化）----
  function drawWindowLightPatches(ctx, st, t) {
    const wins = P.RoomLayout ? P.RoomLayout.windows() : [];
    const ast = st.ast;
    const h = st.tp ? st.tp.hour : 12;
    const rainy = st.weather.condition.rain > 0 || st.weather.condition.snow > 0;
    // 白天光斑（08:00 - 18:30），黄昏偏暖
    const dayPatch = st.day > 0.06 && h >= 8 && h <= 18.6;
    // 深夜月光（00:00 - 05:00）
    const moonPatch = h >= 0 && h < 5 && st.ast.night;
    const y0 = C.FLOOR_Y, y1 = H;
    for (let i = 0; i < wins.length; i++) {
      const w = wins[i];
      // 光斑斜度：太阳/月亮位置 → 缓慢变化的角度
      const slant = dayPatch ? ((ast.sunT - 0.5) * 1.5 + Math.sin(t * 0.06 + i * 1.7) * 0.18)
        : moonPatch ? ((ast.moonT - 0.5) * 1.1 + Math.sin(t * 0.04 + i * 2.3) * 0.12) : 0;
      const dx = slant * (y1 - y0);
      const x0 = w.x, x1 = w.x + w.w;
      if (dayPatch) {
        // 黄昏偏暖：白色 → 暖黄
        const warm = st.tw;
        const rr = 255, gg = Math.round(247 - warm * 30), bb = Math.round(216 - warm * 60);
        const a = 0.11 + st.day * 0.045 + (warm > 0.05 ? 0.02 : 0);
        const alpha = a * (1 - rainy * 0.45); // 雨雪天光斑减弱
        if (alpha <= 0.01) continue;
        // 平行四边形 + 水平软边
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y0);
        ctx.lineTo(x1 + dx, y1);
        ctx.lineTo(x0 + dx, y1);
        ctx.closePath();
        ctx.clip();
        const g = ctx.createLinearGradient(x0, 0, x1, 0);
        g.addColorStop(0, rgba(rr, gg, bb, 0));
        g.addColorStop(0.3, rgba(rr, gg, bb, alpha));
        g.addColorStop(0.7, rgba(rr, gg, bb, alpha));
        g.addColorStop(1, rgba(rr, gg, bb, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x0 + Math.min(0, dx), y0, x1 - x0 + Math.abs(dx), y1 - y0);
        ctx.restore();
      } else if (moonPatch) {
        // 月光：淡蓝
        const a = 0.055;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y0);
        ctx.lineTo(x1 + dx, y1);
        ctx.lineTo(x0 + dx, y1);
        ctx.closePath();
        ctx.clip();
        const g = ctx.createLinearGradient(x0, 0, x1, 0);
        g.addColorStop(0, rgba(190, 205, 255, 0));
        g.addColorStop(0.3, rgba(190, 205, 255, a));
        g.addColorStop(0.7, rgba(190, 205, 255, a));
        g.addColorStop(1, rgba(190, 205, 255, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x0 + Math.min(0, dx), y0, x1 - x0 + Math.abs(dx), y1 - y0);
        ctx.restore();
      }
    }
  }

  // ---- 电脑屏幕冷光（工作时段，投射到桌面与小人的方向）----
  function drawScreenGlow(ctx, st, t) {
    if (!(st.activity && st.activity.id === 'work')) return;
    const R = P.RoomLayout && P.RoomLayout.monitorRect ? P.RoomLayout.monitorRect() : null;
    if (!R) return;
    const cx = R.x + R.w / 2, cy = R.y + R.h / 2;
    ctx.globalCompositeOperation = 'lighter';
    // 屏幕前冷蓝光晕（覆盖桌面与小人面部区域）
    const g = ctx.createRadialGradient(cx + 2, cy + 6, 2, cx + 2, cy + 6, 36);
    g.addColorStop(0, rgba(96, 168, 255, 0.15));
    g.addColorStop(0.45, rgba(96, 168, 255, 0.07));
    g.addColorStop(1, rgba(96, 168, 255, 0));
    ctx.fillStyle = g;
    ctx.fillRect(cx - 34, cy - 30, 72, 68);
    // 朝向小人的冷光带
    const g2 = ctx.createLinearGradient(cx, cy, cx + 34, cy + 18);
    g2.addColorStop(0, rgba(120, 180, 255, 0.11));
    g2.addColorStop(1, rgba(120, 180, 255, 0));
    ctx.fillStyle = g2;
    ctx.fillRect(cx, cy - 12, 36, 46);
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---- 室内光照叠加 ----
  function applyInterior(ctx, st) {
    const amb = st.ambient;
    const weather = st.weather.condition;
    const rainy = weather.rain > 0 || weather.snow > 0;
    let dark = Math.max(0, (1 - amb) * 0.74);
    if (rainy) dark *= 0.5; // 雨雪天阴影变淡、对比度降低
    const t = performance.now() / 1000;

    // 1) 整体变暗
    ctx.fillStyle = rgba(6, 10, 26, Math.min(0.84, dark));
    ctx.fillRect(0, C.CEILING_Y, W, H - C.CEILING_Y);

    // 1.5) 雨雪天散射光（柔和冷色漫射，降低对比）
    if (rainy) {
      const rainK = Math.max(weather.rain, weather.snow);
      ctx.fillStyle = rgba(150, 172, 208, 0.05 + rainK * 0.03);
      ctx.fillRect(0, C.CEILING_Y, W, H - C.CEILING_Y);
    }

    // 2) 窗户光斑（地面平行四边形投影）
    drawWindowLightPatches(ctx, st, t);

    // 3) 窗户周围光（日间暖光 / 夜间月光）
    const wins = P.RoomLayout ? P.RoomLayout.windows() : [];
    for (let i = 0; i < wins.length; i++) {
      const w = wins[i];
      const cx = w.x + w.w / 2, cy = w.y + w.h / 2;
      if (st.day > 0.05) {
        const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 48);
        const a = 0.34 * st.day * (1 - st.weather.condition.rain * 0.3);
        g.addColorStop(0, rgba(255, 250, 230, a));
        g.addColorStop(1, rgba(255, 250, 230, 0));
        ctx.fillStyle = g;
        ctx.fillRect(cx - 48, cy - 48, 96, 96);
      } else {
        const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 42);
        g.addColorStop(0, rgba(190, 205, 255, 0.1));
        g.addColorStop(1, rgba(190, 205, 255, 0));
        ctx.fillStyle = g;
        ctx.fillRect(cx - 42, cy - 42, 84, 84);
      }
    }

    // 4) 电脑屏幕冷光
    drawScreenGlow(ctx, st, t);

    // 5) 灯具光（暖光晕，径向渐变，边缘柔和）
    ctx.globalCompositeOperation = 'lighter';
    const lights = P.RoomLayout ? P.RoomLayout.lights() : [];
    for (let i = 0; i < lights.length; i++) {
      const l = lights[i];
      if (!l.on) continue;
      const flicker = 1 + Math.sin(t * 11 + l.seed * 7) * 0.03 + (Math.random() - 0.5) * 0.02;
      const a = l.a * flicker;
      // 主光晕
      const g = ctx.createRadialGradient(l.x, l.y, 1, l.x, l.y, l.r);
      g.addColorStop(0, rgba(255, 240, 180, a * 1.15));
      g.addColorStop(0.3, rgba(255, 222, 140, a * 0.85));
      g.addColorStop(0.65, rgba(255, 200, 108, a * 0.4));
      g.addColorStop(1, rgba(255, 200, 108, 0));
      ctx.fillStyle = g;
      ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      // 灯芯亮斑
      const core = ctx.createRadialGradient(l.x, l.y, 0.5, l.x, l.y, Math.max(4, l.r * 0.22));
      core.addColorStop(0, rgba(255, 252, 230, a * 1.2));
      core.addColorStop(1, rgba(255, 240, 180, 0));
      ctx.fillStyle = core;
      ctx.fillRect(l.x - 5, l.y - 5, 10, 10);
      // 地面暖光池（吊灯）
      if (l.kind === 'ceiling') {
        const eg = ctx.createRadialGradient(l.x, C.FLOOR_Y + 20, 2, l.x, C.FLOOR_Y + 20, 24);
        eg.addColorStop(0, rgba(255, 224, 150, a * 0.11));
        eg.addColorStop(1, rgba(255, 224, 150, 0));
        ctx.fillStyle = eg;
        ctx.fillRect(l.x - 24, C.FLOOR_Y - 2, 48, 44);
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    // 6) 夜间上部蓝晕
    if (dark > 0.25) {
      const g = ctx.createLinearGradient(0, C.CEILING_Y, 0, C.FLOOR_Y + 20);
      const a = Math.min(0.28, (dark - 0.25) * 0.45);
      g.addColorStop(0, rgba(10, 14, 40, a));
      g.addColorStop(1, rgba(10, 14, 40, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, C.CEILING_Y, W, C.FLOOR_Y + 20 - C.CEILING_Y);
    }

    // 7) 暗角（雨雪天更淡）
    const vigK = rainy ? 0.65 : 1;
    const vg = ctx.createRadialGradient(W / 2, H * 0.42, H * 0.5, W / 2, H * 0.42, H * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,' + ((0.16 + dark * 0.22) * vigK).toFixed(3) + ')');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  P.Lighting = {
    compute: compute,
    drawSky: drawSky,
    drawWindowBackdrop: drawWindowBackdrop,
    applyInterior: applyInterior
  };
})();
