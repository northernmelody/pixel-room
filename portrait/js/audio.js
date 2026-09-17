export class AudioSystem{
  constructor(preferences){this.preferences=preferences;this.ctx=null;this.lastAmbient=0;this.lastAction=0;}
  async enable(){if(!this.ctx)this.ctx=new (globalThis.AudioContext||globalThis.webkitAudioContext)();await this.ctx.resume();this.chime(440,.06);}
  chime(frequency=440,duration=.08){if(!this.ctx||!this.preferences.sound)return;const osc=this.ctx.createOscillator(),gain=this.ctx.createGain(),now=this.ctx.currentTime;osc.type='sine';osc.frequency.value=frequency;gain.gain.setValueAtTime(this.preferences.volume/800,now);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(gain).connect(this.ctx.destination);osc.start(now);osc.stop(now+duration);}
  interact(kind){this.chime(kind==='cat'?620:kind==='dog'?330:480,.11);}
  update(weather,time,life){if(!this.ctx||!this.preferences.sound)return;const stamp=Date.now();if(life?.pose==='guitar'&&stamp-this.lastAction>900){this.lastAction=stamp;this.chime([196,247,294,330][Math.floor(stamp/900)%4],.28);}else if(life?.pose==='work'&&stamp-this.lastAction>4200){this.lastAction=stamp;this.chime(180,.025);}if(stamp-this.lastAmbient>8000){this.lastAmbient=stamp;const night=time.hour<6||time.hour>=19,f=weather.kind==='storm'?90:weather.kind==='rain'?130:night?520:760,duration=(weather.kind==='rain'||weather.kind==='storm') ? .22 : .08;this.chime(f,duration);}}
  setPreferences(value){this.preferences=value;}
}
