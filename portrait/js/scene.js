import { CONFIG, ROOMS, GARDEN } from './config.js';
import { drawItem, ITEM_META } from './art/index.js';
import { getVisibleItems, LAMPS } from './layout.js';

const rect = (ctx, x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
function line(ctx, x0, y0, x1, y1, color, thickness = 1) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) rect(ctx, x0 + (x1 - x0) * i / (steps || 1), y0 + (y1 - y0) * i / (steps || 1), thickness, thickness, color);
}
function random(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; }; }

function sky(ctx, state) {
  const night = state.theme === 'night';
  const gradient = ctx.createLinearGradient(0, 0, 0, CONFIG.height);
  gradient.addColorStop(0, night ? '#101c39' : '#7aa3b5');
  gradient.addColorStop(.6, night ? '#223449' : '#c4c9ba');
  gradient.addColorStop(1, night ? '#263c42' : '#8ea18d');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
  const rand = random(786);
  for (let i = 0; i < 85; i++) {
    const x = Math.floor(rand() * 216), y = Math.floor(rand() * 280);
    if (night&&state.stars!==false) rect(ctx, x, y, 1, 1, i % 4 ? '#78869b' : '#ecd19b');
  }
  // A small pixel moon / sun, behind the roof line.
  const mx = 184, my = 27;
  ctx.fillStyle = night ? '#d2dfdf' : '#ffe3a7';
  for (let dy = -7; dy <= 7; dy++) {
    const w = Math.floor(Math.sqrt(49 - dy * dy)); ctx.fillRect(mx - w, my + dy, w * 2, 1);
  }
  if (night) for (let dy = -6; dy <= 6; dy++) {
    const w = Math.floor(Math.sqrt(36 - dy * dy)); rect(ctx, mx + 3 - w, my - 2 + dy, w * 2, 1, '#13203b');
  }
  [[18,32,26],[136,12,17],[195,68,26]].forEach(([x,y,w]) => {
    rect(ctx,x,y,w,3,night?'#283858':'#d4e0de');rect(ctx,x+5,y-3,w-11,4,night?'#283858':'#d4e0de');
  });
  // Distant street silhouettes frame the house without taking interior space.
  for (const [x,y,w,h] of [[0,180,12,163],[202,213,14,128],[0,283,18,65],[198,297,18,52]]) {
    rect(ctx,x,y,w,h,night?'#142833':'#64838b');rect(ctx,x+3,y+16,2,3,night?'#c5a16b':'#a0b8b6');
  }
}

function shell(ctx, state) {
  const night = state.theme === 'night';
  rect(ctx,6,63,204,289,'#372d2b');
  rect(ctx,10,65,196,281,night?'#987c5c':'#cfb58d');
  rect(ctx,173,65,33,281,night?'#917353':'#c9a980');
  // Exterior stairwell boards.
  for (let x=178;x<206;x+=7) rect(ctx,x,65,1,281,'#795f432b');
  ROOMS.forEach(room => {
    const { x,y,w,h,id }=room;
    rect(ctx,x,y,w,h,id==='bathroom'?'#ccdfe0':id==='workspace'?'#c9d1cf':'#dfc8a5');
    if (id==='bathroom'||id==='kitchen') {
      const size=id==='bathroom'?8:5, split=id==='bathroom'?y+45:y+42;
      for(let gy=y;gy<split;gy+=size) for(let gx=x;gx<x+w;gx+=size) {
        rect(ctx,gx,gy,Math.min(size-1,x+w-gx),Math.min(size-1,split-gy),id==='bathroom'?'#d7e5e4':'#e6dec9');
      }
      rect(ctx,x,split,w,room.base-split,id==='bathroom'?'#65848a':'#537054');
      for(let gx=x+5;gx<x+w;gx+=7) rect(ctx,gx,split,1,room.base-split,'#233c332f');
      rect(ctx,x,split,w,2,id==='bathroom'?'#4b666b':'#37543f');
    } else {
      for(let gx=x+5;gx<x+w;gx+=8) rect(ctx,gx,y,1,h,id==='workspace'?'#9aaea52a':'#b7a07c3a');
      rect(ctx,x,y+58,w,1,id==='workspace'?'#aab8b0':'#c1a47f');
    }
    const rand=random(942+room.floor*39+x);
    for(let i=0;i<w*2;i++)rect(ctx,x+Math.floor(rand()*w),y+Math.floor(rand()*h),1,1,'#533e2910');
    rect(ctx,x,room.base-3,w,3,'#866645');
    for(let fy=room.base;fy<room.base+5;fy++) {
      rect(ctx,x,fy,w,1,id==='bathroom'?'#9aafb0':id==='workspace'?'#6a7278':id==='kitchen'?'#8f644b':'#ab8053');
    }
    for(let gx=x+6;gx<x+w;gx+=9)rect(ctx,gx,room.base,1,5,'#302e322a');
  });
  // Floor plates end at the common stair shaft.
  [155,253,351].forEach(y=>{
    rect(ctx,6,y,168,7,'#342e30');rect(ctx,6,y,168,2,'#65503d');rect(ctx,6,y+5,168,2,'#211f28');
  });
  rect(ctx,100,162,4,86,'#584636');rect(ctx,101,163,1,63,'#c6aa83');
  // Mid-floor door opening on the foreground plane, not through the fixtures.
  rect(ctx,100,228,4,20,'#6a5239');
  rect(ctx,171,65,4,281,'#50402f');
  for(const y of [130,228,326]){rect(ctx,171,y,4,20,'#917353');rect(ctx,170,y-2,5,2,'#624a32');}
  rect(ctx,6,65,4,287,'#64503a');rect(ctx,206,65,4,287,'#64503a');
  rect(ctx,6,65,1,287,'#a08057');rect(ctx,209,66,1,285,'#242831');
  roof(ctx,state);
}

