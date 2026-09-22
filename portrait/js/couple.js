import { now, minuteOfDay, dayNumber } from './time.js';
import { ANCHORS } from './layout.js';

export const GIRLFRIEND_PRESENCE=Object.freeze({AWAY:'AWAY',VISITING:'VISITING',STAYING_OVERNIGHT:'STAYING_OVERNIGHT'});
export const COUPLE_ACTIVITY=Object.freeze({
  ARRIVING:'ARRIVING',WATCH_TV:'WATCH_TV',SWITCH_COOP:'SWITCH_COOP',FIREPLACE_CHAT:'FIREPLACE_CHAT',
  SNACK_TIME:'SNACK_TIME',QUIET_READING:'QUIET_READING',IDLE_TOGETHER:'IDLE_TOGETHER',
  BED_PREP:'BED_PREP',BED_CHAT:'BED_CHAT',CUDDLE:'CUDDLE',KISS_GOODNIGHT:'KISS_GOODNIGHT',
  UNDER_BLANKET_INTIMACY:'UNDER_BLANKET_INTIMACY',SETTLING_TO_SLEEP:'SETTLING_TO_SLEEP',
  SLEEP_TOGETHER:'SLEEP_TOGETHER',WAKE_TOGETHER:'WAKE_TOGETHER',DEPARTING:'DEPARTING'
});
export const BED_STATE=Object.freeze({EMPTY_DAY:'BED_EMPTY_DAY',READY_NIGHT:'BED_READY_NIGHT',OCCUPIED_CHAT:'BED_OCCUPIED_CHAT',OCCUPIED_CUDDLE:'BED_OCCUPIED_CUDDLE',OCCUPIED_INTIMATE:'BED_OCCUPIED_INTIMATE',OCCUPIED_SLEEP:'BED_OCCUPIED_SLEEP',OCCUPIED_WAKE:'BED_OCCUPIED_WAKE'});
export const BEDROOM_LIGHT=Object.freeze({DAY:'DAY',EVENING:'EVENING',WARM_BEDSIDE:'WARM_BEDSIDE',DIM:'DIM',SLEEP:'SLEEP',MORNING:'MORNING'});

