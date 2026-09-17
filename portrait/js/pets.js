import { NavigationController } from './navigation.js';
import { saveWorld } from './store.js';

const CAT_LABELS={idle:'懒洋洋地发呆',wander:'在屋里巡视',groom:'认真理毛',sleep:'蜷成一团睡觉',zoomies:'突然跑得飞快',rub:'想去蹭蹭人',climb:'寻找一个高处',perch:'在高处观察',scratch:'抓了抓窗帘',underbed:'躲在床底',eat:'正在吃猫粮',play:'追着逗猫棒'};
const DOG_LABELS={idle:'守着小屋',wander:'在屋里散步',sleep:'回狗窝睡觉',eat:'正在吃狗粮',zoomies:'开心地跑来跑去',follow:'悄悄跟着人',bark:'轻轻叫了一声',scratch:'在地板上刨了刨',sit:'坐着观察大家'};
const rand=(a,b)=>a+Math.random()*(b-a);

class Pet{
  constructor(kind,world){this.kind=kind;this.world=world;this.nav=new NavigationController(()=>{},{storageKey:null,x:kind==='cat'?28:128,y:kind==='cat'?150:346,speed:kind==='cat'?30:27});this.state='idle';this.timer=rand(2,5);this.motion=0;this.reaction=null;this.high=false;}
  get labels(){return this.kind==='cat'?CAT_LABELS:DOG_LABELS;}
  snapshot(){return {...this.nav.snapshot(),kind:this.kind,state:this.state,label:this.labels[this.state]||'在屋里休息',motion:this.motion,reaction:this.reaction?.text||'',high:this.high};}
  react(){const choices=this.kind==='cat'?['耳朵轻轻动了一下','尾巴弯成了问号','喵了一声回应你','眯起眼睛呼噜呼噜']:['尾巴摇得更快了','轻轻汪了一声','抬头看着你','开心地眨眨眼'];this.reaction={text:choices[Math.floor(Math.random()*choices.length)],timer:1.5};if(this.kind==='cat'){this.world.petToday++;this.world.petTotal++;saveWorld(this.world);}}
  go(floor,x,state,duration){this.high=false;this.state=state;this.nav.speed=state==='zoomies'?60:this.kind==='cat'?30:27;this.timer=duration;this.nav.moveTo(floor,x);}
  choose(actor,life){
    if(this.kind==='cat'){
      if(life.activity==='playCat'){this.go(1,48,'play',rand(12,22));return;}
      if(this.world.bowls.cat>0&&Math.random()<.13){this.go(0,138,'eat',rand(4,7));return;}
      const states=['idle','wander','groom','sleep','zoomies','rub','climb','scratch','underbed'],state=states[Math.floor(Math.random()*states.length)];
      if(state==='rub'){this.go(actor.floor,Math.max(22,Math.min(164,actor.x-10)),'rub',rand(5,10));}
      else if(state==='climb'){const perches=[[2,28],[2,120],[1,76],[0,30],[0,68]],p=perches[Math.floor(Math.random()*perches.length)];this.go(p[0],p[1],'climb',rand(5,8));}
      else if(state==='scratch')this.go(2,132,'scratch',rand(4,8));else if(state==='underbed')this.go(2,62,'underbed',rand(8,15));else{const floor=Math.floor(Math.random()*3);this.go(floor,rand(24,160),state,rand(state==='sleep'?10:3,state==='sleep'?24:10));}
    }else{
      if(this.world.bowls.dog>0&&Math.random()<.13){this.go(0,115,'eat',rand(4,7));return;}
      const states=['idle','wander','sleep','zoomies','follow','bark','scratch','sit'],state=states[Math.floor(Math.random()*states.length)];
      if(state==='follow')this.go(actor.floor,Math.max(24,Math.min(160,actor.x-13)),'follow',rand(7,13));else if(state==='sleep')this.go(0,128,'sleep',rand(12,28));else this.go(Math.random()<.7?actor.floor:Math.floor(Math.random()*3),rand(24,160),state,rand(3,10));
    }
  }
  update(dt,actor,life){this.motion+=dt;if(this.reaction){this.reaction.timer-=dt;if(this.reaction.timer<=0)this.reaction=null;}this.nav.update(dt);if(this.nav.walking)return;if(this.state==='climb'&&!this.high){this.high=true;this.state='perch';this.timer=rand(10,28);}this.timer-=dt;if(this.timer<=0){if(this.state==='eat'){const key=this.kind==='cat'?'cat':'dog';this.world.bowls[key]=Math.max(0,this.world.bowls[key]-1);saveWorld(this.world);}this.choose(actor,life);} }
}

export class PetWorld{
  constructor(world){this.cat=new Pet('cat',world);this.dog=new Pet('dog',world);}
  update(dt,actor,life){this.cat.update(dt,actor,life);this.dog.update(dt,actor,life);}
  snapshots(){return {cat:this.cat.snapshot(),dog:this.dog.snapshot()};}
  interact(kind){this[kind]?.react();}
}
