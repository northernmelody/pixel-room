/* ============================================================
 * interaction.js —— 点击交互（摸猫/开关灯/电脑放大）
 * ============================================================ */
(function () {
  'use strict';
  const P = window.PixelRoom; if (!P) return;
  const C = P.Config;
  const FLOOR = C.FLOOR_Y;

  let canvas = null;
  let computerOpen = false;
  let computerMode = null;
  let compCtx = null;

  // 快速开关灯检测（5 秒滑动窗口 + 30 秒冷却）
  let toggleTimes = [];
  let lastScareAt = 0;

  function init(canvasEl) {
    canvas = canvasEl;
    canvas.addEventListener('click', onClick);
    const cc = document.getElementById('computer-canvas');
    if (cc) compCtx = cc.getContext('2d');
    // 模态框按钮（由 UI 绑定亦可，这里统一绑定）
    const close = document.getElementById('computer-close');
    const cycle = document.getElementById('computer-cycle');
    const modal = document.getElementById('computer-modal');
    if (close) close.addEventListener('click', closeComputer);
    if (cycle) cycle.addEventListener('click', cycleComputer);
    if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) closeComputer(); });
    window.addEventListener('resize', function () { if (computerOpen) fitComputer(); });
  }

  // 放大屏画布 CSS 尺寸取整（宽为 16 的倍数 → 高 ×5/8 必为偶数），避免缩放条纹
  function fitComputer() {
    const cc = document.getElementById('computer-canvas');
    if (!cc) return;
    const box = cc.parentElement;
    const avail = (box ? box.clientWidth : 0) - 24; // 减去 .modal-box 内边距
    if (avail < 160) return;
    const w = Math.floor(avail / 16) * 16;
    cc.style.width = w + 'px';
    cc.style.height = Math.round(w * 5 / 8) + 'px';
  }

  function toLogical(e) {
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width * C.CANVAS_W;
    const py = (e.clientY - rect.top) / rect.height * C.CANVAS_H;
    return { x: px / C.PIXEL, y: py / C.PIXEL };
  }

  function onClick(e) {
    const p = toLogical(e);
    // 吉他（卧室右墙边，弹唱触发；先检查小人状态）
    const gr = P.RoomLayout.hits().find(function (r) { return r.type === 'guitar'; });
    if (gr && p.x >= gr.x && p.x <= gr.x + gr.w && p.y >= gr.y && p.y <= gr.y + gr.h) {
      const ret = P.Character.startGuitar();
      if (ret === 'ok') {
        if (P.UI) P.UI.toast('🎸 拿起吉他，弹唱《' + P.Character.guitarSong().title + '》～');
      } else if (ret === 'busy') {
        if (P.UI) P.UI.toast('🎵 正在弹唱中…');
      } else if (ret === 'sleep') {
        if (P.UI) P.UI.toast('🛌 小人在睡觉，别打扰他');
      }
      if (P.Audio) P.Audio.ui();
      return;
    }
    // 电脑
    const comp = P.RoomLayout.hits().find(function (r) { return r.type === 'computer'; });
    if (comp && p.x >= comp.x && p.x <= comp.x + comp.w && p.y >= comp.y && p.y <= comp.y + comp.h) {
      openComputer();
      return;
    }
    // 猫
    const cp = P.Cat.pos();
    if (Math.abs(p.x - cp.x) <= 9 && p.y >= FLOOR - 16 && p.y <= FLOOR + 2) {
      P.Cat.pet();
      if (P.UI) P.UI.toast('🐱 喵～ 摸到猫了！');
      return;
    }
    // 狗（腊肠狗：首次点叫一声，4 秒内再点则跟上小人）
    const dp = P.Dog.pos();
    if (Math.abs(p.x - dp.x) <= 14 && p.y >= FLOOR - 20 && p.y <= FLOOR + 2) {
      const act = P.Dog.interact();
      if (P.UI) P.UI.toast(act === 'follow' ? '🐶 汪汪！腊肠狗跟上你啦～' : '🐶 汪！腊肠狗叫了一声');
      return;
    }
    // 灯
    const regions = P.RoomLayout.hits();
    for (let i = 0; i < regions.length; i++) {
      const r = regions[i];
      if (r.type === 'lamp' && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
        toggleLamp(r);
        return;
      }
    }
    // 小人（当前所在位置 ±15px；灯/猫判定优先，避免挡住台灯开关）
    const ch = P.Character.pos();
    if (Math.abs(p.x - ch.x) <= 15 && p.y >= FLOOR - 38 && p.y <= FLOOR + 2) {
      P.Character.reactRandom();
      if (P.Audio) P.Audio.ui();
      return;
    }
  }

  function toggleLamp(r) {
    const st = P.Storage.state;
    if (r.lamp === 'ceiling') st.lamps.ceiling[r.room] = !st.lamps.ceiling[r.room];
    else st.lamps[r.lamp] = !st.lamps[r.lamp];
    st.lamps.touched = true;
    P.Storage.save();
    if (P.Audio) P.Audio.lamp();
    const lampOn = r.lamp === 'ceiling' ? st.lamps.ceiling[r.room] : st.lamps[r.lamp];
    if (P.UI) P.UI.toast('💡 灯已' + (lampOn ? '开' : '关'));
    P.Events.emit('lamp-toggle', { lamp: r.lamp, room: r.room });

    // 快速开关灯：5 秒内开关 3 次以上 → 猫被吓跑，小人抬头看一眼（30 秒冷却）
    const now = Date.now();
    toggleTimes = toggleTimes.filter(function (ts) { return now - ts < 5000; });
    toggleTimes.push(now);
    if (toggleTimes.length >= 3 && now - lastScareAt > 30000) {
      lastScareAt = now;
      toggleTimes = [];
      if (P.Cat) P.Cat.frightened();
      if (P.Character) P.Character.react('lookup');
      if (P.UI) P.UI.toast('💡 灯闪太快，猫咪吓跑了！');
    }
  }

  function openComputer() {
    computerOpen = true;
    computerMode = P.Character.screenMode();
    document.getElementById('computer-modal').classList.remove('hidden');
    fitComputer();
    updateCaption();
    if (P.Audio) P.Audio.ui();
  }

  function closeComputer() {
    computerOpen = false;
    document.getElementById('computer-modal').classList.add('hidden');
  }

  function cycleComputer() {
    computerMode = P.Character.cycleScreen();
    updateCaption();
    if (P.Audio) P.Audio.ui();
  }

  function updateCaption() {
    const el = document.getElementById('computer-caption');
    if (el) el.textContent = '当前屏幕：' + P.Character.screenName(computerMode) +
      (P.Character.screenName(computerMode) === '摸鱼' ? ' —— 小心老板路过！' : '');
  }

  function isOpen() { return computerOpen; }

  // 放大屏幕绘制（主循环调用）
  function drawComputer(t) {
    if (!compCtx) return;
    const mode = computerMode || P.Character.screenMode();
    const ctx = compCtx;
    ctx.setTransform(2, 0, 0, 2, 0, 0); // 640x400 → 320x200 逻辑
    ctx.clearRect(0, 0, 320, 200);
    // 桌面背景
    ctx.fillStyle = '#151a28';
    ctx.fillRect(0, 0, 320, 200);
    // 屏幕外壳
    ctx.fillStyle = '#2a2d3a';
    ctx.fillRect(24, 20, 272, 158);
    ctx.fillStyle = '#3a3e4e';
    ctx.fillRect(24, 20, 272, 3);
    // 屏幕内容
    ctx.fillStyle = '#0a0c14';
    ctx.fillRect(26, 24, 268, 148);
    P.RoomLayout.drawMonitorContent(ctx, mode, t, 28, 26, 264, 144);
    // 支架
    ctx.fillStyle = '#2e2e3a';
    ctx.fillRect(156, 178, 8, 6);
    ctx.fillRect(148, 184, 24, 4);
    // 桌面
    ctx.fillStyle = '#8a5a34';
    ctx.fillRect(0, 190, 320, 10);
    ctx.fillStyle = '#9c6a40';
    ctx.fillRect(0, 190, 320, 2);
  }

  P.Interaction = {
    init: init,
    isOpen: isOpen,
    drawComputer: drawComputer,
    closeComputer: closeComputer,
    cycleComputer: cycleComputer
  };
})();
