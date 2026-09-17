import { CONFIG } from '../portrait/js/config.js';
import { LAMPS } from '../portrait/js/layout.js';
import { loadPreferences, savePreferences, resetPreferences, resetWorld, resolvePreferences } from '../portrait/js/store.js';
import { STORY } from '../portrait/js/content/index.js';
import { loadLetterOverrides, saveLetterOverride, clearLetterOverrides, parseLetterFile } from '../portrait/js/letters.js';

const $=id=>document.getElementById(id);let state=loadPreferences(),messageTimer;
function message(text){$('save-message').textContent=text;clearTimeout(messageTimer);messageTimer=setTimeout(()=>$('save-message').textContent='',3200);}
function persist(text='设置已保存'){if(savePreferences(state))message(text);else message('浏览器暂时无法保存设置');render();}
function render(){
  $('auto-theme').setAttribute('aria-pressed',String(state.theme==='auto'));$('day').setAttribute('aria-pressed',String(state.theme==='day'));$('night').setAttribute('aria-pressed',String(state.theme==='night'));$('season').value=state.season;$('collections').checked=state.showCollectibles;$('volume').value=state.volume;$('volume-value').value=state.volume+'%';
  for(const id of ['particles','stars','detail'])$(id).checked=state[id];
  const effective=resolvePreferences(state);const list=$('lamp-list');list.replaceChildren(...LAMPS.map(lamp=>{const button=document.createElement('button');button.type='button';button.setAttribute('aria-pressed',String(effective.lamps[lamp.index]));button.textContent=lamp.label+' · '+(effective.lamps[lamp.index]?'亮':'暗');button.addEventListener('click',()=>{state.lamps=[...resolvePreferences(state).lamps];state.lampMode='manual';state.lamps[lamp.index]=!state.lamps[lamp.index];persist();});return button;}));$('auto-lamps').textContent=state.lampMode==='auto'?'正在使用自动灯光':'恢复自动灯光';renderLetters();
}
function renderLetters(){const value=loadLetterOverrides();$('letter-to-state').textContent=value.toMomo?'已使用 '+value.toMomo.uploadedName:'使用内置信件';$('letter-from-state').textContent=value.fromMomo?'已使用 '+value.fromMomo.uploadedName:'使用内置信件';}
async function upload(input,key,fallback){const file=input.files?.[0];if(!file)return;try{if(file.size>100000)throw new Error('文件不能超过 100 KB');const letter=parseLetterFile(file.name,await file.text(),fallback);if(!saveLetterOverride(key,letter))throw new Error('浏览器无法保存');message('已保存《'+letter.title+'》');renderLetters();}catch(error){message('读取失败：'+error.message);}finally{input.value='';}}
for(const [id,value] of [['auto-theme','auto'],['day','day'],['night','night']])$(id).addEventListener('click',()=>{state.theme=value;persist();});
$('season').addEventListener('change',event=>{state.season=event.target.value;persist();});$('collections').addEventListener('change',event=>{state.showCollectibles=event.target.checked;persist();});
$('auto-lamps').addEventListener('click',()=>{state.lampMode='auto';persist('已恢复按时间自动开关灯');});
$('volume').addEventListener('input',event=>{$('volume-value').value=event.target.value+'%';});$('volume').addEventListener('change',event=>{state.volume=Number(event.target.value);persist();});
for(const id of ['particles','stars','detail'])$(id).addEventListener('change',event=>{state[id]=event.target.checked;persist();});
$('letter-to').addEventListener('change',event=>upload(event.target,'toMomo',STORY.letters.toMomo));$('letter-from').addEventListener('change',event=>upload(event.target,'fromMomo',STORY.letters.fromMomo));
$('clear-letters').addEventListener('click',()=>{clearLetterOverrides();renderLetters();message('已恢复两封内置信件');});
$('reset').addEventListener('click',()=>{state=resetPreferences();render();message('竖版设置已恢复');});$('reset-world').addEventListener('click',()=>{message(resetWorld()?'生活进度已重置':'浏览器暂时无法重置进度');});
window.addEventListener('storage',event=>{if(event.key===CONFIG.storageKey){state=loadPreferences();render();message('已同步另一页面的设置');}if(event.key===CONFIG.letterStorageKey)renderLetters();});render();
