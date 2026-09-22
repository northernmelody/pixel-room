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
  for(const [x,y,w] of GARDEN_FLOWER_BEDS){
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
  gardenToys(ctx,night);
}

// Two plush animals sit on the lawn between the swing and the stepping stones.
export const GARDEN_FLOWER_BEDS=Object.freeze([[10,374,28],[177,376,28],[13,429,105],[178,427,27]]);
export const GARDEN_TOYS=Object.freeze([
  Object.freeze({id:'elephant',x:20,y:400,w:18,h:15}),
  Object.freeze({id:'giraffe',x:122,y:388,w:15,h:24})
]);
function gardenToys(ctx,night){
  // Fixed palettes keep the plushies readable in daylight and dimmed after dark.
  const skin=night?{main:'#7d8794',shade:'#6a7481',dark:'#515a66',light:'#8d97a4'}:{main:'#a3acb8',shade:'#98a1ad',dark:'#6f7885',light:'#bcc4ce'};
  const fur=night?{main:'#a8763a',shade:'#8a5f2c',dark:'#6b4a22',light:'#c99a55'}:{main:'#dda75a',shade:'#c98f45',dark:'#a9762f',light:'#eec27c'};
  const eye='#2c3238';
  const [elephant,giraffe]=GARDEN_TOYS;
  const e=elephant;
  rect(ctx,e.x+1,e.y+13,16,2,'#26382744');
  rect(ctx,e.x+11,e.y+2,4,6,skin.shade);                                  // ear behind the head
  rect(ctx,e.x+2,e.y+5,11,7,skin.main);                                   // body
  rect(ctx,e.x+3,e.y+5,9,1,skin.light);                                   // back highlight
  rect(ctx,e.x+1,e.y+5,1,4,skin.shade);rect(ctx,e.x,e.y+9,2,2,skin.dark); // tail
  rect(ctx,e.x+4,e.y+11,3,3,skin.shade);rect(ctx,e.x+9,e.y+11,3,3,skin.shade);
  rect(ctx,e.x+4,e.y+13,3,1,skin.dark);rect(ctx,e.x+9,e.y+13,3,1,skin.dark); // feet
  rect(ctx,e.x+11,e.y+3,6,8,skin.main);rect(ctx,e.x+11,e.y+3,5,1,skin.light); // head
  rect(ctx,e.x+14,e.y+5,1,1,eye);                                         // eye
  rect(ctx,e.x+16,e.y+9,1,2,night?'#cfc8b4':'#f2ead4');                   // tusk
  rect(ctx,e.x+16,e.y+6,2,5,skin.shade);rect(ctx,e.x+15,e.y+10,3,3,skin.shade);rect(ctx,e.x+16,e.y+12,2,1,skin.dark); // trunk
  const g=giraffe;
  rect(ctx,g.x+1,g.y+23,13,2,'#26382744');
  rect(ctx,g.x+3,g.y+18,3,5,fur.main);rect(ctx,g.x+8,g.y+18,3,5,fur.main);  // legs
  rect(ctx,g.x+3,g.y+22,3,1,fur.dark);rect(ctx,g.x+8,g.y+22,3,1,fur.dark);  // hooves
  rect(ctx,g.x+1,g.y+13,10,6,fur.main);rect(ctx,g.x+2,g.y+17,8,2,fur.light); // body and belly
  rect(ctx,g.x+8,g.y+9,5,5,fur.main);rect(ctx,g.x+9,g.y+4,4,6,fur.main);    // neck
  rect(ctx,g.x+9,g.y+2,5,4,fur.main);rect(ctx,g.x+13,g.y+3,2,3,fur.shade);  // head and muzzle
  rect(ctx,g.x+8,g.y+3,2,2,fur.shade);                                      // ear
  rect(ctx,g.x+10,g.y,1,2,fur.dark);rect(ctx,g.x+12,g.y,1,2,fur.dark);      // ossicones
  rect(ctx,g.x+11,g.y+3,1,1,eye);
  rect(ctx,g.x+3,g.y+14,2,2,fur.dark);rect(ctx,g.x+6,g.y+16,2,2,fur.dark);  // spots
  rect(ctx,g.x+10,g.y+6,2,2,fur.dark);rect(ctx,g.x+9,g.y+11,1,2,fur.dark);
  rect(ctx,g.x,g.y+14,1,5,fur.dark);rect(ctx,g.x,g.y+19,2,1,fur.dark);      // tail tuft
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

// Click responses are posture animations like the horizontal build, never text bubbles.
const REACT_FRAMES={wave:3,nod:2,startle:1,lookback:1,lookup:1};
const reactVariant=(reaction,motion)=>reaction==='wave'?'wave'+Math.floor(motion*8)%3:reaction==='nod'?'nod'+Math.floor(motion*6)%2:reaction;
function drawBaldHead(ctx,y=-34){
  // Cover the legacy hair pixels with the existing head silhouette and face.
  // The footprint remains 14×14, so every pose keeps its original anchor.
  rect(ctx,-7,y,14,14,'#d9c8a0');rect(ctx,-6,y+1,12,11,'#f5e6c8');rect(ctx,-6,y+11,12,2,'#d9c8a0');
  rect(ctx,-5,y+2,2,1,'#fdf8e8');rect(ctx,-3,y+7,2,2,'#1a1a1a');rect(ctx,1,y+7,2,2,'#1a1a1a');
  rect(ctx,-2,y+10,4,1,'#c47a5a');rect(ctx,-3,y+1,6,1,'#fff3d7aa');
}
function drawActor(ctx,actor){
  const bob=actor.walking?Math.round(Math.abs(Math.sin(actor.step))*1.2):0;
  const swing=actor.pose==='swing',sway=swing?Math.sin(actor.motion*1.8)*3:0;
  const reaction=REACT_FRAMES[actor.reaction]?actor.reaction:'';
  const jitter=reaction==='startle'?Math.round(Math.sin(actor.motion*26)):0;
  const human=ITEM_META.human;
  ctx.save();ctx.translate(Math.round(actor.x+sway+jitter),Math.round(actor.y));if(actor.direction<0)ctx.scale(-1,1);
  if(reaction){
    // The horizontal build stands the character up for the reaction, then continues.
    rect(ctx,-7,-1,14,2,'#1d20243d');
    const variant=reactVariant(reaction,actor.motion);drawItem(ctx,'human',-human.anchorX,-human.anchorY-bob,{reaction:variant});drawBaldHead(ctx,variant==='nod0'||variant==='lookup'?-35:variant==='nod1'?-33:-34);
    ctx.restore();return;
  }
  if(actor.pose==='sleep'){
    rect(ctx,-12,-23,10,8,'#e1af87');rect(ctx,-13,-24,11,3,'#f5e6c8');rect(ctx,-13,-22,3,5,'#d9c8a0');rect(ctx,-8,-19,3,1,'#5c4038');
    ctx.restore();return;
  }
  const seated=['toilet','read','call','guitar','swing','phone','work','game','eat','eatSnack','coupleSit','coupleGame','coupleSnack','coupleRead','coupleIdle'].includes(actor.pose)&&!actor.walking;
  const showering=actor.pose==='shower';
  rect(ctx,-7,-1,14,2,'#1d20243d');ctx.save();if(seated){ctx.beginPath();ctx.rect(-16,-40,34,30);ctx.clip();}drawItem(ctx,'human',-human.anchorX,-human.anchorY-bob,{shower:showering});drawBaldHead(ctx,-34-bob);ctx.restore();
  if(seated){rect(ctx,-5,-11,11,4,'#3f70a9');rect(ctx,3,-8,8,3,'#365f92');rect(ctx,8,-6,3,3,'#3a3028');}
  // The shower sprite is already undressed, so the clothing and held-item overlays stay off.
  if(!showering){
    if(actor.outfit===1)rect(ctx,-4,-21-bob,8,9,'#c66d42');if(actor.outfit===2)rect(ctx,-4,-21-bob,8,9,'#6e62a8');
  }
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
  if(['washHands','brush'].includes(actor.pose)){for(let i=0;i<4;i++)rect(ctx,8+i*2,-25+(i%2)*3,1,3,'#9bd9e5aa');}
  if(actor.pose==='exercise'){const lift=Math.sin(actor.motion*5)>0?0:4;rect(ctx,-10,-24-lift,4,2,'#4575ad');rect(ctx,6,-24-lift,4,2,'#4575ad');}
  if(actor.pose==='guitar'){rect(ctx,-2,-19,10,12,'#8a5429');rect(ctx,7,-23,2,15,'#56351f');}
  if(actor.held==='phone')rect(ctx,8,-23,3,5,'#30465d');if(actor.held==='book')rect(ctx,5,-17,8,5,'#b96b55');if(actor.held==='cup')rect(ctx,8,-18,3,4,'#d8e0df');
  if(actor.held==='controller'){rect(ctx,-1,-18,7,3,'#202938');rect(ctx,-2,-18,2,3,'#34a8d8');rect(ctx,6,-18,2,3,'#e84b4b');}
  ctx.restore();
}

function drawGirlfriend(ctx,girlfriend,motion=0){
  if(!girlfriend)return;const p=girlfriend.location||girlfriend,walking=girlfriend.pose==='walk',seated=!walking;
  const bob=walking?Math.round(Math.abs(Math.sin(motion*8))):0;ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y-bob));if(girlfriend.facing<0)ctx.scale(-1,1);
  rect(ctx,-7,-1,14,2,'#1d20243d');
  // Legs/body share the male actor's scale while the lavender palette and bob
  // create a distinct silhouette.
  if(seated){rect(ctx,-5,-11,10,4,'#7659a9');rect(ctx,2,-8,8,3,'#543d7c');rect(ctx,8,-6,3,3,'#33283a');}
  else{const stride=Math.sin(motion*16)>0?1:-1;rect(ctx,-4+stride,-12,3,12,'#543d7c');rect(ctx,1-stride,-12,3,12,'#44325f');rect(ctx,-4+stride,-2,3,2,'#33283a');rect(ctx,1-stride,-2,3,2,'#2c2233');}
  rect(ctx,-4,-22,8,12,'#8d6bc0');rect(ctx,-3,-20,6,1,'#b89ad8');rect(ctx,-6,-21,3,8,'#7659a9');rect(ctx,3,-21,3,8,'#7659a9');
  rect(ctx,-7,-35,14,15,'#5b3b78');rect(ctx,-6,-34,12,12,'#f1c7aa');rect(ctx,-7,-35,14,5,'#76509a');rect(ctx,-7,-31,3,10,'#684486');rect(ctx,4,-31,3,10,'#684486');
  rect(ctx,-3,-28,2,2,'#2b2431');rect(ctx,2,-28,2,2,'#2b2431');rect(ctx,-2,-24,4,1,'#b96876');rect(ctx,-5,-34,6,1,'#a17abe');
  if(girlfriend.pose==='game'){rect(ctx,-2,-18,7,3,'#202938');rect(ctx,-3,-18,2,3,'#34a8d8');rect(ctx,5,-18,2,3,'#e84b4b');}
  if(girlfriend.pose==='read')rect(ctx,-1,-18,8,5,'#cf8b80');
  if(girlfriend.pose==='snack'){rect(ctx,5,-18,3,4,'#e8dfcb');rect(ctx,6,-19,1,1,'#fff4d2');}
  ctx.restore();
}