function roof(ctx,state){
  // Chimney behind the pitched roof.
  rect(ctx,151,27,12,25,'#594941');rect(ctx,149,25,16,4,'#373743');
  for(let y=32;y<52;y+=5){rect(ctx,151,y,12,1,'#302c30');rect(ctx,156+(y%2)*2,y-4,1,4,'#393034');}
  for(let y=25;y<64;y++){
    const dx=Math.round((y-25)*2.55);rect(ctx,108-dx,y,dx*2,1,'#684b3f');
    if(y%5===0)rect(ctx,108-dx,y,dx*2,1,'#4d3734');
  }
  for(let s=0;s<101;s+=3){
    const y=25+s*.38;
    rect(ctx,106-s,y-3,7,5,'#29323f');rect(ctx,108+s,y-3,7,5,'#29323f');
    rect(ctx,107-s,y-3,5,1,'#47525d');rect(ctx,109+s,y-3,5,1,'#47525d');
  }
  rect(ctx,4,62,208,4,'#332f31');rect(ctx,7,65,202,2,'#8a694b');
  rect(ctx,100,40,17,18,'#322e32');rect(ctx,102,42,13,14,state.theme==='night'?'#d6a356':'#b0ced0');
  rect(ctx,107,41,2,16,'#755331');rect(ctx,102,48,13,2,'#755331');rect(ctx,98,58,21,2,'#97724b');
  // Wind-vane silhouette, the small roof accent from the reference.
  rect(ctx,108,16,1,8,'#17232e');line(ctx,102,20,115,20,'#17232e');rect(ctx,106,12,7,4,'#17232e');rect(ctx,112,10,2,4,'#17232e');
}

function stairs(ctx){
  // Two switchback flights per storey. The common shaft stays clear of rooms.
  for(const top of [150,248]){
    const middle=top+45,bottom=top+98;
    rect(ctx,174,top,32,3,'#a68053');rect(ctx,174,top+3,32,2,'#4b382c');
    for(let i=0;i<10;i++){
      const x=175+i*2.7,y=top+4+i*4.2;
      rect(ctx,x,y,5,3,'#a67c4a');rect(ctx,x,y+3,5,2,'#56402e');
    }
    rect(ctx,201,middle,5,5,'#92704b');
    for(let i=0;i<11;i++){
      const x=201-i*2.5,y=middle+5+i*4.4;
      rect(ctx,x,y,5,3,'#ac8352');rect(ctx,x,y+3,5,2,'#57402e');
    }
    // Handrails show which flights connect; physically followed in S3.
    line(ctx,175,top-8,202,middle-8,'#503b2c',2);line(ctx,202,middle-8,176,bottom-11,'#503b2c',2);
    line(ctx,175,top-8,202,middle-8,'#c09661');line(ctx,202,middle-8,176,bottom-11,'#c09661');
    for(let i=0;i<4;i++){
      rect(ctx,176+i*8,top-7+i*12,1,12,'#6b4f33');rect(ctx,201-i*8,middle-6+i*15,1,12,'#6b4f33');
    }
  }
}

