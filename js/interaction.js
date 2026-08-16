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
  }

  function toLogical(e) {
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width * C.CANVAS_W;
    const py = (e.clientY - rect.top) / rect.height * C.CANVAS_H;
    return { x: px / C.PIXEL, y: py / C.PIXEL };
  }

  function onClick(e) {
    const p = toLogical(e);
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
    // 灯
    const regions = P.RoomLayout.hits();
    for (let i = 0; i < regions.length; i++) {
      const r = regions[i];
      if (r.type === 'lamp' && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
        toggleLamp(r);
        return;
      }
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
  }

  function openComputer() {
    computerOpen = true;
    computerMode = P.Character.screenMode();
    document.getElementById('computer-modal').classList.remove('hidden');
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