function drawTopLeisure(ctx,couple,motion=0){
  // Shared rug and low table keep the bedroom identity while defining a compact
  // leisure zone between the bed and the right wall.
  rect(ctx,96,137,52,12,'#8f5b55');rect(ctx,98,139,48,8,'#b87865');for(let x=100;x<145;x+=6)rect(ctx,x,140,3,1,'#e0a579');
  rect(ctx,108,139,22,4,'#6b422b');rect(ctx,111,143,3,6,'#4b3427');rect(ctx,125,143,3,6,'#4b3427');
  rect(ctx,111,137,3,2,'#e8dfcb');rect(ctx,126,137,3,2,'#d78b72');
  // TV and media console.
  rect(ctx,117,101,31,25,'#2b2b35');rect(ctx,119,103,27,20,'#101827');
  if(couple?.tvMode==='movie'){rect(ctx,120,104,25,18,'#678aa4');rect(ctx,120,115,25,7,'#344c5d');rect(ctx,128,109,7,6,'#d9b07b');rect(ctx,136,106,5,3,'#dbe7e2');}
  if(couple?.tvMode==='game'){rect(ctx,120,104,25,18,'#75a9cd');rect(ctx,120,115,25,7,'#5c8b55');rect(ctx,124,112,3,5,'#d96a4a');rect(ctx,137,109,4,8,'#6a9b52');rect(ctx,131,116,3,4,'#f1c74e');}
  if(couple?.tvMode==='off')rect(ctx,121,105,23,16,'#182031');
  rect(ctx,116,126,33,5,'#6b4a35');rect(ctx,119,131,3,7,'#4b3529');rect(ctx,143,131,3,7,'#4b3529');
  // Docked Switch-style console: silhouette and cyan/red controls, no logo.
  rect(ctx,128,127,9,4,'#202633');rect(ctx,126,126,3,6,'#27a7d2');rect(ctx,137,126,3,6,'#e84c4b');rect(ctx,127,128,1,1,'#d8f4fb');rect(ctx,138,129,1,1,'#ffe5e2');
  // Residential fireplace, kept clear of the staircase at x >= 173.
  rect(ctx,151,111,17,38,'#6e4938');rect(ctx,149,109,21,4,'#875b43');rect(ctx,153,119,13,23,'#2b2220');rect(ctx,151,142,17,5,'#8b6147');rect(ctx,149,147,21,3,'#5a4033');
  if(couple?.fireplaceOn){const flick=Math.floor(motion*5)%3;rect(ctx,155,132-flick,9,9,'#e45d32');rect(ctx,157,127+flick,5,12,'#ff9b36');rect(ctx,159,125,2,10,'#ffe47c');}
  else if(couple?.fireplaceState==='embers'){rect(ctx,155,137,9,3,'#5b3328');rect(ctx,158,136,4,2,'#b84f2d');rect(ctx,160,135,1,1,'#e99b45');}
  else{rect(ctx,155,137,9,3,'#4a332b');rect(ctx,157,134,5,3,'#5b3d2c');}
}

