/* ============================================================
 * audio.js —— 环境音管理（WebAudio 程序化生成，默认静音）
 * ============================================================ */
(function () {
  'use strict';
  const P = window.PixelRoom; if (!P) return;

  let actx = null, master = null;
  let enabled = false, volume = 0.6;
  let ambient = null;
  let noiseBuf = null, brownBuf = null;
  let birdTimer = null, cricketTimer = null;
  let purrNodes = null;

  function buildNoise(len, type) {
    const buf = actx.createBuffer(1, Math.floor(actx.sampleRate * len), actx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'white') d[i] = w;
      else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    }
    return buf;
  }

  function ensureCtx() {
    if (actx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    actx = new AC();
    master = actx.createGain();
    master.gain.value = enabled ? volume * 0.8 : 0;
    master.connect(actx.destination);

    noiseBuf = buildNoise(3, 'white');
    brownBuf = buildNoise(3, 'brown');

    const mkLayer = function (buffer, filterFreq, gain) {
      const src = actx.createBufferSource();
      src.buffer = buffer; src.loop = true;
      const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
      const g = actx.createGain(); g.gain.value = gain;
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
      return g;
    };
    ambient = {
      rain: mkLayer(noiseBuf, 900, 0),
      wind: mkLayer(brownBuf, 260, 0),
      room: mkLayer(noiseBuf, 140, 0.008)
    };
  }

  function startBirds() {
    stopBirds();
    if (!actx || !enabled) return;
    const chirp = function () {
      if (!enabled || !actx) return;
      const t0 = actx.currentTime;
      const o = actx.createOscillator(); o.type = 'sine';
      const g = actx.createGain();
      const f0 = 2400 + Math.random() * 1400;
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.exponentialRampToValueAtTime(f0 * 1.6, t0 + 0.05);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.8, t0 + 0.13);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.045, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.17);
      const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = f0; f.Q.value = 8;
      o.connect(f); f.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + 0.22);
    };
    const loop = function () {
      if (!actx || !enabled) return;
      chirp();
      birdTimer = setTimeout(loop, 700 + Math.random() * 2400);
    };
    birdTimer = setTimeout(loop, 500);
  }
  function stopBirds() { if (birdTimer) { clearTimeout(birdTimer); birdTimer = null; } }

  function startCrickets() {
    stopCrickets();
    if (!actx || !enabled) return;
    const pulse = function () {
      if (!actx || !enabled) return;
      const t0 = actx.currentTime;
      const o = actx.createOscillator(); o.type = 'square'; o.frequency.value = 4300;
      const g = actx.createGain();
      g.gain.setValueAtTime(0, t0);
      for (let i = 0; i < 5; i++) {
        const tt = t0 + i * 0.045;
        g.gain.setValueAtTime(0.016, tt);
        g.gain.linearRampToValueAtTime(0, tt + 0.04);
      }
      g.gain.setValueAtTime(0, t0 + 0.3);
      const f = actx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3000;
      o.connect(f); f.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + 0.4);
    };
    const loop = function () {
      if (!actx || !enabled) return;
      if (Math.random() < 0.85) pulse();
      cricketTimer = setTimeout(loop, 380 + Math.random() * 900);
    };
    cricketTimer = setTimeout(loop, 300);
  }
  function stopCrickets() { if (cricketTimer) { clearTimeout(cricketTimer); cricketTimer = null; } }

  function setEnabled(on) {
    enabled = on;
    if (P.Storage.state) { P.Storage.state.sound = on; P.Storage.save(); }
    if (!on) { stopBirds(); stopCrickets(); if (purrNodes) purrStop(); }
    if (!actx) {
      if (!on) { P.Events.emit('sound-change', on); return; }
      ensureCtx();
      if (!actx) return;
    }
    if (on && actx.state === 'suspended') actx.resume();
    if (master && actx) master.gain.setTargetAtTime(on ? volume * 0.8 : 0, actx.currentTime, 0.1);
    P.Events.emit('sound-change', on);
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v / 100));
    if (actx && master) master.gain.setTargetAtTime(enabled ? volume * 0.8 : 0, actx.currentTime, 0.05);
  }

  // 按时间/天气更新环境层
  function updateAmbient() {
    if (!actx || !ambient || !enabled) return;
    const w = P.Weather.get();
    const tp = P.Time.now();
    const h = tp.hour;
    const isNight = h < 6 || h >= 19;
    const rain = w.condition.key === 'rain' || w.condition.key === 'storm';
    const snow = w.condition.key === 'snow';
    const t = actx.currentTime;
    const set = function (g, v) { g.gain.setTargetAtTime(v, t, 0.6); };
    set(ambient.rain, rain ? 0.05 + P.Weather.intensity() * 0.09 : 0);
    set(ambient.wind, (w.wind > 6 ? 0.02 : 0.008) + (rain ? 0.02 : 0));
    if (!isNight && !rain && !snow) startBirds(); else stopBirds();
    if (isNight && !rain) startCrickets(); else stopCrickets();
  }

  // ---- 音效 ----
  function tone(opts) {
    if (!actx || !enabled || !master) return;
    const type = opts.type || 'sine';
    const f0 = opts.f0 || 440;
    const dur = opts.dur || 0.2;
    const vol = opts.vol || 0.1;
    const t0 = actx.currentTime;
    const o = actx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (opts.f1) {
      if (opts.curve === 'lin') o.frequency.linearRampToValueAtTime(opts.f1, t0 + dur);
      else o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.f1), t0 + dur);
    }
    const g = actx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, vol, lp) {
    if (!actx || !enabled || !master || !noiseBuf) return;
    const t0 = actx.currentTime;
    const src = actx.createBufferSource(); src.buffer = noiseBuf;
    const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 1000;
    const g = actx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  function purrStop() {
    if (!purrNodes || !actx) return;
    const t = actx.currentTime;
    purrNodes.g.gain.setTargetAtTime(0, t, 0.08);
    purrNodes.o.stop(t + 0.4);
    purrNodes.lfo.stop(t + 0.4);
    purrNodes = null;
  }

  P.Audio = {
    init() {
      const st = P.Storage.state;
      volume = (st.volume || 60) / 100;
      enabled = !!st.sound;
      if (enabled) {
        ensureCtx();
        if (actx && actx.state === 'suspended') actx.resume();
      }
    },
    enabled: function () { return enabled; },
    setEnabled: setEnabled,
    setVolume: setVolume,
    updateAmbient: updateAmbient,
    ui: function () { tone({ type: 'square', f0: 720, dur: 0.06, vol: 0.05 }); },
    lamp: function () { noiseBurst(0.03, 0.12, 2200); tone({ type: 'square', f0: 1400, dur: 0.03, vol: 0.04 }); },
    meow: function () {
      if (!actx || !enabled || !master) return;
      const t0 = actx.currentTime;
      const o = actx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(420, t0);
      o.frequency.linearRampToValueAtTime(760, t0 + 0.18);
      o.frequency.linearRampToValueAtTime(560, t0 + 0.45);
      const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 3;
      const g = actx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.12, t0 + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
      o.connect(f); f.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + 0.6);
    },
    purrStart: function () {
      if (!actx || !enabled || purrNodes) return;
      const t0 = actx.currentTime;
      const o = actx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 27;
      const lfo = actx.createOscillator(); lfo.frequency.value = 24;
      const lfoG = actx.createGain(); lfoG.gain.value = 0.012;
      lfo.connect(lfoG); lfoG.connect(o.frequency);
      const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 140;
      const g = actx.createGain(); g.gain.value = 0.03;
      o.connect(f); f.connect(g); g.connect(master);
      o.start(t0); lfo.start(t0);
      purrNodes = { o: o, lfo: lfo, g: g };
    },
    purrStop: purrStop,
    keyboard: function () { noiseBurst(0.015, 0.03, 3000); },
    footstep: function () { noiseBurst(0.05, 0.02, 500); },
    thunder: function () { noiseBurst(2.2, 0.2, 160); },
    eat: function () { noiseBurst(0.03, 0.05, 600); },
    flush: function () {
      if (!actx || !enabled || !master) return;
      const t0 = actx.currentTime;
      // 水声（噪声爆发）
      noiseBurst(0.5, 0.16, 900);
      // 下冲音（漩涡感）
      const o = actx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(300, t0);
      o.frequency.exponentialRampToValueAtTime(140, t0 + 0.5);
      const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 2;
      const g = actx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.06, t0 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
      o.connect(f); f.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + 0.7);
      // 漩涡尾音
      setTimeout(function () { if (actx && enabled) noiseBurst(0.4, 0.08, 500); }, 180);
    }
  };

  P.Events.on('weather-change', function () { P.Audio.updateAmbient(); });
})();
