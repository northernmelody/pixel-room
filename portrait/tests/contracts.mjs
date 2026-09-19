import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { CONFIG, ROOMS, PORTALS, GARDEN } from '../js/config.js';
import { ITEMS, LAMPS, ANCHORS, getVisibleItems } from '../js/layout.js';
import { ITEM_IDS, ITEM_META, drawItem, resolveItemVariant } from '../js/art/index.js';
import { SPRITES } from '../js/art/sprites.generated.js';
import { STORY, SONGS } from '../js/content/index.js';
import { loadPreferences, savePreferences, resetPreferences } from '../js/store.js';
import { hitTest, drawScene, propContents, PROP_BOX, PROP_PALETTES, GARDEN_TOYS, GARDEN_FLOWER_BEDS } from '../js/scene.js';
import { NavigationController, NAVIGATION_GEOMETRY } from '../js/navigation.js';
import { LifeDirector } from '../js/life.js';
import { PetWorld } from '../js/pets.js';
import { loadWorld, saveWorld, advanceWorld, resolvePreferences, resetWorld } from '../js/store.js';
import { parseLetterFile, saveLetterOverride, loadLetterOverrides, clearLetterOverrides } from '../js/letters.js';
import { AudioSystem } from '../js/audio.js';
import { Environment } from '../js/environment.js';

assert.equal(CONFIG.width,216);assert.equal(CONFIG.height,450);
assert.equal(new Set(ITEMS.map(i => i.id)).size, ITEMS.length);
assert.deepEqual(new Set(ITEMS.map(i => i.art)), new Set(ITEM_IDS), 'Every extracted original object has a placement');
assert.equal(ITEMS.filter(i => i.art.startsWith('window-')).length, 4);
assert.equal(LAMPS.length, 6);
assert.equal(ITEMS.filter(i => ['human','cat','dog'].includes(i.art)).length, 3);
for (const item of ITEMS) {
  const room = ROOMS.find(r => r.id === item.room), meta = ITEM_META[item.art];
  assert.ok(room && meta, item.id);
  assert.ok(item.x >= room.x && item.x + meta.width <= room.x + room.w, `${item.id} horizontal bounds`);
  assert.ok(item.y >= room.y && item.y + meta.height <= room.base + 5, `${item.id} vertical bounds`);
}
for (const anchor of ANCHORS) {
  const room = ROOMS.find(r => r.id === anchor.room);
  assert.ok(anchor.x >= room.x && anchor.x <= room.x + room.w, anchor.id);
  assert.equal(anchor.y, room.base, anchor.id);
}
assert.ok(PORTALS.every(p => p.x >= 0 && p.x < CONFIG.width && p.y < CONFIG.height));

const sandbox = { window: { PixelRoom: {} } };
vm.createContext(sandbox);
for (const name of ['storyData.js','songs.js']) vm.runInContext(fs.readFileSync(new URL('../../js/' + name, import.meta.url),'utf8'),sandbox);
assert.equal(JSON.stringify(STORY),JSON.stringify(sandbox.window.PixelRoom.StoryData),'Original narrative content unchanged');
assert.equal(JSON.stringify(SONGS),JSON.stringify(sandbox.window.PixelRoom.Songs),'Original songs unchanged');
assert.equal(STORY.calls.length,100);
assert.equal(Object.keys(STORY.letters).length,2);
assert.equal(SONGS.length,3);