function drawSleepHead(ctx,x,y,kind,awake=false){
  if(kind==='male'){
    rect(ctx,x,y,9,8,'#d9c8a0');rect(ctx,x+1,y,7,7,'#f5e6c8');rect(ctx,x+2,y+1,4,1,'#fff3d7aa');
    if(awake){rect(ctx,x+2,y+4,1,1,'#242028');rect(ctx,x+6,y+4,1,1,'#242028');}else{rect(ctx,x+2,y+4,2,1,'#76594e');rect(ctx,x+5,y+4,2,1,'#76594e');}
  }else{
    rect(ctx,x,y-1,10,10,'#5b3b78');rect(ctx,x+1,y,8,8,'#f1c7aa');rect(ctx,x,y-1,10,4,'#76509a');rect(ctx,x,y+2,2,7,'#684486');rect(ctx,x+8,y+2,2,7,'#684486');
    if(awake){rect(ctx,x+3,y+4,1,1,'#2b2431');rect(ctx,x+6,y+4,1,1,'#2b2431');}else{rect(ctx,x+2,y+4,2,1,'#76546d');rect(ctx,x+6,y+4,2,1,'#76546d');}
  }
}
function drawCoupleBed(ctx,couple,motion=0){
  const state=couple?.bedState||'BED_EMPTY_DAY',occupied=state.startsWith('BED_OCCUPIED');
  // Shallow 3/4 double bed: headboard, mattress, two pillows and one shared blanket.
  rect(ctx,43,117,52,5,'#69472f');rect(ctx,45,114,48,4,'#875d3d');rect(ctx,45,121,48,25,'#c8b89d');
  rect(ctx,47,122,20,8,'#eee6d6');rect(ctx,70,122,20,8,'#eee6d6');rect(ctx,48,123,18,1,'#fffaf0');rect(ctx,71,123,18,1,'#fffaf0');
  rect(ctx,43,145,52,5,'#6a4933');rect(ctx,46,150,5,2,'#4d372a');rect(ctx,87,150,5,2,'#4d372a');
  if(!occupied){
    rect(ctx,47,132,44,13,state==='BED_READY_NIGHT'?'#6988a5':'#7898b3');rect(ctx,48,132,42,2,'#9ab2c3');rect(ctx,48,143,42,2,'#53718d');
    if(state==='BED_EMPTY_DAY'){rect(ctx,78,136,12,8,'#5f7f9d');rect(ctx,79,136,10,1,'#adc0cc');}
    return;
  }
  let maleX=59,girlX=78,headY=126,blanketY=136,awake=false;
  if(state==='BED_OCCUPIED_CUDDLE'){maleX=64;girlX=74;}
  if(state==='BED_OCCUPIED_INTIMATE'){maleX=64;girlX=74;headY=127;blanketY=132;}
  if(state==='BED_OCCUPIED_SLEEP'){maleX=62;girlX=76;}
  if(state==='BED_OCCUPIED_WAKE'){maleX=59;girlX=79;awake=true;}
  if(couple?.activity==='KISS_GOODNIGHT'){maleX=66;girlX=73;}
  rect(ctx,maleX+1,headY+7,8,9,'#d9c8a0');rect(ctx,girlX+1,headY+7,8,9,'#8061aa');
  drawSleepHead(ctx,maleX,headY,'male',awake);drawSleepHead(ctx,girlX,headY,'girlfriend',awake);
  const hush=state==='BED_OCCUPIED_INTIMATE'&&Math.floor(motion/4)%2?1:0;
  rect(ctx,47,blanketY-hush,44,145-blanketY+hush,'#6988a5');rect(ctx,48,blanketY-hush,42,2,'#9ab2c3');rect(ctx,48,143,42,2,'#53718d');
  rect(ctx,47,145,44,2,'#4f6e89');
}

