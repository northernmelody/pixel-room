const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const results=fs.readdirSync(path.join(root,'_tools')).filter(n=>/^smoke-.*\.js$/.test(n)).map(name=>{
  const result=cp.spawnSync(process.execPath,[path.join(root,'_tools',name)],{cwd:root,encoding:'utf8',timeout:60000});
  return {name,exitCode:result.status,output:(result.stdout+'\n'+result.stderr).trim()};
});
fs.writeFileSync(path.join(root,'portrait/artifacts/legacy-smokes.json'),JSON.stringify({checkedAt:new Date().toISOString(),results},null,2)+'\n');
for(const result of results)console.log(`${result.exitCode===0?'PASS':'FAIL (legacy)'} ${result.name}`);
