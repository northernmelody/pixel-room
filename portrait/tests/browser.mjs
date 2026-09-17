const frame=document.querySelector('#app'),results=document.querySelector('#results');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const report=text=>results.textContent+=text+'\n';
const check=(ok,msg)=>{if(!ok)throw Error(msg);};
const stable=p=>JSON.stringify({preferences:p.state,actor:p.actor,life:{...p.life,reaction:''},pets:Object.fromEntries(Object.entries(p.pets).map(([k,v])=>[k,{...v,reaction:''}])),timers:p.diagnostics});
document.querySelector('#run').onclick=async()=>{results.textContent='';let errors=[];const clicks={human:0,cat:0,dog:0},moving={human:0,cat:0,dog:0},acting={human:0,cat:0,dog:0};try{
for(const [time,expected] of [['07:29:55','morning'],['07:59:55','breakfast'],['11:59:55','lunch'],['17:59:55','dinner'],['21:29:55','call'],['21:59:55','shower'],['22:29:55','sleep']]){
  frame.src='../?t='+time;await new Promise((resolve,reject)=>{frame.onload=resolve;setTimeout(()=>reject(Error('Frame load timeout')),10000);});
  const w=frame.contentWindow;w.addEventListener('error',e=>errors.push(e.message));w.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
  for(let i=0;i<100&&!w.PortraitPreview;i++)await sleep(50);check(!!w.PortraitPreview,'App initializes');const p=w.PortraitPreview,canvas=w.document.querySelector('#house');
  for(let i=0;i<32;i++){
    for(const kind of ['human','cat','dog']){const entity=kind==='human'?p.actor:p.pets[kind];let y=entity.y-(kind==='human'?20:10)-(entity.high&&kind==='cat'?32:0)+(entity.state==='underbed'?7:0);const x=entity.x,bounds=canvas.getBoundingClientRect();const before=stable(p);canvas.dispatchEvent(new w.MouseEvent('click',{bubbles:true,clientX:bounds.left+x/216*bounds.width,clientY:bounds.top+y/450*bounds.height}));
      check(stable(p)===before,kind+' click modified activity/route/timer');const reaction=kind==='human'?p.life.reaction:p.pets[kind].reaction;if(reaction){clicks[kind]++;(entity.walking?moving:acting)[kind]++;}if(w.document.querySelector('dialog').open)w.document.querySelector('dialog').close();
    }
    await sleep(200);
  }
  check(p.life.schedule===expected,time+' -> '+p.life.schedule);report('PASS '+time+' → '+expected+'；角色点击不改状态、路径或计时');
}
check(errors.length===0,errors.join('\n'));check(Object.values(clicks).every(n=>n>0),'Each resident responds');check(Object.values(moving).every(n=>n>0),'Each resident tested moving');check(Object.values(acting).every(n=>n>0),'Each resident tested acting');report('点击回应次数 '+JSON.stringify(clicks));report('移动中 '+JSON.stringify(moving)+'；动作中 '+JSON.stringify(acting));report('页面异常 '+errors.length);report('ALL PASS');
}catch(e){report('FAIL '+e.stack);}};