function bedroomLighting(state,couple){
  if(!couple||!['WARM_BEDSIDE','DIM','SLEEP'].includes(couple.lightState))return state;
  const lamps=[...state.lamps];lamps[0]=false;lamps[5]=couple.lightState==='WARM_BEDSIDE';
  return {...state,theme:'night',lamps};
}

const CLOTH_COLORS=['#c66d42','#6e62a8','#4a7bd0','#7fa8c8','#c94f6d','#e0b352','#6f9b6a','#b46a8a','#3f6f8f','#d98f5a'];
const FOOD_COLORS=['#dca65d','#7c9b61','#c94f4f','#e8cf77','#e8e0ca','#a9673f','#8fbf6a','#d97f4f','#c9b0d9','#f0e2b8'];
export const PROP_BOX=Object.freeze({wardrobe:Object.freeze({x:21,y:107,w:12,h:36}),fridge:Object.freeze({x:18,y:305,w:13,h:37})});
export const PROP_PALETTES=Object.freeze({wardrobe:Object.freeze(CLOTH_COLORS),fridge:Object.freeze(FOOD_COLORS)});
function propRandom(seed){let s=seed>>>0;return()=>{s=(s+0x6d2b79f5)>>>0;let t=Math.imul(s^s>>>15,1|s);t=(t+Math.imul(t^t>>>7,61|t))^t;return((t^t>>>14)>>>0)/4294967296;};}
// Random pixel clothing / food shown while the wardrobe or the fridge stands open.
export function propContents(kind,seed=1){
  const box=PROP_BOX[kind];if(!box)throw new RangeError('Unknown prop: '+kind);
  const palette=kind==='wardrobe'?CLOTH_COLORS:FOOD_COLORS,rand=propRandom(seed),items=[];
  const size=kind==='wardrobe'?[4,6]:[4,3];
  for(let row=0;row<4;row++){
    const slots=1+Math.floor(rand()*2);
    for(let slot=0;slot<slots;slot++){
      const w=size[0],h=size[1],x=Math.round(box.x+1+slot*(w+2)),y=Math.round(box.y+2+row*(h+2));
      if(x+w>box.x+box.w||y+h>box.y+box.h)continue;
      items.push({x,y,w,h,color:palette[Math.floor(rand()*palette.length)]});
    }
  }
  return items;
}
function drawPropContents(ctx,items){for(const item of items||[]){rect(ctx,item.x,item.y,item.w,item.h,item.color);rect(ctx,item.x,item.y,item.w,1,'#ffffff2e');}}

