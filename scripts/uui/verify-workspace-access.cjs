const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
let profile=null;
const ctx={exports:{},require(name){
 if(name==='next/headers')return {cookies:async()=>({get:()=>({value:'test-session'})})};
 if(name==='next/navigation')return {redirect:url=>{throw new Error('redirect:'+url)}};
 if(name==='./team-auth')return {getAuthenticatedTeamProfile:async()=>profile};
 throw Error(name);
}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/unified-session.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,ctx);
(async()=>{
 let checks=0;
 for(const role of [null,'workstation','agent','manager','admin'])for(const management of [false,true]){
  profile=role?{id:'test-profile',role,active:true}:null;
  const redirect=!role||role==='workstation'?'/uui-login':management&&role==='agent'?'/uui-home':null;
  if(redirect)await assert.rejects(()=>ctx.exports.requireUnifiedEmployee(management),{message:'redirect:'+redirect});
  else assert.equal((await ctx.exports.requireUnifiedEmployee(management)).role,role);
  checks++;
 }
 console.log(`${checks} workspace authorization checks passed (mocked profile lookup).`);
})().catch(e=>{console.error(e);process.exit(1)});
