/* ============================================================
 * ui.js —— 极简 UI 渲染（时间/声音/设置/提示）
 * ============================================================ */
(function () {
  'use strict';
  const P = window.PixelRoom; if (!P) return;

  let els = {};
  let toastTimer = null;
  let lastClock = 0;

  function $(id) { return document.getElementById(id); }

  function init() {
    els = {
      bj: $('beijing-time'),
      local: $('local-time'),
      act: $('activity-line'),
      soundBtn: $('sound-btn'),
      settingsBtn: $('settings-btn'),
      settings: $('settings-panel'),
      volume: $('volume'),
      optParticles: $('opt-particles'),
      optStars: $('opt-stars'),
      optAnim: $('opt-anim'),
      reset: $('reset-save'),
      modal: $('computer-modal'),
      toast: $('toast'),
      lyricBox: $('lyric-box'),
      lyricTitle: $('lyric-title'),
      lyricLine: $('lyric-line')
    };

    els.soundBtn.addEventListener('click', function () {
      const on = !P.Audio.enabled();
      P.Audio.setEnabled(on);
      updateSoundBtn(on);
      toast(on ? '🔊 声音已开启' : '🔇 声音已关闭（默认静音）');
    });

    els.settingsBtn.addEventListener('click', function () {
      els.settings.classList.toggle('hidden');
      if (P.Audio) P.Audio.ui();
    });

    els.volume.addEventListener('input', function () {
      P.Audio.setVolume(Number(els.volume.value));
      P.Storage.state.volume = Number(els.volume.value);
      P.Storage.save();
    });

    els.optParticles.addEventListener('change', function () {
      P.Storage.state.settings.particles = els.optParticles.checked;
      P.Storage.save();
    });
    els.optStars.addEventListener('change', function () {
      P.Storage.state.settings.stars = els.optStars.checked;
      P.Storage.save();
    });
    els.optAnim.addEventListener('change', function () {
      P.Storage.state.settings.anim = els.optAnim.checked;
      P.Storage.save();
    });

    els.reset.addEventListener('click', function () {
      if (confirm('确定重置存档吗？')) {
        P.Storage.reset();
        location.reload();
      }
    });

    // 初始状态
    els.volume.value = P.Storage.state.volume;
    els.optParticles.checked = !!P.Storage.state.settings.particles;
    els.optStars.checked = !!P.Storage.state.settings.stars;
    els.optAnim.checked = !!P.Storage.state.settings.anim;
    updateSoundBtn(P.Audio.enabled());
  }

  function updateSoundBtn(on) {
    els.soundBtn.textContent = on ? '🔊' : '🔇';
    els.soundBtn.classList.toggle('on', on);
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function update(dt) {
    const now = performance.now();
    if (now - lastClock < 250) return;
    lastClock = now;

    const bj = P.Time.now();
    const loc = P.Time.localParts(new Date());
    const act = P.Time.getSchedule(bj);
    const w = P.Weather.get();
    const season = P.Time.season(bj);
    const ff = P.Time.isFreelance(bj) ? '🎨 自由职业日' : '💼 工作日';

    els.bj.textContent = pad2(bj.hourInt) + ':' + pad2(bj.min) + ':' + pad2(bj.sec);
    const tzH = loc.tzMin >= 0 ? '+' + Math.floor(loc.tzMin / 60) : '' + Math.ceil(loc.tzMin / 60);
    els.local.textContent = '本地 ' + pad2(loc.hourInt) + ':' + pad2(loc.min) + ':' + pad2(loc.sec) + '  UTC' + tzH;
    // 弹唱中：活动行显示当前曲目
    let actName = act.name;
    if (P.Character && P.Character.guitarActive && P.Character.guitarActive()) {
      const sg = P.Character.guitarSong();
      if (sg) actName = '🎸 弹唱《' + sg.title + '》';
    }
    els.act.textContent = '北京 · ' + P.Time.WEEK_CN[bj.weekday] + ' · ' + season.name + '季 · ' +
      w.condition.emoji + ' ' + w.condition.name + (w.source === 'api' ? ' ' + w.temp + '°C' : '') + ' · ' + ff + ' · ' + actName;
  }

  // 歌词显示（吉他弹唱）
  function showLyric(title, line) {
    if (!els.lyricBox) return;
    els.lyricTitle.textContent = title ? ('🎸 ' + title) : '';
    els.lyricLine.textContent = line || '';
    els.lyricBox.classList.add('show');
  }
  function hideLyric() {
    if (els.lyricBox) els.lyricBox.classList.remove('show');
  }

  function toast(msg) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.classList.remove('show'); }, 2000);
  }

  P.UI = {
    init: init,
    update: update,
    toast: toast,
    showLyric: showLyric,
    hideLyric: hideLyric
  };
})();