const data = new Map([['pixel-room-save-v1','legacy-sentinel']]);
const accessed = [];
globalThis.localStorage = {
  getItem(key){accessed.push(key);return data.get(key) ?? null;},
  setItem(key,value){accessed.push(key);data.set(key,value);},
  removeItem(key){accessed.push(key);data.delete(key);}
};
const prefs = { ...loadPreferences(), theme:'night', season:'winter', lamps:[false,true,false,true,false,true], showCollectibles:true };
assert.equal(savePreferences(prefs),true);
assert.deepEqual(loadPreferences(),prefs);
resetPreferences();
assert.equal(data.get('pixel-room-save-v1'),'legacy-sentinel');
assert.ok(accessed.every(key => key === CONFIG.storageKey),'Never touch another storage key');
data.set(CONFIG.storageKey,'{invalid');
assert.equal(loadPreferences().lamps.length,6);
globalThis.localStorage = { getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');} };
assert.equal(savePreferences(prefs),false);
assert.equal(loadPreferences().v,2);
assert.equal(resetPreferences().v,2);

// Exercise real drawing branches and canvas coordinates with a finite-number guard.
const finite = (...args) => args.forEach(value => assert.ok(Number.isFinite(value),'Invalid canvas coordinate'));
const noop = () => {};
const gradient = () => ({addColorStop:noop});
const ctx = {globalAlpha:1,save:noop,restore:noop,translate:finite,scale:finite,fillRect:finite,strokeRect:finite,setTransform:finite,rect:finite,moveTo:finite,lineTo:finite,beginPath:noop,closePath:noop,fill:noop,clip:noop,setLineDash:noop,createLinearGradient:gradient,createRadialGradient:gradient,fillText:noop};
for (const season of ['spring','summer','autumn','winter']) for (const theme of ['day','night']) {
  const state = {...prefs,season,theme};
  for (const id of ITEM_IDS) drawItem(ctx,id,0,0,{season,night:theme==='night',lampOn:true});
  // Every actor pose variant renders, and all variants share one union box plus a finite anchor.
  for (const reaction of ['stand','wave0','wave1','wave2','nod0','nod1','startle','lookback','lookup']) drawItem(ctx,'human',0,0,{reaction});
  drawItem(ctx,'human',0,0,{shower:true});
  for (const mood of ['idle','pet1','pet2','pet3','pet4','walkaway']) drawItem(ctx,'cat',0,0,{mood});
  for (const mood of ['sit','bark']) drawItem(ctx,'dog',0,0,{mood});
  drawScene({getContext:()=>ctx},state,{actor:{x:153,y:150,direction:1,walking:false,step:0}});
  assert.ok(getVisibleItems(state).every(i => !i.season || i.season === season));
  const lamp=LAMPS[0]; assert.equal(hitTest(lamp.x,lamp.y,state).id,lamp.id);
  assert.equal(hitTest(0,0,state),null);
}
for(const [id,options,expected] of [
  ['human',{shower:true},'human:shower'],
  ['human',{reaction:'wave0'},'human:wave0'],
  ['human',{},'human:stand'],
  ['cat',{mood:'pet3'},'cat:pet3'],
  ['cat',{},'cat:idle'],
  ['dog',{mood:'bark'},'dog:bark'],
  ['dog',{},'dog:sit']
]) assert.equal(resolveItemVariant(id,options),expected,id+' '+JSON.stringify(options)+' selects its variant');
assert.throws(()=>resolveItemVariant('teapot',{}),/Unknown Pixel Room item id/);

const ACTOR_VARIANTS={
  human:['human:stand','human:wave0','human:wave1','human:wave2','human:nod0','human:nod1','human:startle','human:lookback','human:lookup','human:shower'],
  cat:['cat:idle','cat:pet1','cat:pet2','cat:pet3','cat:pet4','cat:walkaway'],
  dog:['dog:sit','dog:bark']
};
for(const [actor,variants] of Object.entries(ACTOR_VARIANTS)){
  const meta=ITEM_META[actor];
  assert.ok(Number.isFinite(meta.anchorX)&&Number.isFinite(meta.anchorY),actor+' anchor is finite');
  const sizes=new Set(variants.map(key=>SPRITES[key].width+'x'+SPRITES[key].height));
  assert.equal(sizes.size,1,actor+' variants share one bounding box, got '+[...sizes].join(' / '));
  assert.equal(new Set(variants.map(key=>SPRITES[key].anchorX+','+SPRITES[key].anchorY)).size,1,actor+' variants share one anchor');
}
assert.ok(!getVisibleItems({...prefs,showCollectibles:false}).some(i=>i.collectible));

// Click scope: only the horizontal-build interactions are targets; everything else is inert.
const HIT_STATE={...prefs,season:'winter',showCollectibles:true};
const rectOf=(item)=>{const m=ITEM_META[item.art];return{x0:item.x,x1:item.x+m.width,y0:item.y,y1:item.y+m.height};};
const inside=(r,x,y)=>x>=r.x0-1&&x<=r.x1+1&&y>=r.y0-1&&y<=r.y1+1;
const actionIn=(id)=>{const item=ITEMS.find(i=>i.id===id),r=rectOf(item),found=new Set();for(let x=r.x0;x<=r.x1;x++)for(let y=r.y0;y<=r.y1;y++){const hit=hitTest(x,y,HIT_STATE,{});if(hit?.action)found.add(hit.action);}return found;};
const ACTIONS=new Set(['computer','letters','guitar','wardrobe','fridge','name','meal','door']);
assert.deepEqual(new Set(ITEMS.filter(i=>i.action).map(i=>i.action)),ACTIONS,'Only classic-equivalent click actions exist');
assert.equal(ITEMS.filter(i=>i.action).length,16,'Clickable object count stays bounded');
for(const [id,action] of [['bedroom.wardrobe','wardrobe'],['bedroom.guitar','guitar'],['bedroom.bed','name'],['bedroom.boba','name'],['bedroom.avocado','name'],['bedroom.bunny','name'],['bedroom.orange','name'],['bedroom.octopus','name'],['bedroom.ramen','name'],['workspace.bookshelf','letters'],['workspace.desk','computer'],['kitchen.fridge','fridge'],['kitchen.cabinets','meal'],['kitchen.counter','meal'],['kitchen.table','meal'],['kitchen.door','door']]){
  assert.ok(actionIn(id).has(action),id+' exposes '+action);
}
// Decorations may sit under a switchable lamp, but they must not open anything themselves.
const actionableRects=ITEMS.filter(i=>i.action).map(rectOf);let inertPixels=0;
for(const item of ITEMS.filter(i=>!i.action)){
  const r=rectOf(item);
  for(let x=r.x0;x<=r.x1;x++)for(let y=r.y0;y<=r.y1;y++){
    if(actionableRects.some(other=>inside(other,x,y)))continue;
    const hit=hitTest(x,y,HIT_STATE,{});
    assert.ok(hit===null||hit.type==='lamp',`${item.id} at ${x},${y} is inert, got ${hit?.id||hit?.type}`);
    inertPixels++;
  }
}
assert.ok(inertPixels>1000,'Decoration pixels are actually sampled');
assert.equal(hitTest(GARDEN.swingX,GARDEN.swingY,HIT_STATE,{}),null,'The swing is scenery, not a click target');
assert.equal(hitTest(0,0,HIT_STATE,{}),null);


// S6: real controllers, deterministic Beijing dates, no manual task API.
const RealDate=Date;let clock=RealDate.parse('2026-09-17T11:00:00Z');
globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}};
const at=(time,date='2026-09-17')=>{clock=RealDate.parse(`${date}T${time}+08:00`);};
accessed.length=0;
globalThis.localStorage={getItem(key){accessed.push(key);return data.get(key)??null;},setItem(key,value){accessed.push(key);data.set(key,value);},removeItem(key){accessed.push(key);data.delete(key);}};
const world=loadWorld();
const makeNav=()=>new NavigationController(()=>{},{storageKey:null,x:153,y:150});
function step(nav,life,seconds){for(let i=0;i<seconds*20;i++){nav.update(.05);life.update(.05);}}
function stable(life,nav){return JSON.stringify({activity:life.activity,schedule:life.schedule,index:life.index,timer:life.timer,steps:life.steps,pose:life.pose,held:life.held,nav:nav.snapshot()});}
const boundaries=[['07:19:55','07:20:00','sleep','wakeUp'],['07:34:55','07:35:00','wakeUp','dress'],['07:44:55','07:45:00','dress','morning'],['08:04:55','08:05:00','morning','breakfast'],['08:34:55','08:35:00','breakfast','swing'],['08:59:55','09:00:00','morningBuffer','work'],['11:59:55','12:00:00','work','lunch'],['12:59:55','13:00:00','lunch','work'],['17:59:55','18:00:00','work','dinner'],['18:59:55','19:00:00','dinner','game']];
for(const [before,after,old,next] of boundaries){at(before);const nav=makeNav(),life=new LifeDirector(nav,world);assert.equal(life.schedule,old);step(nav,life,4);at(after);life.update(.05);assert.equal(life.schedule,next,after);assert.equal(life.held,'','No held prop leaked across schedule');step(nav,life,30);assert.ok(!nav.walking,'Scheduled destination reachable');}
for(const [time,kind,pose] of [['07:45:00','morning','brush'],['08:05:00','breakfast','eat'],['12:00:00','lunch','eat'],['18:00:00','dinner','eat'],['19:00:00','game','game']]){at(time);const nav=makeNav(),life=new LifeDirector(nav,world),seen=new Set();for(let i=0;i<1600;i++){seen.add(life.pose);const prior=stable(life,nav);life.react();assert.equal(stable(life,nav),prior,'Human click never changes route, pose, step or timer');nav.update(.05);life.update(.05);}assert.ok(seen.has(pose),kind);if(pose==='eat')for(const p of ['fridge','cook','eat'])assert.ok(seen.has(p));if(kind==='morning')for(const p of ['toilet','flush','washHands','brush'])assert.ok(seen.has(p));}
at('08:05:00');{const nav=makeNav(),life=new LifeDirector(nav,world),count=world.completedMeals;step(nav,life,200);assert.equal(world.completedMeals,count+1,'Breakfast completion must occur within its half-hour window');step(nav,life,600);assert.equal(world.completedMeals,count+1,'Do not cook the same meal repeatedly');assert.equal(life.held,'');}
// Day profiles are date-derived and stable for repeated resolution.
for(const [date,time,expected] of [['2026-09-14','20:00:00','playCat'],['2026-09-15','20:00:00','exercise'],['2026-09-16','20:00:00','read'],['2026-09-18','22:30:00','phone'],['2026-09-19','09:00:00','morning'],['2026-09-20','22:50:00','shower']]){at(time,date);const first=new LifeDirector(makeNav(),world).schedule;const second=new LifeDirector(makeNav(),world).schedule;assert.equal(first,expected,date+' profile');assert.equal(second,first,'Profile is deterministic');}
// Full leisure loops and forced schedule interruption use the real state machine.
at('19:00:00');
for(const activity of ['game','read','exercise','playCat','lookOut','phone','snack','change','guitar','swing']){const nav=makeNav(),life=new LifeDirector(nav,world);life.setPlan(activity);let seen=new Set(),visited=[];for(let i=0;i<9000&&life.activity===activity;i++){seen.add(life.pose);visited.push([nav.x,nav.y]);nav.update(.05);life.update(.05);}assert.ok(seen.size>=2,activity);if(activity==='swing'){assert.ok(visited.some(([x,y])=>x===156&&y>346&&y<GARDEN.pathY),'Use the garden gate');assert.ok(visited.some(([x,y])=>x===GARDEN.swingX&&y===GARDEN.swingY),'Reach the swing');}life.setPlan(activity);step(nav,life,25);at('21:30:00');life.update(.05);assert.equal(life.schedule,'read');assert.equal(life.song,null);assert.equal(life.held,'');at('19:00:00');}
// Three songs: every lyric is addressed and the guitar is returned.
const songsSeen=new Set();for(const t of ['19:00:00','19:10:00','19:20:00']){at(t);const nav=makeNav(),life=new LifeDirector(nav,world);life.setPlan('guitar');const song=life.song;songsSeen.add(song.title);const lines=new Set();for(let i=0;i<9000&&life.activity==='guitar';i++){if(life.snapshot().lyric)lines.add(life.snapshot().lyric);nav.update(.05);life.update(.05);}assert.deepEqual(lines,new Set(song.lyrics));assert.notEqual(life.held,'guitar');}assert.equal(songsSeen.size,3);
const calls=new Set();for(let i=0;i<100;i++){for(let minute=19*60;minute<24*60;minute+=5){const h=String(Math.floor(minute/60)%24).padStart(2,'0'),m=String(minute%60).padStart(2,'0');clock=RealDate.parse(`2026-09-17T${h}:${m}:00+08:00`)+i*86400000;const life=new LifeDirector(makeNav(),world);if(life.snapshot().call){calls.add(life.snapshot().call.title);assert.equal(life.snapshot().call.lines.length,12);}}}assert.ok(calls.size>=10,'Deterministic profile calls remain available');
at('19:00:00');const petWorld=new PetWorld(world);for(const pet of [petWorld.cat,petWorld.dog])for(const state of Object.keys(pet.labels)){pet.go(0,100,state,10);for(let i=0;i<500;i++){const before=JSON.stringify({nav:pet.nav.snapshot(),state:pet.state,timer:pet.timer,high:pet.high});pet.react();assert.equal(JSON.stringify({nav:pet.nav.snapshot(),state:pet.state,timer:pet.timer,high:pet.high}),before,'Pet clicks do not intervene');pet.update(.05,{floor:0,x:110},{activity:'read'});}assert.ok(Number.isFinite(pet.nav.x));}
// Horizontal-build pet interactions: cat touch chain, dog bark then follow, lamp fright.
at('19:00:00');
{
  const touched=new PetWorld(world);
  assert.equal(touched.cat.pet(),'pet');assert.equal(touched.cat.pet(),'pet');assert.equal(touched.cat.pet(),'flop');
  assert.equal(touched.cat.pet(),'walkaway','The fourth touch sends the cat away');
  assert.equal(touched.cat.pet(),'pet','A new chain starts after the cat walks away');
  clock+=4000;assert.equal(touched.cat.pet(),'pet','The chain timer resets after three seconds');
  const target={floor:0,x:110};
  assert.equal(touched.dog.greet(target),'bark');assert.equal(touched.dog.greet(target),'follow','A second touch within four seconds follows');
  assert.equal(touched.dog.state,'follow');assert.equal(touched.frighten(),true);assert.equal(touched.cat.state,'underbed');assert.equal(touched.cat.high,false);
}
// Manual guitar keeps the horizontal refusal rules; washing and showering are off limits too.
at('20:00:00');{const nav2=makeNav(),life2=new LifeDirector(nav2,world);assert.equal(life2.schedule,'playCat');assert.equal(life2.startGuitar(),'ok');assert.equal(life2.activity,'guitar');assert.equal(life2.startGuitar(),'busy');assert.equal(life2.schedule,'playCat','Manual guitar does not hijack the timetable');}
at('15:00:00');{const life2=new LifeDirector(makeNav(),world);assert.equal(life2.startGuitar(),'ok','Work can be interrupted by a song');}
at('08:00:00');{const life2=new LifeDirector(makeNav(),world);assert.equal(life2.schedule,'morning');assert.equal(life2.startGuitar(),'wash','The morning wash cannot be interrupted');}
at('22:10:00');{const life2=new LifeDirector(makeNav(),world);assert.equal(life2.schedule,'shower');assert.equal(life2.startGuitar(),'wash','The shower cannot be interrupted');}
at('03:00:00');{const life2=new LifeDirector(makeNav(),world);life2.setPlan('sleep');assert.equal(life2.startGuitar(),'sleep');}
at('21:00:00','2026-09-14');{const nav2=makeNav(),life2=new LifeDirector(nav2,world);assert.equal(life2.schedule,'call');assert.equal(life2.startGuitar(),'call');step(nav2,life2,10);assert.equal(nav2.walking,false);assert.equal(life2.pose,'call');assert.equal(life2.snapshot().callLine,life2.snapshot().call.lines[0]);step(nav2,life2,155);assert.equal(life2.snapshot().callLine,life2.snapshot().call.lines[1],'Call line advances every 150 seconds');}
// Click responses are posture animations, and sleeping or showering residents stay quiet.
at('15:00:00');{const life2=new LifeDirector(makeNav(),world);const type=life2.react();assert.ok(['wave','nod','startle','lookback'].includes(type),'Human click picks a horizontal posture');assert.equal(life2.snapshot().reaction,type);assert.equal(life2.react('lookup'),'lookup');life2.reaction=null;life2.pose='sleep';assert.equal(life2.react(),'','Sleeping residents do not react');assert.equal(life2.snapshot().reaction,'');life2.pose='shower';assert.equal(life2.react(),'','Showering residents do not react');assert.equal(life2.snapshot().reaction,'');}
// Wardrobe and fridge open onto random pixel contents.
for(const kind of ['wardrobe','fridge']){
  const first=propContents(kind,7),second=propContents(kind,7),other=propContents(kind,8),box=PROP_BOX[kind],palette=PROP_PALETTES[kind];
  assert.ok(first.length>=2,kind+' shows contents');
  assert.deepEqual(first,second,kind+' contents are deterministic per seed');
  assert.notDeepEqual(first,other,kind+' contents vary with the seed');
  for(const item of first){
    assert.ok(palette.includes(item.color),kind+' uses its own palette');
    assert.ok(item.w>=2&&item.h>=2,kind+' pieces stay pixel sized');
    assert.ok(item.x>=box.x&&item.y>=box.y&&item.x+item.w<=box.x+box.w&&item.y+item.h<=box.y+box.h,kind+' pieces stay inside the furniture');
  }
}
assert.throws(()=>propContents('oven',1),/Unknown prop/);