export const VISIT_WINDOWS=Object.freeze([
  Object.freeze({start:1140,end:1275}),Object.freeze({start:1140,end:1290}),Object.freeze({start:1140,end:1320}),
  Object.freeze({start:1140,end:1335}),Object.freeze({start:1140,end:1305}),Object.freeze({start:1140,end:1380}),Object.freeze({start:1110,end:1410})
]);
// Existing LifeDirector sleep boundaries; Friday/Saturday cross midnight.
export const BEDTIMES=Object.freeze([1385,1380,1380,1420,1380,1455,1475]);
const WAKE_MINUTES=Object.freeze([480,440,440,440,440,440,510]);
const DEPARTURE_MINUTES=Object.freeze([525,455,455,455,455,455,555]);
const A=COUPLE_ACTIVITY,B=BED_STATE,L=BEDROOM_LIGHT;
const LABELS=Object.freeze({
  [A.ARRIVING]:'她今晚过来了',[A.WATCH_TV]:'正在一起看电视',[A.SWITCH_COOP]:'正在一起打游戏',[A.FIREPLACE_CHAT]:'壁炉边闲聊',
  [A.SNACK_TIME]:'正在吃点东西',[A.QUIET_READING]:'安静地一起看书',[A.IDLE_TOGETHER]:'安静地待在一起',[A.BED_PREP]:'准备休息',
  [A.BED_CHAT]:'躺在床上聊天',[A.CUDDLE]:'靠在一起',[A.KISS_GOODNIGHT]:'互道晚安',[A.UNDER_BLANKET_INTIMACY]:'灯已经关了',
  [A.SETTLING_TO_SLEEP]:'准备睡觉',[A.SLEEP_TOGETHER]:'两个人都睡着了',[A.WAKE_TOGETHER]:'新的一天开始了',[A.DEPARTING]:'她准备出门'
});
const LEISURE=Object.freeze({
  0:[[0,A.ARRIVING],[10,A.FIREPLACE_CHAT],[70,A.WATCH_TV],[120,A.FIREPLACE_CHAT]],1:[[0,A.ARRIVING],[10,A.WATCH_TV],[90,A.SNACK_TIME],[120,A.FIREPLACE_CHAT]],
  2:[[0,A.ARRIVING],[10,A.SWITCH_COOP],[90,A.SNACK_TIME],[120,A.SWITCH_COOP]],3:[[0,A.ARRIVING],[10,A.FIREPLACE_CHAT],[90,A.QUIET_READING],[150,A.FIREPLACE_CHAT]],
  4:[[0,A.ARRIVING],[10,A.SNACK_TIME],[45,A.WATCH_TV],[105,A.IDLE_TOGETHER]],5:[[0,A.ARRIVING],[10,A.SWITCH_COOP],[90,A.SNACK_TIME],[120,A.WATCH_TV],[195,A.FIREPLACE_CHAT]],
  6:[[0,A.ARRIVING],[10,A.SWITCH_COOP],[70,A.SNACK_TIME],[105,A.WATCH_TV],[175,A.FIREPLACE_CHAT],[235,A.QUIET_READING]]
});
// Minute offsets from bedtime. Thursday's kiss lasts exactly ten seconds.
const BEDTIME_ROTATION=Object.freeze({
  0:[[-35,A.BED_PREP],[-30,A.BED_CHAT],[-20,A.CUDDLE],[-5,A.SETTLING_TO_SLEEP]],1:[[-30,A.BED_PREP],[-20,A.BED_CHAT],[-5,A.SETTLING_TO_SLEEP]],
  2:[[-30,A.BED_PREP],[-20,A.CUDDLE],[-5,A.SETTLING_TO_SLEEP]],3:[[-30,A.BED_PREP],[-20,A.SETTLING_TO_SLEEP]],
  4:[[-30,A.BED_PREP],[-20,A.BED_CHAT],[-10,A.KISS_GOODNIGHT],[-9.833333,A.SETTLING_TO_SLEEP]],
  5:[[-40,A.BED_PREP],[-30,A.CUDDLE],[-20,A.UNDER_BLANKET_INTIMACY],[-5,A.SETTLING_TO_SLEEP]],
  6:[[-35,A.BED_PREP],[-30,A.BED_CHAT],[-20,A.UNDER_BLANKET_INTIMACY],[-10,A.CUDDLE]]
});
const anchors=Object.fromEntries(ANCHORS.map(a=>[a.id,a])),at=id=>anchors[id];
const DOW=t=>new Date(Date.UTC(t.year,t.month-1,t.day)).getUTCDay();
const ROUTE=Object.freeze([[156,346],[176,346],[202,293],[176,248],[202,195],[176,150],[132,150]]);
function routePoint(progress,reverse=false){const q=reverse?1-progress:progress,p=Math.max(0,Math.min(.999999,q))*(ROUTE.length-1),i=Math.floor(p),f=p-i,a=ROUTE[i],b=ROUTE[i+1];return{id:'VISIT_ROUTE',room:'route',x:a[0]+(b[0]-a[0])*f,y:a[1]+(b[1]-a[1])*f};}
function activityState(activity,elapsedSeconds=0,remainingSeconds=0){
  const common={activity,label:LABELS[activity],controlsMain:true};
  if(activity===A.ARRIVING)return{...common,male:at('TOP_LEISURE_LEFT'),girlfriend:routePoint(Math.min(1,elapsedSeconds/120)),malePose:'coupleIdle',girlfriendPose:'walk'};
  if(activity===A.SWITCH_COOP)return{...common,male:at('TV_SEAT_LEFT'),girlfriend:at('TV_SEAT_RIGHT'),malePose:'coupleGame',girlfriendPose:'game'};
  if(activity===A.WATCH_TV)return{...common,male:at('TV_SEAT_LEFT'),girlfriend:at('TV_SEAT_RIGHT'),malePose:'coupleSit',girlfriendPose:'relaxed'};
  if(activity===A.FIREPLACE_CHAT)return{...common,male:at('FIREPLACE_SEAT_LEFT'),girlfriend:at('FIREPLACE_SEAT_RIGHT'),malePose:'coupleSit',girlfriendPose:'chat'};
  if(activity===A.SNACK_TIME)return{...common,male:at('TOP_LEISURE_LEFT'),girlfriend:at('TOP_LEISURE_RIGHT'),malePose:'coupleSnack',girlfriendPose:'snack'};
  if(activity===A.QUIET_READING)return{...common,male:at('TOP_LEISURE_LEFT'),girlfriend:at('TOP_LEISURE_RIGHT'),malePose:'coupleRead',girlfriendPose:'read'};
  if(activity===A.IDLE_TOGETHER)return{...common,male:at('TOP_LEISURE_LEFT'),girlfriend:at('TOP_LEISURE_RIGHT'),malePose:'coupleIdle',girlfriendPose:'relaxed'};
  if(activity===A.BED_PREP)return{...common,male:at('BED_EDGE_LEFT'),girlfriend:at('BED_EDGE_RIGHT'),malePose:'coupleIdle',girlfriendPose:'relaxed'};
  if(activity===A.DEPARTING)return{...common,controlsMain:false,male:null,girlfriend:routePoint(Math.min(1,Math.max(0,1-remainingSeconds/300)),true),malePose:null,girlfriendPose:'walk'};
  return{...common,male:at('BED_LEFT'),girlfriend:at('BED_RIGHT'),malePose:'bed',girlfriendPose:'bed'};
}
function bedPresentation(activity){
  if(activity===A.BED_CHAT||activity===A.KISS_GOODNIGHT)return{bedState:B.OCCUPIED_CHAT,lightState:L.WARM_BEDSIDE};
  if(activity===A.CUDDLE)return{bedState:B.OCCUPIED_CUDDLE,lightState:L.WARM_BEDSIDE};
  if(activity===A.UNDER_BLANKET_INTIMACY)return{bedState:B.OCCUPIED_INTIMATE,lightState:L.DIM};
  if(activity===A.SETTLING_TO_SLEEP)return{bedState:B.OCCUPIED_CUDDLE,lightState:L.DIM};
  if(activity===A.SLEEP_TOGETHER)return{bedState:B.OCCUPIED_SLEEP,lightState:L.SLEEP};
  if(activity===A.WAKE_TOGETHER)return{bedState:B.OCCUPIED_WAKE,lightState:L.MORNING};
  if(activity===A.BED_PREP)return{bedState:B.READY_NIGHT,lightState:L.WARM_BEDSIDE};
  return{bedState:B.READY_NIGHT,lightState:L.EVENING};
}
function saturdayLeisure(t){const plan=LEISURE[6].map(block=>[...block]);if(dayNumber(t)%2){plan[3][1]=A.FIREPLACE_CHAT;plan[4][1]=A.WATCH_TV;}return plan;}
function resolveOwner(t,ownerDow,secondsFromOwnerStart){
  const visit=VISIT_WINDOWS[ownerDow],start=visit.start*60,end=visit.end*60,bedtime=BEDTIMES[ownerDow]*60,nextDow=(ownerDow+1)%7,wake=86400+WAKE_MINUTES[nextDow]*60,departure=86400+DEPARTURE_MINUTES[nextDow]*60;
  if(secondsFromOwnerStart<start||secondsFromOwnerStart>=departure)return null;
  let presence=GIRLFRIEND_PRESENCE.VISITING,activity,elapsed=0;
  if(secondsFromOwnerStart<end){const offset=(secondsFromOwnerStart-start)/60,plan=ownerDow===6?saturdayLeisure(t):LEISURE[ownerDow],selected=plan.filter(([at])=>offset>=at).at(-1)||plan[0];activity=selected[1];elapsed=secondsFromOwnerStart-(start+selected[0]*60);}
  else if(secondsFromOwnerStart<(BEDTIMES[ownerDow]+BEDTIME_ROTATION[ownerDow][0][0])*60)activity=A.IDLE_TOGETHER;
  else if(secondsFromOwnerStart<bedtime){presence=GIRLFRIEND_PRESENCE.STAYING_OVERNIGHT;activity=BEDTIME_ROTATION[ownerDow].filter(([offset])=>secondsFromOwnerStart>=bedtime+offset*60).at(-1)?.[1]||A.BED_PREP;}
  else if(secondsFromOwnerStart<wake){presence=GIRLFRIEND_PRESENCE.STAYING_OVERNIGHT;activity=A.SLEEP_TOGETHER;}
  else if(secondsFromOwnerStart<wake+300){presence=GIRLFRIEND_PRESENCE.STAYING_OVERNIGHT;activity=A.WAKE_TOGETHER;}
  else{presence=GIRLFRIEND_PRESENCE.STAYING_OVERNIGHT;activity=A.DEPARTING;}
  const remaining=departure-secondsFromOwnerStart,placement=activityState(activity,elapsed,remaining),presentation=bedPresentation(activity),tvMode=activity===A.SWITCH_COOP?'game':activity===A.WATCH_TV?'movie':'off',fireplaceState=activity===A.FIREPLACE_CHAT?'on':secondsFromOwnerStart>=end&&secondsFromOwnerStart<bedtime?'embers':'off';
  return Object.freeze({presence,...placement,...presentation,tvMode,fireplaceState,fireplaceOn:fireplaceState==='on',bedroom:Object.freeze({...presentation}),topFloor:Object.freeze({tvState:tvMode,fireplaceState}),window:visit,bedtime:BEDTIMES[ownerDow],wake:WAKE_MINUTES[nextDow],departure:DEPARTURE_MINUTES[nextDow],ownerDow});
}
export function resolveCoupleState(t=now()){
  const dow=DOW(t),seconds=minuteOfDay(t)*60+(t.sec||0),previous=resolveOwner(t,(dow+6)%7,seconds+86400);if(previous)return previous;
  const current=resolveOwner(t,dow,seconds);if(current)return current;
  return Object.freeze({presence:GIRLFRIEND_PRESENCE.AWAY,activity:null,label:'',controlsMain:false,tvMode:'off',fireplaceState:'off',fireplaceOn:false,bedState:B.EMPTY_DAY,lightState:L.DAY,bedroom:Object.freeze({bedState:B.EMPTY_DAY,lightState:L.DAY}),topFloor:Object.freeze({tvState:'off',fireplaceState:'off'}),girlfriend:null,male:null,window:VISIT_WINDOWS[dow]});
}
