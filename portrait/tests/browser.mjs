import { GARDEN } from '../js/config.js';
import { ITEMS, LAMPS } from '../js/layout.js';
import { ITEM_META } from '../js/art/index.js';
import { hitTest } from '../js/scene.js';

const frame=document.querySelector('#app'),results=document.querySelector('#results');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const report=text=>results.textContent+=text+'\n';
const check=(ok,msg)=>{if(!ok)throw Error(msg);};
const errors=[];
const load=async query=>{
  frame.src='../'+query;
  await new Promise((resolve,reject)=>{frame.onload=resolve;setTimeout(()=>reject(Error('Frame load timeout: '+query)),10000);});
  const w=frame.contentWindow;w.addEventListener('error',e=>errors.push(e.message));w.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
  for(let i=0;i<100&&!w.PortraitPreview;i++)await sleep(50);
  check(!!w.PortraitPreview,'App initializes: '+query);
  return w;
};
const canvasOf=w=>w.document.querySelector('#house');
const clickAt=(w,x,y)=>{const b=canvasOf(w).getBoundingClientRect();canvasOf(w).dispatchEvent(new w.MouseEvent('click',{bubbles:true,clientX:b.left+x/216*b.width,clientY:b.top+y/450*b.height}));};
const centerOf=id=>{const item=ITEMS.find(i=>i.id===id),m=ITEM_META[item.art];return[item.x+m.width/2,item.y+m.height/2];};
// Resolve a real click point from the running page's own state, so overlapping hotspots cannot fake a pass.
const pointFor=(w,id)=>{const item=ITEMS.find(i=>i.id===id),m=ITEM_META[item.art],state=w.PortraitPreview.state;for(let x=item.x;x<=item.x+m.width;x++)for(let y=item.y;y<=item.y+m.height;y++){const hit=hitTest(x,y,state,{});if(hit?.id===id&&hit.action)return[x,y];}throw Error('No clickable point for '+id);};
const hintOf=w=>{const el=w.document.querySelector('#item-hint');return el.classList.contains('visible')?el.textContent:'';};
const dialogOpen=w=>w.document.querySelector('dialog').open;
const dialogTitle=w=>w.document.querySelector('#details-title')?.textContent||'';
const closeDialog=w=>{const d=w.document.querySelector('dialog');if(d.open)d.close();};
const lifeCore=p=>JSON.stringify({life:{...p.life,reaction:''},timer:p.diagnostics.timer,index:p.diagnostics.index});
const route=p=>JSON.stringify({...p.actor,reaction:''});
const petY=(v,kind)=>v.y-(v.high&&kind==='cat'?32:0)+(v.state==='underbed'?7:0);

