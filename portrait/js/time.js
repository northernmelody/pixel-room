import { beijingNow } from './store.js';

// Dev hooks: ?t=HH:MM[:SS] pins the simulated clock, ?d=YYYY-MM-DD pins the Beijing date.
// Both are inert without the query parameter and never touch the real clock elsewhere.
const query=new URLSearchParams(globalThis.location?.search||''),override=query.get('t'),startedAt=Date.now();let startSeconds=null;
if(/^\d{1,2}:\d{2}(:\d{2})?$/.test(override||'')){const [h,m,s=0]=override.split(':').map(Number);if(h<24&&m<60&&s<60)startSeconds=h*3600+m*60+s;}
const fixedDate=/^(\d{4})-(\d{2})-(\d{2})$/.exec(query.get('d')||'');
export function now(){const real=beijingNow(),base=fixedDate?{...real,year:+fixedDate[1],month:+fixedDate[2],day:+fixedDate[3]}:real;if(startSeconds===null)return base;const elapsed=Math.floor((Date.now()-startedAt)/1000),seconds=(startSeconds+elapsed)%86400;return {...base,hour:Math.floor(seconds/3600),min:Math.floor(seconds%3600/60),sec:seconds%60,simulated:true};}
export function minuteOfDay(value=now()){return value.hour*60+value.min;}
export function dayNumber(value=now()){return Math.floor(Date.UTC(value.year,value.month-1,value.day)/86400000);}
