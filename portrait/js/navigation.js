import { CONFIG, GARDEN } from './config.js';

const FLOOR_Y = Object.freeze([346, 248, 150]);
const NODES = Object.freeze({
  topLeft:[18,150], topRight:[170,150], stair1Top:[176,150], stair1Turn:[202,195], stair1Bottom:[176,248],
  midRight:[170,248], midLeft:[18,248], stair2Top:[176,248], stair2Turn:[202,293], stair2Bottom:[176,346],
  bottomRight:[170,346], bottomLeft:[18,346], doorInside:[156,346], doorOutside:[156,361], gardenRight:[156,GARDEN.pathY], gardenLeft:[28,GARDEN.pathY]
});
const EDGES = Object.freeze([
  ['topLeft','topRight'],['topRight','stair1Top'],['stair1Top','stair1Turn'],['stair1Turn','stair1Bottom'],
  ['stair1Bottom','midRight'],['midRight','midLeft'],['midRight','stair2Top'],['stair2Top','stair2Turn'],
  ['stair2Turn','stair2Bottom'],['stair2Bottom','bottomRight'],['bottomRight','bottomLeft'],
  ['bottomRight','doorInside'],['doorInside','doorOutside'],['doorOutside','gardenRight'],['gardenRight','gardenLeft']
]);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

function project(point,a,b){
  const vx=b[0]-a[0],vy=b[1]-a[1],d=vx*vx+vy*vy;
  const t=d?Math.max(0,Math.min(1,((point[0]-a[0])*vx+(point[1]-a[1])*vy)/d)):0;
  const p=[a[0]+vx*t,a[1]+vy*t];
  return {point:p,t,distance:distance(point,p)};
}
function nearestEdge(point, floorOnly=false){
  const allowed=floorOnly?EDGES.filter(([a,b])=>NODES[a][1]===NODES[b][1]):EDGES;
  return allowed.map(([a,b])=>({a,b,...project(point,NODES[a],NODES[b])})).sort((x,y)=>x.distance-y.distance)[0];
}
function connect(graph,a,b,cost){graph.get(a).push([b,cost]);graph.get(b).push([a,cost]);}
function shortest(startPoint,targetPoint,floorTarget=true){
  const startEdge=nearestEdge(startPoint),targetEdge=nearestEdge(targetPoint,floorTarget);
  const points={...NODES,start:startEdge.point,target:targetEdge.point};
  const graph=new Map(Object.keys(points).map(key=>[key,[]]));
  for(const [a,b] of EDGES)connect(graph,a,b,distance(NODES[a],NODES[b]));
  for(const [key,edge] of [['start',startEdge],['target',targetEdge]]){
    connect(graph,key,edge.a,distance(edge.point,NODES[edge.a]));
    connect(graph,key,edge.b,distance(edge.point,NODES[edge.b]));
  }
  if(startEdge.a===targetEdge.a&&startEdge.b===targetEdge.b)connect(graph,'start','target',distance(startEdge.point,targetEdge.point));
  const costs=new Map([...graph.keys()].map(k=>[k,Infinity])),previous=new Map(),open=new Set(graph.keys());costs.set('start',0);
  while(open.size){
    const current=[...open].sort((a,b)=>costs.get(a)-costs.get(b))[0];open.delete(current);if(current==='target')break;
    for(const [next,cost] of graph.get(current))if(open.has(next)&&costs.get(current)+cost<costs.get(next)){costs.set(next,costs.get(current)+cost);previous.set(next,current);}
  }
  const keys=['target'];while(keys[0]!=='start')keys.unshift(previous.get(keys[0]));
  return keys.map(key=>points[key]).filter((point,index,array)=>!index||distance(point,array[index-1])>.01);
}
function nearestFloor(y){return FLOOR_Y.map((base,floor)=>({floor,d:Math.abs(base-y)})).sort((a,b)=>a.d-b.d)[0].floor;}
function validSaved(value){return value?.v===1&&Number.isFinite(value.x)&&Number.isFinite(value.y)&&nearestEdge([value.x,value.y]).distance<2;}
export function clearActorPosition(){try{localStorage.removeItem(CONFIG.actorStorageKey);return true;}catch{return false;}}