function drawLifeProps(ctx,life,world,props){
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
  if(life.pose==='shower'){/* water and the closed glass are drawn in front of the actor */}
  if(life.pose==='door')rect(ctx,166,281,21,69,'#6d472e');
  // Clicking the furniture opens it: the doors swing out and the interior shows what is inside.
  if(props?.wardrobe?.open){
    rect(ctx,20,97,13,50,'#3d2b24');rect(ctx,20,97,13,1,'#5a4436');drawPropContents(ctx,props.wardrobe.items);
    rect(ctx,9,96,11,44,'#9a633a');rect(ctx,33,96,11,44,'#794a2f');rect(ctx,17,100,3,3,'#d8c9a8');rect(ctx,33,100,3,3,'#d8c9a8');
  }
  if(props?.fridge?.open){
    rect(ctx,17,303,14,40,'#25343a');rect(ctx,18,305,12,1,'#39474d');drawPropContents(ctx,props.fridge.items);
    rect(ctx,31,303,10,40,'#91aa8d');rect(ctx,39,318,3,4,'#5f7361');
  }
}

// Front layer: the shower door closes in front of the bather, with the water inside the cabin.
function drawFrontProps(ctx,life){
  if(life?.pose!=='shower')return;
  for(let i=0;i<9;i++)rect(ctx,116+(i%3)*4,185+(i*5+Math.floor(life.motion*18))%50,1,4,'#a9e3ec99');
  rect(ctx,111,179,21,66,'#bfe4ee3a');
  rect(ctx,110,178,23,2,'#d7eef4b0');
  rect(ctx,110,178,2,68,'#d7eef4a0');rect(ctx,131,178,2,68,'#d7eef4a0');
  rect(ctx,129,207,2,8,'#e8f6f9cc');
}

