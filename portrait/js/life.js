import { GARDEN } from './config.js';
import { ANCHORS } from './layout.js';
import { STORY, SONGS } from './content/index.js';
import { now, minuteOfDay, dayNumber } from './time.js';
import { saveWorld } from './store.js';

const anchor=Object.fromEntries(ANCHORS.map(a=>[a.id,a]));
const TITLES={sleep:'睡得很安稳',wakeUp:'慢慢醒来',dress:'换上今天的衣服',morning:'晨间洗漱',morningBuffer:'准备开始一天',breakfast:'准备早餐',lunch:'准备午餐',dinner:'准备晚餐',work:'认真工作',sofa:'在沙发上放空',leisure:'晚间休闲',call:'和 MOMO 通话',shower:'洗个热水澡',undress:'收起白天的衣服',game:'打会儿游戏',read:'在床边看书',exercise:'舒展身体',playCat:'陪猫玩一会儿',lookOut:'看看窗外',phone:'在床边看手机',snack:'拿一点零食',change:'换一身衣服',guitar:'弹一首歌',swing:'去院子荡秋千',drink:'喝一点水'};
const goto=(id,label)=>({anchor:id,label}),act=(pose,duration,label,held='')=>({pose,duration,label,held});
const PROFILE_NAMES=['SUNDAY_RESET','MONDAY_REST','TUESDAY_EXERCISE','WEDNESDAY_HOBBY','THURSDAY_LIGHT_LEISURE','FRIDAY_WEEKEND_EVE','SATURDAY_FREE'];
const hash=(text)=>{let h=2166136261;for(const ch of text){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const dateKey=()=>{const t=now();return `${t.year}-${String(t.month).padStart(2,'0')}-${String(t.day).padStart(2,'0')}`;};
const dayOfWeek=()=>{const t=now();return new Date(Date.UTC(t.year,t.month-1,t.day)).getUTCDay();};
const profileName=()=>PROFILE_NAMES[dayOfWeek()];
const push=(blocks,start,duration,activity)=>{blocks.push([start,start+duration,activity]);return start+duration;};
function dailyBlocks(){
  const dow=dayOfWeek(), key=dateKey(), variation=hash(key+'|routine');
  const blocks=[];let m;
  if(dow===6){
    m=push(blocks,0,510,'sleep');m=push(blocks,m,15,'wakeUp');m=push(blocks,m,15,'dress');m=push(blocks,m,20,'morning');m=push(blocks,m,40,'breakfast');m=push(blocks,m,10+(variation%21),'swing');m=push(blocks,m,60,'sofa');
  }else if(dow===0){
    m=push(blocks,0,480,'sleep');m=push(blocks,m,15,'wakeUp');m=push(blocks,m,15,'dress');m=push(blocks,m,20,'morning');m=push(blocks,m,35,'breakfast');m=push(blocks,m,10+(variation%16),'swing');m=push(blocks,m,70,'sofa');
  }else{
    m=push(blocks,0,440,'sleep');m=push(blocks,m,15,'wakeUp');m=push(blocks,m,10,'dress');m=push(blocks,m,20,'morning');m=push(blocks,m,30,'breakfast');const swingMinutes=variation%3===0?0:5+(variation%11);if(swingMinutes)m=push(blocks,m,swingMinutes,'swing');m=push(blocks,m,25-swingMinutes,'morningBuffer');m=push(blocks,m,180,'work');m=push(blocks,m,60,'lunch');m=push(blocks,m,300,'work');m=push(blocks,m,60,'dinner');
  }
  const evening={
    1:[['sofa',40],['playCat',30],['phone',40],['call',30],['read',40],['shower',30],['undress',30]],
    2:[['sofa',30],['exercise',45],['shower',30],['drink',15],['read',40],['phone',35],['undress',25]],
    3:[['guitar',55],['read',40],['playCat',30],['swing',25],['snack',25],['call',30],['shower',30],['undress',25]],
    4:[['game',55],['playCat',30],['phone',40],['read',35],['lookOut',25],['shower',30],['undress',25]],
    5:[['game',75],['snack',30],['guitar',55],['playCat',30],['phone',40],['call',30],['shower',30],['undress',25]],
    6:[['game',60],['swing',30],['read',45],['guitar',45],['snack',30],['call',35],['shower',30],['undress',30]],
    0:[['playCat',35],['read',55],['lookOut',35],['phone',35],['call',30],['shower',30],['undress',25]]
  }[dow];
  if(dow!==6&&dow!==0){for(const [activity,duration] of evening){m=push(blocks,m,duration,activity);}}
  else {if(m<1110)m=push(blocks,m,1110-m,'sofa');m=push(blocks,m,60,'dinner');for(const [activity,duration] of evening){m=push(blocks,m,duration,activity);}}
  if(m<1380){m=push(blocks,m,1380-m,'sofa');}if(m<1440)push(blocks,m,1440-m,'sleep');
  return blocks;
}
function currentSchedule(){const m=minuteOfDay();const blocks=dailyBlocks();const base=blocks.find(([a,b])=>m>=a&&m<b)||blocks[blocks.length-1];if(base[2]!=='sleep')return base;const seed=hash(dateKey()+'|night');if(seed%10>=3)return base;const nightMinute=m<440?m+1440-1380:m-1380,eventAt=42+(seed%370);if(Math.abs(nightMinute-eventAt)<7)return[0,0,['nightToilet','nightDrink','nightSnack','nightPhone'][seed%4]];return base;}
function dishFor(kind){const list=STORY.dishes[kind],salt={breakfast:3,lunch:17,dinner:31}[kind];return list[(dayNumber()*7+salt)%list.length];}
function leisureChoice(){return 'sofa';}
function target(id){const a=anchor[id];return a?{floor:a.room==='bedroom'?2:a.room==='kitchen'?0:1,x:a.x}:null;}

export class LifeDirector{
  constructor(navigation,world,onChange=()=>{}){this.navigation=navigation;this.world=world;this.onChange=onChange;this.schedule='';this.activity='';this.steps=[];this.index=0;this.timer=0;this.pose='idle';this.held='';this.label='';this.meal=null;this.snack=null;this.song=null;this.motion=0;this.reaction=null;this.setPlan(currentSchedule()[2]);}
  react(){const choices=this.pose==='sleep'?['翻了个身','睡梦里轻轻呼吸']:this.pose==='shower'?['隔着水声哼了一句歌','冲你眨了眨眼']:['朝你挥了挥手','笑着点点头','回头看了你一眼','有点惊喜'];this.reaction={text:choices[Math.floor(Math.random()*choices.length)],timer:1.6};this.onChange(this.snapshot());}
  snapshot(){const call=this.schedule==='call'?STORY.calls[dayNumber()%STORY.calls.length]:null;let lyric='';if(this.pose==='guitar'&&this.song){const elapsed=Math.max(0,(this.current()?.duration||0)-this.timer),i=Math.min(this.song.lyrics.length-1,Math.floor(elapsed/this.song.tempo));lyric=this.song.lyrics[i]||'';}return {schedule:this.schedule,activity:this.activity,title:TITLES[this.activity]||TITLES[this.schedule]||'平凡的一天',label:this.label,pose:this.pose,held:this.held,motion:this.motion,meal:this.meal,snack:this.snack,song:this.song,lyric,call,reaction:this.reaction?.text||'',step:this.index};}
  current(){return this.steps[this.index];}
  setPlan(activity){
    this.schedule=currentSchedule()[2];if(activity==='leisure')activity=leisureChoice();this.activity=activity;this.index=0;this.timer=0;this.pose='idle';this.held='';this.meal=null;this.snack=null;this.song=null;
    const plans={sleep:[goto('bed.sleep','回到床上'),act('sleep',3600,'正在睡觉')],nightToilet:[goto('toilet.use','夜里去卫生间'),act('toilet',50,'安静地上厕所'),goto('bed.sleep','回床继续睡'),act('sleep',500,'重新睡着了')],nightDrink:[goto('fridge.take','夜里去喝水'),act('drink',40,'喝一点水','cup'),goto('bed.sleep','回床继续睡'),act('sleep',500,'重新睡着了')],nightSnack:[goto('fridge.take','夜里有点饿'),act('fridge',2,'拿一点夜宵','snack'),goto('table.eat','走到餐桌'),act('eatSnack',65,'安静地吃夜宵','snack'),goto('bed.sleep','回床继续睡')],nightPhone:[goto('bed.sit','翻了个身'),act('phone',150,'看一会儿手机','phone'),act('sleep',500,'放下手机睡着了')],morning:[goto('toilet.use','去卫生间'),act('toilet',5,'正在如厕'),act('flush',1.3,'冲水'),goto('sink.wash','走到洗手台'),act('washHands',4.5,'认真洗手'),act('brush',1800,'正在刷牙')],work:[goto('desk.work','走到电脑前'),act('work',32,'正在工作'),goto('fridge.take','去厨房喝水'),act('drink',5,'喝一杯水','cup'),goto('desk.work','回到工作区'),act('work',120,'继续工作')],call:[goto('bed.sit','回到床边'),act('call',1800,'正在和 MOMO 通话','phone')],shower:[goto('shower.use','去洗澡'),act('shower',1800,'正在淋浴')],game:[goto('desk.work','去电脑前'),act('game',70,'正在打游戏')],read:[goto('bed.sit','去床边'),act('read',65,'正在看书','book')],exercise:[goto('exercise','找一块空地'),act('exercise',75,'正在运动')],playCat:[goto('cat.play','拿起逗猫棒'),act('playCat',60,'正在陪猫玩','toy')],lookOut:[goto('window.look','走到窗边'),act('lookOut',40,'静静看着窗外')],phone:[goto('bed.sit','坐到床边'),act('phone',75,'正在看手机','phone')],snack:[goto('fridge.take','去冰箱拿零食'),act('fridge',2.2,'打开冰箱','snack'),goto('table.eat','拿到餐桌'),act('eatSnack',35,'正在吃零食','snack')],change:[goto('wardrobe.change','走到衣柜前'),act('wardrobe',1.4,'打开衣柜'),act('change',4.5,'正在换衣服'),act('wardrobeClose',1,'关好衣柜')],swing:[{point:[156,346],label:'走向门口'},act('door',1.2,'推开院门'),{point:[GARDEN.swingX,GARDEN.swingY],label:'走到秋千边'},act('swing',70,'在院子里荡秋千')]};
    plans.wakeUp=[goto('bed.sit','从床上醒来'),act('wake',8,'慢慢醒来')];
    plans.dress=[goto('wardrobe.change','走到衣柜前'),act('wardrobe',2,'挑今天的衣服'),act('change',8,'换上今天的衣服'),act('wardrobeClose',1,'关好衣柜')];
    plans.morningBuffer=[goto('window.look','看一眼窗外'),act('lookOut',20,'准备开始一天')];
    plans.undress=[goto('wardrobe.change','收起白天的衣服'),act('wardrobe',3,'准备睡觉'),act('undress',5,'换回睡前状态')];
    plans.sofa=[goto('bed.sit','找个舒服的位置'),act('idle',1800,'在沙发上放空')];
    plans.drink=[goto('fridge.take','去厨房喝水'),act('drink',40,'喝一点水','cup')];
    if(['breakfast','lunch','dinner'].includes(activity)){this.meal=dishFor(activity);this.steps=[goto('fridge.take','去冰箱取食材'),act('fridge',2.2,'从冰箱取出食材','food'),goto('stove.cook','走到灶台'),act('cook',9,'正在做'+this.meal.name,'food'),goto('table.eat','把饭端上桌'),act('eat',120,'正在吃'+this.meal.name,'meal')];}
    else if(activity==='snack'){this.snack=STORY.snacks[dayNumber()%STORY.snacks.length];this.steps=[goto('fridge.take','去冰箱拿'+this.snack.name),act('fridge',2.2,'取出'+this.snack.name,'snack'),goto('table.eat','拿到餐桌'),act('eatSnack',35,'正在吃'+this.snack.name,'snack')];}
    else if(activity==='guitar'){this.song=SONGS[(dayNumber()+Math.floor(minuteOfDay()/10))%SONGS.length];this.steps=[goto('guitar.pick','走到吉他边'),act('guitarPick',.8,'拿起吉他','guitar'),goto('bed.sit','抱着吉他到床边'),act('guitar',this.song.lyrics.length*this.song.tempo+this.song.endHold,'弹唱《'+this.song.title+'》','guitar'),goto('guitar.pick','把吉他送回去'),act('guitarPlace',.8,'放好吉他')];}
    else this.steps=plans[activity]||plans.sleep;this.beginCurrent();
  }
  beginCurrent(){const step=this.current();if(!step){this.finishPlan();return;}this.label=step.label||'';if(step.anchor){const t=target(step.anchor);this.pose='walk';this.navigation.moveTo(t.floor,t.x);}else if(step.point){this.pose='walk';this.navigation.moveToPoint(...step.point);}else{this.pose=step.pose;this.held=step.held||'';this.timer=step.duration||0;}this.onChange(this.snapshot());}
  finishPlan(){if(['breakfast','lunch','dinner'].includes(this.activity)&&this.meal){this.world.completedMeals++;this.world.lastMeal=this.meal.name;saveWorld(this.world);this.steps=[act('idle',Infinity,'吃完饭，休息一会儿')];this.index=0;this.held='';this.beginCurrent();return;}if(this.activity==='change'||this.activity==='dress'){this.world.outfit=(this.world.outfit+1)%3;saveWorld(this.world);}if(currentSchedule()[2]===this.activity){this.steps=[act('idle',Infinity,this.activity==='undress'?'已经准备睡觉':'继续保持当前节奏')];this.index=0;this.held='';this.beginCurrent();return;}if(this.schedule==='leisure')this.setPlan(leisureChoice(this.activity));else this.setPlan(this.schedule);}
  update(dt){this.motion+=dt;if(this.reaction){this.reaction.timer-=dt;if(this.reaction.timer<=0)this.reaction=null;}const schedule=currentSchedule()[2];if(schedule!==this.schedule){this.schedule=schedule;this.setPlan(schedule);return true;}const step=this.current();if(!step){this.finishPlan();return true;}if(step.anchor||step.point){if(!this.navigation.walking){this.index++;this.beginCurrent();}}else{this.timer-=dt;if(this.timer<=0){this.index++;this.beginCurrent();}}return true;}
}
