import { now, minuteOfDay, dayNumber } from './time.js';

export const GIRLFRIEND_PRESENCE=Object.freeze({AWAY:'AWAY',VISITING:'VISITING'});
export const COUPLE_ACTIVITY=Object.freeze({
  ARRIVING:'ARRIVING',WATCH_TV:'WATCH_TV',SWITCH_COOP:'SWITCH_COOP',
  FIREPLACE_CHAT:'FIREPLACE_CHAT',SNACK_TIME:'SNACK_TIME',QUIET_READING:'QUIET_READING',
  IDLE_TOGETHER:'IDLE_TOGETHER',DEPARTING:'DEPARTING'
});

// Beijing-time windows. Sunday is index 0, matching Date#getUTCDay for a pinned
// Beijing calendar date. End points are exclusive.
export const VISIT_WINDOWS=Object.freeze([
  Object.freeze({start:19*60,end:21*60+15}),
  Object.freeze({start:19*60,end:21*60+30}),
  Object.freeze({start:19*60,end:22*60}),
  Object.freeze({start:19*60,end:22*60+15}),
  Object.freeze({start:19*60,end:21*60+45}),
  Object.freeze({start:19*60,end:23*60}),
  Object.freeze({start:18*60+30,end:23*60+30})
]);

const A=COUPLE_ACTIVITY;
const LABELS=Object.freeze({
  [A.ARRIVING]:'她今晚过来了',[A.WATCH_TV]:'正在一起看电视',[A.SWITCH_COOP]:'正在一起打游戏',
  [A.FIREPLACE_CHAT]:'壁炉边闲聊',[A.SNACK_TIME]:'正在吃点东西',[A.QUIET_READING]:'安静地一起看书',
  [A.IDLE_TOGETHER]:'她今晚过来了',[A.DEPARTING]:'送她下楼'
});
const BASE=Object.freeze({
  0:[[0,A.ARRIVING],[10,A.FIREPLACE_CHAT],[70,A.WATCH_TV],[120,A.FIREPLACE_CHAT],[125,A.DEPARTING]],
  1:[[0,A.ARRIVING],[10,A.WATCH_TV],[90,A.SNACK_TIME],[120,A.FIREPLACE_CHAT],[140,A.DEPARTING]],
  2:[[0,A.ARRIVING],[10,A.SWITCH_COOP],[90,A.SNACK_TIME],[120,A.SWITCH_COOP],[170,A.DEPARTING]],
  3:[[0,A.ARRIVING],[10,A.FIREPLACE_CHAT],[90,A.QUIET_READING],[150,A.FIREPLACE_CHAT],[185,A.DEPARTING]],
  4:[[0,A.ARRIVING],[10,A.SNACK_TIME],[45,A.WATCH_TV],[105,A.IDLE_TOGETHER],[155,A.DEPARTING]],
  5:[[0,A.ARRIVING],[10,A.SWITCH_COOP],[90,A.SNACK_TIME],[120,A.WATCH_TV],[195,A.FIREPLACE_CHAT],[230,A.DEPARTING]],
  6:[[0,A.ARRIVING],[10,A.SWITCH_COOP],[70,A.SNACK_TIME],[105,A.WATCH_TV],[175,A.FIREPLACE_CHAT],[235,A.QUIET_READING],[290,A.DEPARTING]]
});
const DOW=t=>new Date(Date.UTC(t.year,t.month-1,t.day)).getUTCDay();
const point=(id,x,y)=>Object.freeze({id,room:y===150?'bedroom':'route',x,y});
const P=Object.freeze({
  entry:point('ENTRY_DOOR',156,346),tvLeft:point('TV_SEAT_LEFT',108,150),tvRight:point('TV_SEAT_RIGHT',126,150),
  fireLeft:point('FIREPLACE_SEAT_LEFT',126,150),fireRight:point('FIREPLACE_SEAT_RIGHT',145,150),
  leisureLeft:point('TOP_LEISURE_LEFT',106,150),leisureRight:point('TOP_LEISURE_RIGHT',124,150),
  table:point('TOP_COFFEE_TABLE',116,150)
});
const ROUTE=Object.freeze([[156,346],[176,346],[202,293],[176,248],[202,195],[176,150],[132,150]]);
function routePoint(progress){
  const p=Math.max(0,Math.min(.999999,progress))*(ROUTE.length-1),i=Math.floor(p),f=p-i,a=ROUTE[i],b=ROUTE[i+1];
  return point('VISIT_ROUTE',a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f);
}
function saturdayPlan(t){
  const plan=BASE[6].map(block=>[...block]);
  // The long Saturday middle pair swaps deterministically by shared world date.
  if(dayNumber(t)%2){plan[3][1]=A.FIREPLACE_CHAT;plan[4][1]=A.WATCH_TV;}
  return plan;
}
function positions(activity,elapsedSeconds,remainingSeconds){
  if(activity===A.ARRIVING)return {male:P.leisureLeft,girlfriend:routePoint(Math.min(1,elapsedSeconds/120)),malePose:'coupleIdle',girlfriendPose:'walk'};
  if(activity===A.DEPARTING)return {male:P.leisureLeft,girlfriend:routePoint(Math.max(0,remainingSeconds/120)),malePose:'coupleIdle',girlfriendPose:'walk'};
  if(activity===A.SWITCH_COOP)return {male:P.tvLeft,girlfriend:P.tvRight,malePose:'coupleGame',girlfriendPose:'game'};
  if(activity===A.WATCH_TV)return {male:P.tvLeft,girlfriend:P.tvRight,malePose:'coupleSit',girlfriendPose:'relaxed'};
  if(activity===A.FIREPLACE_CHAT)return {male:P.fireLeft,girlfriend:P.fireRight,malePose:'coupleSit',girlfriendPose:'chat'};
  if(activity===A.SNACK_TIME)return {male:P.leisureLeft,girlfriend:P.leisureRight,malePose:'coupleSnack',girlfriendPose:'snack'};
  if(activity===A.QUIET_READING)return {male:P.leisureLeft,girlfriend:P.leisureRight,malePose:'coupleRead',girlfriendPose:'read'};
  return {male:P.leisureLeft,girlfriend:P.leisureRight,malePose:'coupleIdle',girlfriendPose:'relaxed'};
}

export function resolveCoupleState(t=now()){
  const dow=DOW(t),window=VISIT_WINDOWS[dow],minute=minuteOfDay(t),seconds=minute*60+(t.sec||0);
  if(minute<window.start||minute>=window.end)return Object.freeze({presence:GIRLFRIEND_PRESENCE.AWAY,activity:null,label:'',tvMode:'off',fireplaceOn:false,girlfriend:null,male:null,window});
  const offset=minute-window.start,plan=dow===6?saturdayPlan(t):BASE[dow];let selected=plan[0];
  for(const block of plan)if(offset>=block[0])selected=block;
  const activity=selected[1],elapsedSeconds=seconds-(window.start+selected[0])*60,remainingSeconds=(window.end-minute)*60-(t.sec||0);
  const placement=positions(activity,elapsedSeconds,remainingSeconds);
  return Object.freeze({presence:GIRLFRIEND_PRESENCE.VISITING,activity,label:LABELS[activity],tvMode:activity===A.SWITCH_COOP?'game':activity===A.WATCH_TV?'movie':'off',fireplaceOn:activity===A.FIREPLACE_CHAT,...placement,window});
}