function petY(pet){return pet.y-(pet.high&&pet.kind==='cat'?32:0)+(pet.state==='underbed'?7:0);}
// Pets answer clicks with the horizontal build's pose set, not with text.
function petMood(pet){if(pet.kind!=='cat')return pet.state==='bark'?'bark':'sit';if(pet.state==='pet')return 'pet'+Math.min(4,Math.max(1,pet.petLevel||1));if(pet.state==='walkaway')return 'walkaway';return 'idle';}
function drawPet(ctx,pet){if(!pet)return;let y=petY(pet);const bob=pet.walking?Math.abs(Math.sin(pet.motion*7))*1.3:0,meta=ITEM_META[pet.kind];ctx.save();ctx.translate(Math.round(pet.x),Math.round(y-bob));if(pet.direction<0)ctx.scale(-1,1);drawItem(ctx,pet.kind,-meta.anchorX,-meta.anchorY,{mood:petMood(pet)});if(pet.state==='sleep'){rect(ctx,-8,-8,16,5,'#8b5a2b88');}ctx.restore();}
function weatherEffects(ctx,state,weather){if(!state.particles||!weather)return;const t=Date.now()/90;if(weather.kind==='rain'||weather.kind==='storm')for(let i=0;i<44;i++){const x=(i*37+t)%216,y=(i*53+t*2)%CONFIG.height;line(ctx,x,y,x-2,y+5,'#a8c9de88');}if(weather.kind==='snow')for(let i=0;i<35;i++){const x=(i*41+t*.25)%216,y=(i*47+t*.5)%CONFIG.height;rect(ctx,x,y,1,1,'#eef6f0cc');}if(weather.kind==='storm'&&Math.floor(Date.now()/1200)%9===0)rect(ctx,0,0,CONFIG.width,CONFIG.height,'#d9e7ff44');}
function ambientObjects(ctx,state){if(state.detail===false)return;const t=Date.now()/180;if(state.season==='summer'){const cx=20,cy=180;for(let i=0;i<4;i++){const a=t+i*Math.PI/2;line(ctx,cx,cy,cx+Math.cos(a)*5,cy+Math.sin(a)*5,'#88939a');}const kx=97,ky=309;line(ctx,kx,ky,kx+Math.cos(t)*3,ky+Math.sin(t)*3,'#adb3b5');}if(state.season==='winter'){for(let i=0;i<4;i++)rect(ctx,94+(i%2)*3,225-((t+i*4)%13),1,3,'#e8f1ef77');}}