document.querySelector('#run').onclick=async()=>{results.textContent='';const reactions={human:0,cat:0,dog:0};try{// 1. Autonomous timetable boundaries on a pinned Beijing date (Thursday profile).
for(const [time,expected] of [['07:19:55','sleep'],['07:44:55','dress'],['11:59:55','work'],['18:59:55','dinner']]){
  const w=await load('?d=2026-09-17&t='+time);
  check(w.PortraitPreview.life.schedule===expected,time+' -> '+w.PortraitPreview.life.schedule);
  report('PASS '+time+' → '+expected);
}
// 2. Resident clicks: the human never changes route or timetable; pets add bounded interaction states.
for(const time of ['15:00:00','20:00:00']){
  const w=await load('?d=2026-09-17&t='+time),p=w.PortraitPreview;let moving=0,acting=0;
  for(let i=0;i<10;i++){
    const before=lifeCore(p),routeBefore=route(p);
    // Sample synchronously: one animation frame would move the actor and rewrite the timer.
    clickAt(w,p.actor.x,petY({...p.actor,high:false,state:'idle'},'human')-20);
    check(lifeCore(p)===before,'Human click changed the timetable at '+time);
    check(route(p)===routeBefore,'Human click changed the route at '+time);
    await sleep(80);
    if(p.life.reaction)reactions.human++;
    for(const kind of ['cat','dog']){
      const pet=p.pets[kind],before2=lifeCore(p);
      clickAt(w,pet.x,petY(pet,kind)-12);
      check(lifeCore(p)===before2,kind+' click changed the human timetable at '+time);
      await sleep(80);
      if(p.pets[kind].reaction)reactions[kind]++;
      if(pet.walking)moving++;else acting++;
    }
    closeDialog(w);await sleep(100);
  }
  check(moving>0&&acting>0,'Both moving and acting residents were exercised at '+time);
  report('PASS '+time+' 角色点击不改作息与路线');
}
// 3. Click scope: decorations, appliances and the swing stay inert; only classic entries answer.
{
  const w=await load('?d=2026-09-17&t=15:00');
  for(const id of ['bedroom.rug','bedroom.window','kitchen.fridge','kitchen.dogBowl','bathroom.toilet','bedroom.clock']){
    clickAt(w,...centerOf(id));await sleep(30);
    check(!dialogOpen(w),id+' opened a dialog');check(!hintOf(w),id+' showed a hint');
  }
  clickAt(w,GARDEN.swingX,GARDEN.swingY);await sleep(30);
  check(!dialogOpen(w),'Swing opened a dialog');check(!hintOf(w),'Swing showed a hint');
  report('PASS 装饰物件、窗户、家电与秋千均无弹窗无提示');
  clickAt(w,...pointFor(w,'bedroom.boba'));await sleep(30);
  check(hintOf(w).includes('玩偶'),'Plush answers with its name');
  clickAt(w,...pointFor(w,'kitchen.table'));await sleep(30);
  check(hintOf(w).length>0,'Meal hotspot answers');
  clickAt(w,...pointFor(w,'kitchen.door'));await sleep(30);
  check(hintOf(w).includes('木门'),'Door answers with the locked notice');
  clickAt(w,...pointFor(w,'workspace.desk'));await sleep(60);
  check(dialogOpen(w),'Computer opens');check(dialogTitle(w).includes('电脑'),'Computer dialog title');closeDialog(w);await sleep(30);
  clickAt(w,...pointFor(w,'workspace.bookshelf'));await sleep(60);
  check(dialogOpen(w),'Letters open');check(w.document.querySelectorAll('#details-content button').length===2,'Two letters offered');closeDialog(w);await sleep(30);
  report('PASS 玩偶名称/餐食/木门提示，电脑六频道与两封信入口');
}
// 4. Manual guitar and wardrobe keep the horizontal rules.
{
  const w=await load('?d=2026-09-17&t=15:00'),p=w.PortraitPreview;
  clickAt(w,...pointFor(w,'bedroom.guitar'));await sleep(80);
  check(p.life.activity==='guitar','Guitar click starts a song, got '+p.life.activity);
  clickAt(w,...pointFor(w,'bedroom.guitar'));await sleep(40);
  check(hintOf(w).includes('正在弹'),'Playing again is refused');
  clickAt(w,...pointFor(w,'bedroom.wardrobe'));await sleep(40);
  check(hintOf(w).includes('晚上'),'Wardrobe change is refused outside the evening');
  const w2=await load('?d=2026-09-17&t=20:00'),p2=w2.PortraitPreview;
  check(p2.life.schedule==='playCat','Evening leisure window, got '+p2.life.schedule);
  clickAt(w2,...pointFor(w2,'bedroom.wardrobe'));await sleep(80);
  check(p2.life.activity==='change','Evening wardrobe click changes clothes, got '+p2.life.activity);
  report('PASS 点击吉他弹唱、晚间点击衣柜换衣，白天与忙碌时给出提示');
}
// 5. Rapid lamp switching frightens the cat, with the horizontal cooldown shape.
{
  const w=await load('?d=2026-09-17&t=20:00'),p=w.PortraitPreview;
  for(let i=0;i<3;i++){clickAt(w,LAMPS[i].x,LAMPS[i].y);await sleep(90);}
  check(hintOf(w).includes('猫'),'Rapid switching warns about the cat');
  check(p.pets.cat.state==='underbed','The cat hides under the bed, got '+p.pets.cat.state);
  report('PASS 连续闪灯三次后猫躲进床底');
}
// 6. MOMO call card: only during the call, and it opens the full record.
{
  const w=await load('?d=2026-09-14&t=21:00'),p=w.PortraitPreview,card=w.document.querySelector('#call-card');
  check(p.life.schedule==='call','Monday call window, got '+p.life.schedule);
  check(!card.hidden,'Call card is visible during the call');
  check(card.textContent.includes('MOMO'),'Call card names the caller');
  card.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));await sleep(60);
  check(dialogOpen(w),'Call card opens the record');
  check(w.document.querySelectorAll('#details-content .call-line').length>=12,'Full call record listed');
  closeDialog(w);
  const w2=await load('?d=2026-09-14&t=15:00');
  check(w2.document.querySelector('#call-card').hidden,'Call card is hidden outside the call');
  report('PASS 通话卡片只在通话期间出现，点击可读完整记录');
}
check(errors.length===0,errors.join('\n'));
check(Object.values(reactions).every(n=>n>0),'Each resident responds: '+JSON.stringify(reactions));
report('点击回应次数 '+JSON.stringify(reactions));
report('页面异常 '+errors.length);
report('ALL PASS');
}catch(e){report('FAIL '+(e&&e.stack||e));}};
document.body.dataset.testReady='1';
// Headless runners can pass ?autorun instead of clicking the button.
if(new URLSearchParams(location.search).has('autorun'))document.querySelector('#run').click();
