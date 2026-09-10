/* ============================================================
 * lifeUI.js —— 日常小物、信件和晚间通话的界面层
 * ============================================================ */
(function () {
  'use strict';
  const P = window.PixelRoom; if (!P) return;

  let canvas, hover, lifeTip, callCard, callSpeaker, callText, lastHover = null;
  let modal = null, modalClose = null, lastFocus = null, callVisible = false;
  let lastUpdate = 0;

  function inside(p, r) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }
  function hits() { return P.RoomLayout && P.RoomLayout.lifeHits ? P.RoomLayout.lifeHits() : []; }
  function lifeHit(p) { return hits().find(function (r) { return inside(p, r); }) || null; }
  function logical(e) {
    const box = canvas.getBoundingClientRect(), c = P.Config;
    return { x: (e.clientX - box.left) / box.width * c.LOGICAL_W, y: (e.clientY - box.top) / box.height * c.LOGICAL_H };
  }
  const plushNames = { boba: '珍珠奶茶玩偶', avocado: '牛油果玩偶', bunny: '小兔玩偶', orange: '橘子玩偶', octopus: '小章鱼玩偶', ramen: '拉面玩偶', bedDachshund: '床上的腊肠狗抱枕' };
  function labelFor(r) {
    if (r.type === 'plush' && plushNames[r.id]) return plushNames[r.id];
    if (r.label) return r.label;
    if (r.type === 'plush') return '毛绒小伙伴';
    if (r.type === 'letter') return '一封写给 MOMO 的信';
    if (r.type === 'meal') return '看看正在吃什么';
    if (r.type === 'wardrobe') return '衣柜';
    return '';
  }
  function make(tag, cls, parent) { const el = document.createElement(tag); el.className = cls; (parent || document.body).appendChild(el); return el; }

  function init(canvasEl) {
    canvas = canvasEl;
    const wrap = document.getElementById('scene-wrap');
    hover = make('div', 'life-hover', wrap);
    lifeTip = make('div', 'life-tip', wrap);
    lifeTip.setAttribute('role', 'status');
    buildCallCard(wrap);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', clearHover);
    canvas.addEventListener('touchstart', clearHover, { passive: true });
    window.addEventListener('keydown', onKeydown);
  }

  function buildCallCard(wrap) {
    callCard = make('button', 'call-card hidden', wrap);
    callCard.type = 'button'; callCard.setAttribute('aria-label', '查看今晚的通话记录');
    const title = document.createElement('span'); title.className = 'call-card-title'; title.textContent = '☎ MOMO 来电';
    callSpeaker = document.createElement('span'); callSpeaker.className = 'call-card-speaker';
    callText = document.createElement('span'); callText.className = 'call-card-text';
    callCard.append(title, callSpeaker, callText);
    callCard.addEventListener('click', openCall);
  }

  function onMove(e) {
    if (modal) return;
    const r = lifeHit(logical(e));
    if (!r) return clearHover();
    lastHover = r; canvas.classList.add('is-interactive');
    hover.textContent = labelFor(r); hover.classList.add('show');
    const wrapBox = canvas.parentElement.getBoundingClientRect();
    const x = Math.max(6, Math.min(e.clientX - wrapBox.left + 12, wrapBox.width - hover.offsetWidth - 6));
    const y = Math.max(6, Math.min(e.clientY - wrapBox.top + 14, wrapBox.height - hover.offsetHeight - 6));
    hover.style.left = x + 'px'; hover.style.top = y + 'px';
  }
  function clearHover() { lastHover = null; if (canvas) canvas.classList.remove('is-interactive'); if (hover) hover.classList.remove('show'); }
  function showTip(text) { lifeTip.textContent = text; lifeTip.classList.add('show'); clearTimeout(showTip.timer); showTip.timer = setTimeout(function () { lifeTip.classList.remove('show'); }, 2400); }

  function letterKey(r) {
    const letters = (P.StoryData || {}).letters || {};
    const id = String(r.id || '').toLowerCase();
    if (/from|reply|回|2/.test(id) && letters.fromMomo) return 'fromMomo';
    if (/to|write|写|1/.test(id) && letters.toMomo) return 'toMomo';
    const all = hits().filter(function (x) { return x.type === 'letter'; });
    const position = all.findIndex(function (x) { return x.id === r.id; });
    return position === 1 && letters.fromMomo ? 'fromMomo' : 'toMomo';
  }
  function openLetter(r) {
    const data = ((P.StoryData || {}).letters || {})[letterKey(r)];
    if (!data) return showTip('这本信还没有写完。');
    const content = document.createElement('article'); content.className = 'letter-paper';
    const h = document.createElement('h2'); h.textContent = data.title || '给 MOMO 的信'; content.appendChild(h);
    const meta = document.createElement('p'); meta.className = 'letter-meta'; meta.textContent = (data.from || '') + (data.to ? '  写给 ' + data.to : ''); content.appendChild(meta);
    (data.paragraphs || []).forEach(function (line) { const p = document.createElement('p'); p.textContent = line; content.appendChild(p); });
    openModal('letter-modal', content, '关闭信件');
  }
  function conversation() { const info = P.DailyLife && P.DailyLife.todayCall ? P.DailyLife.todayCall() : null; return info && info.conversation; }
  function openCall() {
    const convo = conversation();
    if (!convo || !Array.isArray(convo.lines)) return showTip('今晚的电话还没接通。');
    const content = document.createElement('section'); content.className = 'call-log';
    const h = document.createElement('h2'); h.textContent = convo.title || '和 MOMO 的通话'; content.appendChild(h);
    const sub = document.createElement('p'); sub.className = 'call-log-sub'; sub.textContent = '21:30 · 今晚的完整对话'; content.appendChild(sub);
    convo.lines.forEach(function (line) {
      const row = document.createElement('p'); row.className = 'call-line ' + (line.speaker === 'MOMO' ? 'momo' : 'me');
      const who = document.createElement('strong'); who.textContent = (line.speaker || '我') + '：'; row.append(who, document.createTextNode(line.text || '')); content.appendChild(row);
    });
    openModal('call-modal', content, '关闭通话记录');
  }
  function openModal(kind, content, closeText) {
    closeModal(); lastFocus = document.activeElement;
    modal = make('div', 'life-modal ' + kind); modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true');
    const shell = make('div', 'life-modal-shell', modal);
    modalClose = make('button', 'life-modal-close', shell); modalClose.type = 'button'; modalClose.textContent = '×'; modalClose.setAttribute('aria-label', closeText);
    shell.appendChild(content); modalClose.addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    document.body.classList.add('life-modal-open'); modalClose.focus();
  }
  function closeModal() {
    if (!modal) return; modal.remove(); modal = null; modalClose = null; document.body.classList.remove('life-modal-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus(); lastFocus = null;
  }
  function onKeydown(e) { if (e.key === 'Escape' && modal) { e.preventDefault(); closeModal(); } }

  function foodName(food) {
    if (!food) return ''; if (food.name) return food.name;
    return { baozi: '热乎乎的包子', bread: '烤面包', noodles: '一碗面', egg: '煎蛋', rice: '米饭' }[food.type] || '今天的饭';
  }
  function handleClick(p) {
    const r = lifeHit(p); if (!r) return false;
    if (r.type === 'plush') { showTip('🧸 ' + labelFor(r)); return true; }
    if (r.type === 'letter') { openLetter(r); return true; }
    if (r.type === 'meal') {
      const st = P.Character && P.Character.lifeStatus ? P.Character.lifeStatus() : null;
      const food = P.Character && P.Character.mealFood ? P.Character.mealFood() : null;
      if (food && (!st || st.kind === 'meal' || st.phase === 'cook' || st.phase === 'eat' || st.phase === 'cooking' || st.phase === 'eating')) showTip('🍽️ ' + foodName(food) + (food.phase ? ' · ' + food.phase : ''));
      else showTip('餐桌现在空着。');
      return true;
    }
    if (r.type === 'wardrobe') {
      const st = P.Character && P.Character.lifeStatus ? P.Character.lifeStatus() : null;
      if (st && (st.kind === 'leisure' || st.phase === 'leisure') && !st.wardrobeOpen && P.Character.startChange) {
        const ret = P.Character.startChange(); showTip(ret === 'ok' ? '👕 去挑一套舒服的衣服。' : '现在不方便换衣服。');
      } else showTip('衣柜里挂着明天要穿的衣服。');
      return true;
    }
    if (r.type === 'exitDoor') { showTip('夜深了，门外也安静下来。'); return true; }
    return false;
  }
  function update() {
    const now = performance.now(); if (now - lastUpdate < 250) return; lastUpdate = now;
    const info = P.Character && P.Character.callInfo ? P.Character.callInfo() : null;
    callVisible = !!info;
    if (!callCard) return;
    callCard.classList.toggle('hidden', !callVisible);
    if (info) { callSpeaker.textContent = info.speaker || 'MOMO'; callText.textContent = info.text || '…'; callCard.title = info.title || '今晚的通话'; }
  }

  P.LifeUI = { init: init, update: update, handleClick: handleClick, closeModal: closeModal };
})();