export function drawScene(canvas,state,runtime={}){
  const ctx=canvas.getContext('2d');
  ctx.setTransform(CONFIG.pixel,0,0,CONFIG.pixel,0,0);ctx.imageSmoothingEnabled=false;
  const {actor,life,pets,world,weather,props}=runtime,couple=life?.couple;state=bedroomLighting(state,couple);sky(ctx,state);shell(ctx,state);stairs(ctx);garden(ctx,state,actor);
  const hour=runtime.time?.hour??12,options={night:state.theme==='night',season:state.season,blanket:hour>=22||hour<8?'cover':hour<10?'made':'messy',cup:hour<12?4:hour<18?2:0,bowl:world?.bowls?.cat??3,dogBowl:world?.bowls?.dog??3};
  for(const item of getVisibleItems(state,world).filter(item=>!['actor.human','actor.cat','actor.dog'].includes(item.id)).filter(item=>item.id!=='bedroom.bed').filter(item=>item.id!=='bedroom.guitar'||life?.held!=='guitar').filter(item=>item.id!=='kitchen.package'||world?.pkg?.state==='arrived')){
    if(!ITEM_META[item.art])throw new Error('Missing original art: '+item.art);
    drawItem(ctx,item.art,item.x,item.y,{...options,...item.options,lampOn:item.lampIndex!==undefined?state.lamps[item.lampIndex]:true});
  }
  drawCoupleBed(ctx,couple,life?.motion||0);
  drawLifeProps(ctx,life||{},world,props);
  drawTopLeisure(ctx,couple,life?.motion||0);
  ambientObjects(ctx,state);
  const present=couple?.presence&&couple.presence!=='AWAY',bedOccupied=!!couple?.bedState?.startsWith('BED_OCCUPIED');
  const actorView=present&&couple.male&&!bedOccupied?{...actor,x:couple.male.x,y:couple.male.y,pose:couple.malePose,walking:false,held:couple.activity==='SWITCH_COOP'?'controller':couple.activity==='SNACK_TIME'?'cup':couple.activity==='QUIET_READING'?'book':''}:actor;
  if(actorView&&!bedOccupied)drawActor(ctx,actorView);
  if(present&&!bedOccupied&&life?.girlfriend?.location)drawGirlfriend(ctx,life.girlfriend,life.motion||0);
  drawPet(ctx,pets?.cat);drawPet(ctx,pets?.dog);
  drawFrontProps(ctx,life);
  LAMPS.filter(l=>l.kind==='ceiling').forEach((lamp,i)=>ceilingLamp(ctx,lamp,state.lamps[i]));
  illumination(ctx,state);
  weatherEffects(ctx,state,weather);
  // Small doorway lights are not extra switchable indoor lamps.
  if(state.theme==='night'){
    const g=ctx.createRadialGradient(193,329,0,193,329,18);g.addColorStop(0,'#f3c27524');g.addColorStop(1,'#f3c27500');ctx.fillStyle=g;ctx.fillRect(175,308,32,37);
  }
  return {girlfriendActors:present&&(bedOccupied||life?.girlfriend?.location)?1:0,maleActors:bedOccupied||actorView?1:0,bedState:couple?.bedState||'BED_EMPTY_DAY'};
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