export class NavigationController {
  constructor(onChange=()=>{},options={}){
    this.onChange=onChange;this.storageKey=options.storageKey===undefined?CONFIG.actorStorageKey:options.storageKey;this.x=options.x??153;this.y=options.y??150;this.direction=options.direction===-1?-1:1;this.speed=options.speed||42;this.walking=false;this.step=0;this.route=[];
    if(this.storageKey)try{const saved=JSON.parse(localStorage.getItem(this.storageKey)||'null');if(validSaved(saved)){this.x=saved.x;this.y=saved.y;this.direction=saved.direction===-1?-1:1;}}catch{}
  }
  get floor(){return nearestFloor(this.y);}
  get location(){
    if(this.y>352)return '庭院';
    if(Math.abs(this.y-FLOOR_Y[this.floor])>2)return '楼梯';
    if(this.floor===2)return '卧室';if(this.floor===0)return '厨房';
    return this.x<102?'工作区':'卫生间';
  }
  snapshot(){return {x:this.x,y:this.y,floor:this.floor,location:this.location,direction:this.direction,walking:this.walking,route:this.route.map(p=>[...p]),step:this.step};}
  moveTo(floor,x=this.x){
    const targetFloor=Math.max(0,Math.min(2,Math.round(floor))),target=[Math.max(18,Math.min(168,x)),FLOOR_Y[targetFloor]];
    this.route=shortest([this.x,this.y],target).slice(1);this.walking=this.route.length>0;this.onChange(this.snapshot());return this.snapshot();
  }
  moveToPoint(x,y){const target=[Math.max(18,Math.min(168,x)),Math.max(150,Math.min(GARDEN.pathY,y))];this.route=shortest([this.x,this.y],target,false).slice(1);this.walking=this.route.length>0;this.onChange(this.snapshot());return this.snapshot();}
  moveBy(action){
    if(action==='up'||action==='down'){
      let targetFloor;
      if(this.y>FLOOR_Y[2]+.5&&this.y<FLOOR_Y[1]-.5)targetFloor=action==='up'?2:1;
      else if(this.y>FLOOR_Y[1]+.5&&this.y<FLOOR_Y[0]-.5)targetFloor=action==='up'?1:0;
      else targetFloor=this.floor+(action==='up'?1:-1);
      return this.moveTo(targetFloor,this.x);
    }
    return this.moveTo(this.floor,this.x+(action==='left'?-34:34));
  }
  moveFromScene(x,y){const floor=y<199?2:y<297?1:0;return this.moveTo(floor,x);}
  update(dt){
    if(!this.walking)return false;
    let remaining=Math.min(.05,Math.max(0,dt))*this.speed;
    while(remaining>0&&this.route.length){
      const target=this.route[0],dx=target[0]-this.x,dy=target[1]-this.y,d=Math.hypot(dx,dy);
      if(d<=remaining+.001){this.x=target[0];this.y=target[1];this.route.shift();remaining-=d;}
      else{this.x+=dx/d*remaining;this.y+=dy/d*remaining;remaining=0;}
      if(Math.abs(dx)>.1)this.direction=dx<0?-1:1;
    }
    this.step+=dt*10;
    if(!this.route.length){this.walking=false;this.step=0;this.save();}
    this.onChange(this.snapshot());return true;
  }
  save(){if(!this.storageKey)return true;try{localStorage.setItem(this.storageKey,JSON.stringify({v:1,x:this.x,y:this.y,direction:this.direction}));return true;}catch{return false;}}
  reset(){clearActorPosition();this.x=153;this.y=150;this.direction=1;this.route=[];this.walking=false;this.step=0;this.onChange(this.snapshot());}
}

export const NAVIGATION_GEOMETRY=Object.freeze({floorY:FLOOR_Y,nodes:NODES,edges:EDGES});
