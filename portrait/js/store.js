import { CONFIG, SEASONS } from './config.js';

export function beijingNow(date=new Date()) {
  const d=new Date(date.getTime()+480*60000);
  return {year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),weekday:d.getUTCDay(),hour:d.getUTCHours(),min:d.getUTCMinutes(),sec:d.getUTCSeconds(),date:d};
}
export function seasonFor(month){return month>=3&&month<=5?'spring':month>=6&&month<=8?'summer':month>=9&&month<=11?'autumn':'winter';}
function defaults(){return {v:2,theme:'auto',season:'auto',lampMode:'auto',lamps:[false,true,true,true,true,true],showCollectibles:false,sound:true,volume:60,particles:true,stars:true,detail:true};}
export function resolvePreferences(state,now=beijingNow()){
  const theme=state.theme==='auto'?(now.hour>=7&&now.hour<19?'day':'night'):state.theme,lamps=state.lampMode==='auto'?(theme==='day'?[false,false,false,false,false,false]:now.hour>=23||now.hour<7?[false,false,false,false,false,true]:[false,true,true,true,true,true]):state.lamps;
  return {...state,theme,lamps,season:state.season==='auto'?seasonFor(now.month):state.season};
}
export function loadPreferences(){
  const state=defaults();
  try{
    const saved=JSON.parse(localStorage.getItem(CONFIG.storageKey)||'null');
    if(saved?.v===1||saved?.v===2){
      if(['auto','day','night'].includes(saved.theme))state.theme=saved.theme;
      if(['auto','manual'].includes(saved.lampMode))state.lampMode=saved.lampMode;
      if(saved.season==='auto'||Object.hasOwn(SEASONS,saved.season))state.season=saved.season;
      if(Array.isArray(saved.lamps)&&saved.lamps.length===6&&saved.lamps.every(x=>typeof x==='boolean'))state.lamps=saved.lamps;
      for(const key of ['showCollectibles','sound','particles','stars','detail'])if(typeof saved[key]==='boolean')state[key]=saved[key];
      if(Number.isFinite(saved.volume))state.volume=Math.max(0,Math.min(100,Math.round(saved.volume)));
    }
  }catch{}
  return state;
}
export function savePreferences(state){try{localStorage.setItem(CONFIG.storageKey,JSON.stringify({...state,v:2}));return true;}catch{return false;}}
export function resetPreferences(){try{localStorage.removeItem(CONFIG.storageKey);}catch{}return defaults();}

function worldDefaults(){const n=beijingNow();return {v:1,date:`${n.year}-${n.month}-${n.day}`,bowls:{cat:3,dog:3},collectibles:[],pkg:{state:'none',days:0,item:''},outfit:0,petToday:0,petTotal:0,completedMeals:0,lastMeal:'',lastSeen:Date.now()};}
export function loadWorld(){const base=worldDefaults();try{const saved=JSON.parse(localStorage.getItem(CONFIG.worldStorageKey)||'null');if(saved?.v===1)Object.assign(base,saved,{bowls:{...base.bowls,...saved.bowls},pkg:{...base.pkg,...saved.pkg}});}catch{}advanceWorld(base);return base;}
export function saveWorld(world){world.lastSeen=Date.now();try{localStorage.setItem(CONFIG.worldStorageKey,JSON.stringify(world));return true;}catch{return false;}}
export function resetWorld(){try{localStorage.removeItem(CONFIG.worldStorageKey);localStorage.removeItem(CONFIG.actorStorageKey);localStorage.removeItem(CONFIG.lifeStorageKey);return true;}catch{return false;}}
function hash(text){let h=2166136261;for(const ch of text)h=Math.imul(h^ch.charCodeAt(0),16777619);return h>>>0;}
export function advanceWorld(world){
  const n=beijingNow(),today=`${n.year}-${n.month}-${n.day}`;if(world.date===today)return world;
  world.date=today;world.bowls={cat:3,dog:3};world.petToday=0;
  if(world.pkg.state==='arrived'){world.pkg.days=(world.pkg.days||0)+1;if(world.pkg.days>=1+(hash(today)%3)){const all=['figurine','mug','painting','plant','vase'],missing=all.filter(x=>!world.collectibles.includes(x)),item=missing[hash(today+'pkg')%Math.max(1,missing.length)]||all[hash(today)%all.length];if(!world.collectibles.includes(item))world.collectibles.push(item);world.pkg={state:'none',days:0,item};}}
  else if(hash(today)%100<29)world.pkg={state:'arrived',days:0,item:''};
  saveWorld(world);return world;
}
