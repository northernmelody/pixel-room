import { beijingNow } from './store.js';

const query=new URLSearchParams(globalThis.location?.search||''),override=query.get('t'),startedAt=Date.now();let startSeconds=null;
if(/^\d{1,2}:\d{2}(:\d{2})?$/.test(override||'')){const [h,m,s=0]=override.split(':').map(Number);if(h<24&&m<60&&s<60)startSeconds=h*3600+m*60+s;}
export function now(){const real=beijingNow();if(startSeconds===null)return real;const elapsed=Math.floor((Date.now()-startedAt)/1000),seconds=(startSeconds+elapsed)%86400;return {...real,hour:Math.floor(seconds/3600),min:Math.floor(seconds%3600/60),sec:seconds%60,simulated:true};}
export function minuteOfDay(value=now()){return value.hour*60+value.min;}
export function dayNumber(value=now()){return Math.floor(Date.UTC(value.year,value.month-1,value.day)/86400000);}
