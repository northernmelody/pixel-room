import { CONFIG } from './config.js';

export function loadLetterOverrides(){try{const value=JSON.parse(localStorage.getItem(CONFIG.letterStorageKey)||'null');return value?.v===1?value:{v:1,toMomo:null,fromMomo:null};}catch{return {v:1,toMomo:null,fromMomo:null};}}
export function saveLetterOverride(key,letter){const value=loadLetterOverrides();value[key]=letter;try{localStorage.setItem(CONFIG.letterStorageKey,JSON.stringify(value));return true;}catch{return false;}}
export function clearLetterOverrides(){try{localStorage.removeItem(CONFIG.letterStorageKey);return true;}catch{return false;}}
export function parseLetterFile(name,text,fallback){
  if(!/\.(txt|md|markdown|json)$/i.test(name))throw new Error('仅支持 TXT、Markdown 或 JSON 文件');
  if(new TextEncoder().encode(text).byteLength>100000)throw new Error('文件不能超过 100 KB');
  let title=fallback.title,from=fallback.from,to=fallback.to,body=text.trim();
  if(name.toLowerCase().endsWith('.json')){const json=JSON.parse(text);if(!json||typeof json!=='object'||Array.isArray(json))throw new Error('JSON 必须是信件对象');if(json.paragraphs!==undefined&&(!Array.isArray(json.paragraphs)||!json.paragraphs.every(p=>typeof p==='string')))throw new Error('paragraphs 必须是字符串数组');title=String(json.title||title);from=String(json.from||from);to=String(json.to||to);body=Array.isArray(json.paragraphs)?json.paragraphs.join('\n\n'):String(json.body||json.text||'');}
  else{const lines=body.split(/\r?\n/);if(/^#\s+/.test(lines[0]||''))title=lines.shift().replace(/^#\s+/,'').trim();body=lines.join('\n').trim();}
  const paragraphs=body.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);if(!paragraphs.length)throw new Error('信件内容为空');
  return {title,from,to,paragraphs,uploadedName:name,uploadedAt:new Date().toISOString()};
}