function garden(ctx,state,actor){
  const night=state.theme==='night';
  rect(ctx,5,358,206,7,'#455051');rect(ctx,8,358,200,1,'#7a8270');
  for(let x=9;x<209;x+=12){rect(ctx,x,359,1,5,'#2a353d');rect(ctx,x,362,12,1,'#344349');}
  rect(ctx,0,365,216,85,night?'#243b34':'#718566');
  const colors=state.season==='winter'?['#849b98','#bdc9bf','#d6dfd2']:state.season==='autumn'?['#6a7350','#a1844c','#c29c53']:['#415f44','#637c50','#7d9059'];
  const rand=random(416);
  for(let i=0;i<850;i++){const x=Math.floor(rand()*216),y=365+Math.floor(rand()*85);rect(ctx,x,y,2,1,colors[i%3]);}
  // Stepping stones connect the door to the open garden and swing.
  for(let y=369;y<438;y+=10){rect(ctx,150,y,15,5,night?'#686b60':'#aaa98d');rect(ctx,151,y,13,1,'#c0baa0');}
  for(let x=91;x<150;x+=14)rect(ctx,x,417,10,4,night?'#686b60':'#aaa98d');
  // Low flower borders frame the lawn without obscuring the swing.
  for(const [x,y,w] of [[10,374,28],[177,376,28],[13,429,105],[178,427,27]]){
    rect(ctx,x,y+5,w,6,'#4b5037');rect(ctx,x,y+10,w,2,'#91704c');
    for(let i=3;i<w-2;i+=6){rect(ctx,x+i,y+1,1,6,'#3e6441');rect(ctx,x+i-2,y+3,5,2,'#547747');rect(ctx,x+i-1,y,3,3,state.season==='winter'?'#d7ddd0':i%3?'#d8b573':'#c98889');rect(ctx,x+i,y+1,1,1,'#f1d7a0');}
  }
  // Swing stands entirely in front of the house, with clear space around it.
  const x=GARDEN.swingX,y=GARDEN.swingY;
  rect(ctx,x-29,y+1,60,4,'#26382744');
  line(ctx,x-29,y,x-18,y-39,'#4c3728',3);line(ctx,x+28,y,x+17,y-39,'#4c3728',3);
  line(ctx,x-21,y-40,x+23,y-40,'#9b7046',4);line(ctx,x-20,y-40,x+22,y-40,'#d0a26a');
  line(ctx,x-27,y-2,x-17,y-37,'#ac8051');line(ctx,x+29,y-2,x+19,y-37,'#ac8051');
  const sway=actor?.pose==='swing'?Math.sin(actor.motion*1.8)*3:0;
  line(ctx,x-7,y-36,x-7+sway,y-8,'#b3a078');line(ctx,x+7,y-36,x+7+sway,y-8,'#b3a078');
  rect(ctx,x-11+sway,y-8,24,4,'#916238');rect(ctx,x-10+sway,y-8,22,1,'#d5ab70');
  // Foreground fence leaves the path open.
  for(const [x,w] of [[5,135],[175,35]]){rect(ctx,x,442,w,2,'#695338');for(let px=x;px<x+w;px+=18){rect(ctx,px,437,3,13,'#59452f');rect(ctx,px,437,3,1,'#b29160');}}
}

function ceilingLamp(ctx,lamp,on){
  rect(ctx,lamp.x,lamp.y-11,1,9,'#6b5438');
  rect(ctx,lamp.x-3,lamp.y-4,7,3,'#b9935c');rect(ctx,lamp.x-5,lamp.y-1,11,3,on?'#e7c67e':'#9d885f');
  rect(ctx,lamp.x-3,lamp.y+2,7,1,on?'#fff0bb':'#6e654b');
}

