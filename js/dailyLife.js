/* Daily content uses Beijing calendar dates; no runtime content generation or requests. */
(function () {
  'use strict';
  const P = window.PixelRoom;
  function dayNumber(tp) { return Math.floor(Date.UTC(tp.year, tp.month - 1, tp.day) / 86400000); }
  function state() {
    const st = P.Storage.state;
    if (!st.life || typeof st.life !== 'object') st.life = {};
    const life = st.life;
    if (!Number.isFinite(life.epochDay)) {
      life.epochDay = dayNumber(P.Time.now());
      P.Storage.save();
    }
    return life;
  }
  function todayCall(tp) {
    tp = tp || P.Time.now();
    const calls = P.StoryData ? P.StoryData.calls : [];
    const elapsed = Math.max(0, dayNumber(tp) - state().epochDay);
    const index = elapsed % 100;
    return { day: index + 1, conversation: calls[index] || null };
  }
  function meal(activity, tp) {
    tp = tp || P.Time.now();
    const lists = P.StoryData && P.StoryData.dishes;
    const list = lists && lists[activity];
    if (!list || !list.length) return { name: '家常饭菜', type: 'rice' };
    const salt = activity === 'breakfast' ? 3 : activity === 'lunch' ? 17 : 31;
    const index = ((dayNumber(tp) * 7 + salt) % list.length + list.length) % list.length;
    return list[index];
  }
  function minuteStamp(tp) {
    tp = tp || P.Time.now();
    return dayNumber(tp) * 1440 + tp.hour * 60;
  }
  P.DailyLife = { state: state, todayCall: todayCall, meal: meal, dayNumber: dayNumber, minuteStamp: minuteStamp };
})();
