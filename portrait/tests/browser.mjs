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
const lifeCore=p=>JSON.stringify({life:{...p.life,reaction:'',reactionT:0},timer:p.diagnostics.timer,index:p.diagnostics.index});
const route=p=>JSON.stringify({...p.actor,reaction:''});
const petY=(v,kind)=>v.y-(v.high&&kind==='cat'?32:0)+(v.state==='underbed'?7:0);

document.querySelector('#run').onclick=async()=>{results.textContent='';
// Start from a fresh visitor: the test page shares the app origin, so clear saved preferences.
localStorage.clear();
const reactions={human:0,cat:0,dog:0};try{// 1. Autonomous timetable boundaries on a pinned Beijing date (Thursday profile).
const captions=[];
for(const [time,expected] of [['07:19:55','SLEEP_TOGETHER'],['07:44:55','dress'],['11:59:55','work'],['18:59:55','dinner']]){
  const w=await load('?d=2026-09-17&t='+time),p=w.PortraitPreview;
  check(p.life.schedule===expected,time+' -> '+p.life.schedule);
  const caption=(w.document.querySelector('#scene-caption').textContent||'').split(' · ');
  const behaviour=caption.at(-1)?.trim()||'';
  check(caption.length>=2&&behaviour.length>0,'Caption shows the current behaviour: '+caption.join(' · '));
  check([p.life.label,p.life.title].includes(behaviour),'Caption matches the life state, got "'+behaviour+'"');
  captions.push(behaviour);
  report('PASS '+time+' → '+expected+'（'+behaviour+'）');
}
check(new Set(captions).size>=3,'The caption tracks different activities: '+captions.join(' / '));
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
  const w=await load('?d=2026-09-17&t=15:00'),p=w.PortraitPreview;
  for(const id of ['bedroom.rug','bedroom.window','kitchen.catBowl','bathroom.toilet','bedroom.clock','kitchen.spiceShelf']){
    clickAt(w,...centerOf(id));await sleep(30);
    check(!dialogOpen(w),id+' opened a dialog');check(!hintOf(w),id+' showed a hint');
  }
  clickAt(w,GARDEN.swingX,GARDEN.swingY);await sleep(30);
  check(!dialogOpen(w),'Swing opened a dialog');check(!hintOf(w),'Swing showed a hint');
  report('PASS 装饰物件、窗户、家电与秋千均无弹窗无提示');
  clickAt(w,...pointFor(w,'bedroom.boba'));await sleep(30);
  check(hintOf(w).includes('玩偶'),'Plush answers with its name');
  clickAt(w,...pointFor(w,'bedroom.melon'));await sleep(30);
  check(hintOf(w).includes('MOMO的黄瓜'),'The cantaloupe answers with "MOMO的黄瓜", got "'+hintOf(w)+'"');
  clickAt(w,...pointFor(w,'kitchen.table'));await sleep(30);
  check(hintOf(w).length>0,'Meal hotspot answers');
  clickAt(w,...pointFor(w,'kitchen.door'));await sleep(30);
  check(hintOf(w).includes('木门'),'Door answers with the locked notice');
  clickAt(w,...pointFor(w,'workspace.desk'));await sleep(60);
  check(dialogOpen(w),'Computer opens');check(dialogTitle(w).includes('电脑'),'Computer dialog title');closeDialog(w);await sleep(30);
  clickAt(w,...pointFor(w,'workspace.bookshelf'));await sleep(60);
  check(dialogOpen(w),'Letters open');check(w.document.querySelectorAll('#details-content button').length===2,'Two letters offered');closeDialog(w);await sleep(30);
  report('PASS 玩偶名称/餐食/木门提示，电脑六频道与两封信入口');
  // Clicking the furniture opens it onto random pixel contents.
  const before=p.life.activity;
  clickAt(w,...pointFor(w,'bedroom.wardrobe'));await sleep(60);
  check(p.props.wardrobe.open,'Wardrobe opens');check(p.props.wardrobe.items.length>=2,'Wardrobe shows clothes: '+p.props.wardrobe.items.length);
  check(p.life.activity===before,'Opening the wardrobe does not start a change');
  clickAt(w,...pointFor(w,'kitchen.fridge'));await sleep(60);
  check(p.props.fridge.open,'Fridge opens');check(p.props.fridge.items.length>=2,'Fridge shows food: '+p.props.fridge.items.length);
  check(!dialogOpen(w),'Furniture opens without a dialog');
  report('PASS 衣柜与冰箱点击打开并显示随机像素内容');
}
// 4. Manual guitar keeps the horizontal refusal rules; posture responses, no text bubbles.
{
  const w=await load('?d=2026-09-17&t=15:00'),p=w.PortraitPreview;
  clickAt(w,...pointFor(w,'bedroom.guitar'));await sleep(80);
  check(p.life.activity==='guitar','Guitar click starts a song, got '+p.life.activity);
  clickAt(w,...pointFor(w,'bedroom.guitar'));await sleep(40);
  check(hintOf(w).includes('正在弹'),'Playing again is refused');
  const w2=await load('?d=2026-09-17&t=08:00'),p2=w2.PortraitPreview;
  check(p2.life.schedule==='morning','Morning wash window, got '+p2.life.schedule);
  clickAt(w2,...pointFor(w2,'bedroom.guitar'));await sleep(60);
  check(hintOf(w2).includes('洗漱'),'The wash cannot be interrupted');
  check(p2.life.activity==='morning','A refused click leaves the timetable alone');
  report('PASS 吉他可在工作与休闲时弹唱，洗漱时拒绝');
}
// 5. Click responses are posture animations like the horizontal build.
{
  const w=await load('?d=2026-09-17&t=15:00'),p=w.PortraitPreview;
  const seen=new Set();
  for(let i=0;i<26;i++){
    clickAt(w,p.actor.x,p.actor.y-20);
    const reaction=p.life.reaction;seen.add(reaction);
    check(!w.document.querySelector('#item-hint').classList.contains('visible'),'Human response shows no text hint');
    check(!!reaction,'Human click answers with a posture');
    await sleep(90);
  }
  check([...seen].every(type=>['wave','nod','startle','lookback'].includes(type)),'Only horizontal postures are used: '+[...seen].join(','));
  for(const kind of ['cat','dog']){
    const pet=p.pets[kind];
    clickAt(w,pet.x,petY(pet,kind)-12);await sleep(90);
    check(!w.document.querySelector('#item-hint').classList.contains('visible'),kind+' response shows no text hint');
  }
  report('PASS 点击回应改为横版姿势，无文字气泡');
}
// 6. Rapid lamp switching frightens the cat, with the horizontal cooldown shape.
{
  const w=await load('?d=2026-09-17&t=20:00'),p=w.PortraitPreview;
  for(let i=0;i<3;i++){clickAt(w,LAMPS[i].x,LAMPS[i].y);await sleep(90);}
  check(hintOf(w).includes('猫'),'Rapid switching warns about the cat');
  check(p.pets.cat.state==='underbed','The cat hides under the bed, got '+p.pets.cat.state);
  report('PASS 连续闪灯三次后猫躲进床底');
}
// 7. The visit continues through a deterministic overnight stay and morning departure.
{
  const w=await load('?d=2026-09-14&t=21:00'),p=w.PortraitPreview,card=w.document.querySelector('#call-card');
  check(p.life.schedule==='FIREPLACE_CHAT','Monday fireplace window, got '+p.life.schedule);
  check(p.life.girlfriend.presence==='VISITING','Girlfriend is visiting');
  check(p.life.girlfriend.pose==='chat','Girlfriend uses the fireplace chat pose');
  check(card.hidden,'Legacy call card stays hidden');
  check(!/手机|通话/.test(w.document.querySelector('#scene-caption').textContent),'Caption no longer reports phone/call');
  const chat=await load('?d=2026-09-14&t=22:45:00');
  check(chat.PortraitPreview.life.couple.activity==='BED_CHAT','Monday enters BED_CHAT');
  check(chat.PortraitPreview.life.couple.bedState==='BED_OCCUPIED_CHAT','Chat uses the occupied double bed');
  const intimate=await load('?d=2026-09-18&t=23:55:00');
  check(intimate.PortraitPreview.life.couple.activity==='UNDER_BLANKET_INTIMACY','Friday includes the abstract intimacy state');
  check(intimate.PortraitPreview.life.couple.lightState==='DIM','Intimacy stays dim');
  check(!/性|亲密/.test(intimate.document.querySelector('#scene-caption').textContent),'Status text remains discreet');
  const sleeping=await load('?d=2026-09-15&t=03:00:00'),sleepState=JSON.stringify(sleeping.PortraitPreview.life.couple);
  check(sleeping.PortraitPreview.life.girlfriend.presence==='STAYING_OVERNIGHT','Direct 03:00 load keeps girlfriend overnight');
  check(sleeping.PortraitPreview.life.couple.activity==='SLEEP_TOGETHER','Direct 03:00 load reconstructs shared sleep');
  check(sleeping.PortraitPreview.life.couple.bedState==='BED_OCCUPIED_SLEEP','Shared sleep uses the two-person bed');
  const sleepingAgain=await load('?d=2026-09-15&t=03:00:00');
  check(JSON.stringify(sleepingAgain.PortraitPreview.life.couple)===sleepState,'Reloading the same timestamp is deterministic');
  const waking=await load('?d=2026-09-15&t=07:22:00');
  check(waking.PortraitPreview.life.couple.activity==='WAKE_TOGETHER','Canonical 07:20 wake becomes WAKE_TOGETHER');
  const w2=await load('?d=2026-09-15&t=07:36:00');
  check(w2.PortraitPreview.life.girlfriend.presence==='AWAY','Girlfriend leaves after the morning departure');
  check(w2.PortraitPreview.life.couple.bedState==='BED_EMPTY_DAY','Bed returns to its daytime empty state');
  check(w2.document.querySelector('#call-card').hidden,'Call card is hidden outside visits too');
  report('PASS 女友晚间到访后留宿、共同睡眠与醒来，早晨离开；刷新可确定性重建');
}
// 8. Branding, hidden in-page entries and the sound default.
{
  const w=await load('?d=2026-09-17&t=15:00');
  check(w.document.title.includes('Still here'),'Page title uses the new name: '+w.document.title);
  check(/STILL HERE/.test(w.document.querySelector('.brand').textContent),'Brand uses the new name');
  check(!w.document.querySelector('.switch-link'),'The horizontal entry link is hidden');
  check(!w.document.querySelector('.back-link'),'The in-page back link is hidden');
  check(w.PortraitPreview.state.sound===true,'Sound defaults to on');
  w.document.querySelector('#house-menu').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));await sleep(40);
  const buttons=[...w.document.querySelectorAll('#details-content button')].map(button=>button.textContent);
  check(buttons.some(text=>text.includes('声音')),'The house menu still switches sound');
  check(!w.document.querySelectorAll('#details-content a').length,'The settings link left the page');
  check(w.document.querySelector('dialog').open,'House menu opened');
  report('PASS 品牌改为 Still here，页内设置与横版入口已隐藏，声音默认开启');
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