function illumination(ctx,state){
  if(state.theme!=='night')return;
  for(let i=0;i<ROOMS.length;i++){
    const room=ROOMS[i];
    ctx.save();ctx.beginPath();ctx.rect(room.x,room.y,room.w,room.h+5);ctx.clip();
    rect(ctx,room.x,room.y,room.w,room.h+5,state.lamps[i]?'#111e362a':'#101b387d');
    if(state.lamps[i]){
      const lamp=LAMPS[i];
      const g=ctx.createRadialGradient(lamp.x,lamp.y,3,lamp.x,lamp.y+20,Math.max(48,room.w*.65));
      g.addColorStop(0,room.id==='bathroom'?'#dae5d021':'#ffcc7929');g.addColorStop(1,'#efbd6900');ctx.fillStyle=g;ctx.fillRect(room.x,room.y,room.w,room.h+5);
    }
    ctx.restore();
  }
}

function bubble(ctx,x,y,text){if(!text)return;const width=Math.min(62,Math.max(22,text.length*4+6));rect(ctx,x-width/2,y-11,width,9,'#101923e8');ctx.fillStyle='#f0dfbb';ctx.font='4px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText(text.slice(0,14),x,y-5);ctx.textAlign='start';rect(ctx,x-1,y-2,2,2,'#101923e8');}
function drawActor(ctx,actor){
  const bob=actor.walking?Math.round(Math.abs(Math.sin(actor.step))*1.2):0;
  const swing=actor.pose==='swing',sway=swing?Math.sin(actor.motion*1.8)*3:0;
  ctx.save();ctx.translate(Math.round(actor.x+sway),Math.round(actor.y));if(actor.direction<0)ctx.scale(-1,1);
  if(actor.pose==='sleep'){
    rect(ctx,-12,-23,10,8,'#e1af87');rect(ctx,-13,-25,11,3,'#574030');rect(ctx,-13,-23,3,6,'#574030');rect(ctx,-8,-19,3,1,'#5c4038');
    ctx.restore();bubble(ctx,actor.x,actor.y-30,actor.reaction);return;
  }
  const seated=['toilet','read','call','guitar','swing','phone','work','game','eat','eatSnack'].includes(actor.pose)&&!actor.walking;
  rect(ctx,-7,-1,14,2,'#1d20243d');ctx.save();if(seated){ctx.beginPath();ctx.rect(-16,-40,34,30);ctx.clip();}drawItem(ctx,'human',-7,-34-bob);ctx.restore();
  if(seated){rect(ctx,-5,-11,11,4,'#3f70a9');rect(ctx,3,-8,8,3,'#365f92');rect(ctx,8,-6,3,3,'#3a3028');}
  if(actor.outfit===1)rect(ctx,-4,-21-bob,8,9,'#c66d42');if(actor.outfit===2)rect(ctx,-4,-21-bob,8,9,'#6e62a8');
  if(actor.walking){
    const stride=Math.sin(actor.step*2)>0?1:-1;
    rect(ctx,-4+stride,-10-bob,3,8,'#3f70a9');rect(ctx,1-stride,-10-bob,3,8,'#365f92');
    rect(ctx,-4+stride,-2-bob,3,2,'#3a3028');rect(ctx,1-stride,-2-bob,3,2,'#302820');
  }
  if(actor.pose==='wake'){rect(ctx,-8,-25,3,2,'#4575ad');rect(ctx,5,-25,3,2,'#4575ad');rect(ctx,-9,-29,2,5,'#e1af87');rect(ctx,7,-29,2,5,'#e1af87');}
  if(actor.pose==='fridge'){rect(ctx,4,-20,8,2,'#4575ad');rect(ctx,11,-20,2,2,'#e1af87');}
  if(actor.pose==='cook'){rect(ctx,4,-18,7,2,'#4575ad');rect(ctx,10,-19,2,2,'#e1af87');rect(ctx,12,-24,1,7,'#8f795d');}
  if(actor.pose==='eat'){rect(ctx,4,-18,6,2,'#4575ad');rect(ctx,9,-19,2,2,'#e1af87');rect(ctx,11,-21,3,1,'#e8dfcb');}

  if(['work','game'].includes(actor.pose)){rect(ctx,4,-19,8,2,'#4575ad');rect(ctx,10,-20,2,2,'#e1af87');}
  if(['toilet','read','call','guitar','swing'].includes(actor.pose)){rect(ctx,-6,-11,12,4,'#3f70a9');rect(ctx,3,-8,8,3,'#3a3028');}
  if(['washHands','brush','shower'].includes(actor.pose)){for(let i=0;i<4;i++)rect(ctx,8+i*2,-25+(i%2)*3,1,3,'#9bd9e5aa');}
  if(actor.pose==='exercise'){const lift=Math.sin(actor.motion*5)>0?0:4;rect(ctx,-10,-24-lift,4,2,'#4575ad');rect(ctx,6,-24-lift,4,2,'#4575ad');}
  if(actor.pose==='guitar'){rect(ctx,-2,-19,10,12,'#8a5429');rect(ctx,7,-23,2,15,'#56351f');}
  if(actor.held==='phone')rect(ctx,8,-23,3,5,'#30465d');if(actor.held==='book')rect(ctx,5,-17,8,5,'#b96b55');if(actor.held==='cup')rect(ctx,8,-18,3,4,'#d8e0df');
  ctx.restore();
  bubble(ctx,actor.x,actor.y-39,actor.reaction);
}

function drawLifeProps(ctx,life,world){
  if(!life)return;
  if(life.phase==='fridge'){
    rect(ctx,17,303,14,40,'#25343a');rect(ctx,19,307,10,2,'#bad5c8');rect(ctx,20,317,8,2,'#d4b674');
    rect(ctx,31,303,10,40,'#708b72');rect(ctx,32,304,8,38,'#91aa8d');rect(ctx,33,322,1,7,'#d6d4b7');
  }
  if(life.phase==='cook'){
    rect(ctx,61,309,11,2,'#282b30');rect(ctx,63,307,7,2,'#747a78');rect(ctx,70,308,5,1,'#30343a');
    const drift=Math.floor(life.motion*5)%5;rect(ctx,64,305-drift,1,2,'#e8e0ca99');rect(ctx,68,302-((drift+2)%5),1,2,'#e8e0ca88');
  }
  if(['toTable','eat'].includes(life.phase)){
    rect(ctx,98,321,12,2,'#e8e8ec');rect(ctx,100,320,8,2,'#dca65d');rect(ctx,102,319,4,1,'#7c9b61');
  }
  if(['fridge'].includes(life.pose)){rect(ctx,17,303,14,40,'#25343a');rect(ctx,19,307,10,2,'#bad5c8');rect(ctx,31,303,10,40,'#91aa8d');}
  if(life.pose==='cook'){rect(ctx,61,309,11,2,'#282b30');rect(ctx,63,307,7,2,'#747a78');const drift=Math.floor(life.motion*5)%5;rect(ctx,64,305-drift,1,2,'#e8e0ca99');rect(ctx,68,302-((drift+2)%5),1,2,'#e8e0ca88');}
  if(['eat','eatSnack'].includes(life.pose)){rect(ctx,98,321,12,2,'#e8e8ec');rect(ctx,100,320,8,2,life.meal?.type==='noodles'?'#e8cf77':'#dca65d');}
  if(['wardrobe','change'].includes(life.pose)){rect(ctx,20,97,13,40,'#3d2b24');rect(ctx,9,96,11,44,'#9a633a');rect(ctx,33,96,11,44,'#794a2f');}
  if(life.pose==='shower'){for(let i=0;i<9;i++)rect(ctx,116+(i%3)*4,185+(i*5+Math.floor(life.motion*18))%50,1,4,'#a9e3ec99');}
  if(life.pose==='door')rect(ctx,166,281,21,69,'#6d472e');
}

function petY(pet){return pet.y-(pet.high&&pet.kind==='cat'?32:0)+(pet.state==='underbed'?7:0);}
function drawPet(ctx,pet){if(!pet)return;let y=petY(pet);const bob=pet.walking?Math.abs(Math.sin(pet.motion*7))*1.3:0;ctx.save();ctx.translate(Math.round(pet.x),Math.round(y-bob));if(pet.direction<0)ctx.scale(-1,1);drawItem(ctx,pet.kind,pet.kind==='cat'?-11:-11,pet.kind==='cat'?-17:-17);if(pet.state==='sleep'){rect(ctx,-8,-8,16,5,'#8b5a2b88');}ctx.restore();bubble(ctx,pet.x,y-22,pet.reaction);}
function weatherEffects(ctx,state,weather){if(!state.particles||!weather)return;const t=Date.now()/90;if(weather.kind==='rain'||weather.kind==='storm')for(let i=0;i<44;i++){const x=(i*37+t)%216,y=(i*53+t*2)%CONFIG.height;line(ctx,x,y,x-2,y+5,'#a8c9de88');}if(weather.kind==='snow')for(let i=0;i<35;i++){const x=(i*41+t*.25)%216,y=(i*47+t*.5)%CONFIG.height;rect(ctx,x,y,1,1,'#eef6f0cc');}if(weather.kind==='storm'&&Math.floor(Date.now()/1200)%9===0)rect(ctx,0,0,CONFIG.width,CONFIG.height,'#d9e7ff44');}
function ambientObjects(ctx,state){if(state.detail===false)return;const t=Date.now()/180;if(state.season==='summer'){const cx=20,cy=180;for(let i=0;i<4;i++){const a=t+i*Math.PI/2;line(ctx,cx,cy,cx+Math.cos(a)*5,cy+Math.sin(a)*5,'#88939a');}const kx=97,ky=309;line(ctx,kx,ky,kx+Math.cos(t)*3,ky+Math.sin(t)*3,'#adb3b5');}if(state.season==='winter'){for(let i=0;i<4;i++)rect(ctx,94+(i%2)*3,225-((t+i*4)%13),1,3,'#e8f1ef77');}}

export function drawScene(canvas,state,runtime={}){
  const ctx=canvas.getContext('2d');
  ctx.setTransform(CONFIG.pixel,0,0,CONFIG.pixel,0,0);ctx.imageSmoothingEnabled=false;
  const {actor,life,pets,world,weather}=runtime;sky(ctx,state);shell(ctx,state);stairs(ctx);garden(ctx,state,actor);
  const hour=runtime.time?.hour??12,options={night:state.theme==='night',season:state.season,blanket:hour>=22||hour<8?'cover':hour<10?'made':'messy',cup:hour<12?4:hour<18?2:0,bowl:world?.bowls?.cat??3,dogBowl:world?.bowls?.dog??3};
  for(const item of getVisibleItems(state,world).filter(item=>!['actor.human','actor.cat','actor.dog'].includes(item.id)).filter(item=>item.id!=='bedroom.guitar'||life?.held!=='guitar').filter(item=>item.id!=='kitchen.package'||world?.pkg?.state==='arrived')){
    if(!ITEM_META[item.art])throw new Error('Missing original art: '+item.art);
    drawItem(ctx,item.art,item.x,item.y,{...options,...item.options,lampOn:item.lampIndex!==undefined?state.lamps[item.lampIndex]:true});
  }
  drawLifeProps(ctx,life||{},world);
  ambientObjects(ctx,state);
  if(actor)drawActor(ctx,actor);
  drawPet(ctx,pets?.cat);drawPet(ctx,pets?.dog);
  LAMPS.filter(l=>l.kind==='ceiling').forEach((lamp,i)=>ceilingLamp(ctx,lamp,state.lamps[i]));
  illumination(ctx,state);
  weatherEffects(ctx,state,weather);
  // Small doorway lights are not extra switchable indoor lamps.
  if(state.theme==='night'){
    const g=ctx.createRadialGradient(193,329,0,193,329,18);g.addColorStop(0,'#f3c27524');g.addColorStop(1,'#f3c27500');ctx.fillStyle=g;ctx.fillRect(175,308,32,37);
  }
}

export function hitTest(x,y,state,runtime={}){
  // Small readable objects have priority over wider furniture regions.
  const actor=runtime.actor,pets=runtime.pets;if(actor&&x>=actor.x-9&&x<=actor.x+9&&y>=actor.y-38&&y<=actor.y+3)return{type:'entity',entity:'human',label:'小人'};
  for(const kind of ['cat','dog']){const pet=pets?.[kind];if(pet&&x>=pet.x-13&&x<=pet.x+13&&y>=petY(pet)-24&&y<=petY(pet)+4)return{type:'entity',entity:kind,label:kind==='cat'?'橘猫':'腊肠狗'};}
  const lamp=LAMPS.find(l=>Math.abs(l.x-x)<7&&Math.abs(l.y-y)<7);if(lamp)return{type:'lamp',...lamp};
  // Click scope is limited to the horizontal-build interactions: decorations, windows,
  // rugs, appliances and pet props are inert and have no hover target.
  return getVisibleItems(state,runtime.world).filter(item=>item.action).filter(item=>!['actor.human','actor.cat','actor.dog'].includes(item.id)).slice().reverse().find(item=>{const m=ITEM_META[item.art];return x>=item.x-1&&x<=item.x+m.width+1&&y>=item.y-1&&y<=item.y+m.height+1;})||null;
}