// The two garden plushies stay on clear lawn: inside the garden, off the swing,
// the stepping stones and the flower beds.
const overlaps=(a,b)=>a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
const RESERVED=[
  {id:'swing frame',x:GARDEN.swingX-29,y:GARDEN.swingY-40,w:60,h:44},
  {id:'door steps',x:150,y:369,w:15,h:69},
  {id:'walkway steps',x:91,y:417,w:59,h:5},
  ...GARDEN_FLOWER_BEDS.map(([x,y,w])=>({id:'flower bed at '+x+','+y,x,y,w,h:17}))
];
assert.equal(new Set(GARDEN_TOYS.map(toy=>toy.id)).size,GARDEN_TOYS.length,'Toy ids are unique');
for(const toy of GARDEN_TOYS){
  assert.ok(toy.x>=4&&toy.x+toy.w<=212,toy.id+' stays on the lawn horizontally');
  assert.ok(toy.y>=GARDEN.groundY&&toy.y+toy.h<=441,toy.id+' sits on the lawn above the fence');
  for(const zone of RESERVED)assert.ok(!overlaps(toy,zone),'The '+toy.id+' clears the '+zone.id);
}
// Navigation continuity through both staircases and the garden, including return.
const nav=makeNav();for(const [x,y] of [[GARDEN.swingX,GARDEN.swingY],[70,150],[60,248],[100,346]]){nav.moveToPoint(x,y);for(let i=0;i<800&&nav.walking;i++){const before=nav.snapshot();nav.update(.05);assert.ok(Math.hypot(nav.x-before.x,nav.y-before.y)<=2.101);}assert.equal(nav.walking,false);assert.equal(nav.x,x);assert.equal(nav.y,y);}assert.equal(NAVIGATION_GEOMETRY.edges.length,15);
// The visible high cat must receive the click, without a ghost hit at its old floor.
const highCat={x:28,y:150,high:true,state:'perch',kind:'cat',walking:false};assert.equal(hitTest(28,108,prefs,{pets:{cat:highCat}})?.entity,'cat');assert.notEqual(hitTest(28,147,prefs,{pets:{cat:highCat}})?.entity,'cat');
for(const hour of [8,20,23]){const p=resolvePreferences({...prefs,theme:'auto',lampMode:'auto'},{hour,month:9});assert.deepEqual(p.lamps,hour===8?Array(6).fill(false):hour===20?[false,true,true,true,true,true]:[false,false,false,false,false,true]);assert.deepEqual(resolvePreferences({...prefs,lampMode:'manual'},{hour,month:9}).lamps,prefs.lamps);}
for(const [name,text] of [['letter.txt','第一段\n\n第二段'],['letter.md','# 新标题\n正文'],['letter.json',JSON.stringify({title:'标题',from:'甲',to:'乙',paragraphs:['第一段','第二段']})]]){const letter=parseLetterFile(name,text,STORY.letters.toMomo);assert.ok(letter.paragraphs.length);saveLetterOverride('toMomo',letter);assert.deepEqual(loadLetterOverrides().toMomo,letter);}
assert.throws(()=>parseLetterFile('a.txt',' ',STORY.letters.toMomo));assert.throws(()=>parseLetterFile('a.json','null',STORY.letters.toMomo));assert.throws(()=>parseLetterFile('a.txt','中'.repeat(40000),STORY.letters.toMomo),/100 KB/);clearLetterOverrides();assert.equal(loadLetterOverrides().toMomo,null);
world.date='2000-1-1';world.bowls={cat:0,dog:0};world.pkg={state:'arrived',days:3};world.petToday=8;advanceWorld(world);assert.deepEqual(world.bowls,{cat:3,dog:3});assert.equal(world.petToday,0);assert.equal(world.collectibles.length,1);const first=world.collectibles[0];assert.ok(getVisibleItems({...prefs,showCollectibles:false},world).some(i=>i.id==='collectible.'+first));saveWorld(world);assert.deepEqual(loadWorld().collectibles,world.collectibles);resetWorld();
assert.equal(ITEM_IDS.length,53);assert.equal(ROOMS.length,4);assert.equal(ITEMS.filter(i=>i.art.startsWith('plush-')).length+1,7);assert.equal(Object.values(STORY.dishes).flat().length,38);assert.equal(STORY.snacks.length,6);
assert.equal(data.get('pixel-room-save-v1'),'legacy-sentinel');assert.ok(accessed.every(k=>k.startsWith('pixel-room-portrait-')),'Only portrait storage touched');
// Rendering smoke includes every active life pose and high/under-bed pet branch.
for(const pose of ['sleep','phone','fridge','cook','eat','work','game','toilet','read','call','guitar','swing','washHands','brush','shower','exercise','wardrobe','change','door'])drawScene({getContext:()=>ctx},{...prefs,particles:true},{actor:{...nav.snapshot(),pose,motion:1,held:'phone'},life:{pose,motion:1},pets:{cat:{...highCat,motion:1,direction:1},dog:{kind:'dog',x:100,y:346,state:'sleep',motion:1}},world,weather:{kind:'storm'},time:{hour:23}});
let contexts=0,tones=0;globalThis.AudioContext=class{constructor(){contexts++;this.currentTime=0;this.destination={};}async resume(){}createOscillator(){return{type:'',frequency:{value:0},connect(node){return node;},start(){tones++;},stop(){}};}createGain(){return{gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}};
const audioPrefs={sound:false,volume:60},sound=new AudioSystem(audioPrefs);assert.equal(contexts,0);sound.interact('cat');assert.equal(tones,0);audioPrefs.sound=true;await sound.enable();assert.equal(contexts,1);sound.interact('dog');assert.ok(tones>0);audioPrefs.sound=false;const played=tones;sound.update({kind:'rain'},{hour:23},{pose:'guitar'});sound.interact('human');assert.equal(tones,played,'Mute prevents new sound nodes');delete globalThis.AudioContext;
assert.throws(()=>parseLetterFile('image.png','text',STORY.letters.toMomo),/仅支持/);assert.throws(()=>parseLetterFile('a.json','{"paragraphs":[{}]}',STORY.letters.toMomo),/字符串/);
// Weather success and rejected requests both settle to a usable state.
const realFetch=globalThis.fetch;for(const [code,kind] of [[0,'clear'],[63,'rain'],[73,'snow'],[95,'storm']]){globalThis.fetch=async()=>({ok:true,json:async()=>({current:{weather_code:code,temperature_2m:23.6,wind_speed_10m:5}})});const env=Object.create(Environment.prototype);env.lastFetch=0;await env.fetch();assert.equal(env.weather.kind,kind);assert.equal(env.weather.source,'api');assert.equal(env.weather.temperature,24);}globalThis.fetch=async()=>{throw Error('offline')};const env=Object.create(Environment.prototype);env.lastFetch=0;await env.fetch();assert.equal(env.weather.source,'fallback');globalThis.fetch=realFetch;globalThis.Date=RealDate;
console.log('PASS S6: autonomous schedule (10 boundaries), classic click scope (16 targets, decorations inert), opening wardrobe/fridge with random contents, posture click responses, pet touch chain and follow, guitar refusal rules (sleep/call/wash), call lines, all leisure states, 3 songs, 100 calls, garden routes, lamp modes and fright, letters, world/storage isolation, weather, original content and drawing.');
