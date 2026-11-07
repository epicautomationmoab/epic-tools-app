const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {NextRequest,NextResponse}=require('next/server');let profile=null,calls=[],failure=false;
const env={EPIC_STAGING_NO_OUTBOUND:'true'};
const ctx={exports:{},process:{env},require(n){if(n==='next/server')return {NextRequest,NextResponse};if(n.endsWith('/team-auth'))return {getAuthenticatedTeamProfile:async()=>profile};if(n.endsWith('/supabase-rest'))return {supabaseRpc:async(name,body)=>{calls.push({name,body});if(failure)throw Error('private details');return {readiness_id:body.p_readiness_id,status:'held'}}};throw Error(n)}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/deposits/detail/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,ctx);
const id='00000000-0000-4000-8000-000000000312';const req=value=>new NextRequest('https://preview.invalid/api/deposits/detail?readiness_id='+value);
(async()=>{
for(const p of [null,{active:false,role:'admin'},{active:true,role:'workstation'}]){profile=p;assert.equal((await ctx.exports.GET(req(id))).status,401)}assert.equal(calls.length,0);
profile={active:true,role:'agent',display_name:'Team Test'};assert.equal((await ctx.exports.GET(req('bad'))).status,400);assert.equal(calls.length,0);
let r=await ctx.exports.GET(req(id));assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal((await r.json()).readiness_id,id);assert.equal(calls.length,1);assert.equal(calls[0].name,'get_rental_damage_deposit');
delete env.EPIC_STAGING_NO_OUTBOUND;calls=[];await ctx.exports.GET(req(id));assert.equal(calls[0].name,'ensure_rental_damage_deposit');assert.equal(calls[0].body.p_updated_by,'Team Test');assert.equal(calls[1].name,'get_rental_damage_deposit');
failure=true;r=await ctx.exports.GET(req(id));assert.equal(r.status,502);assert.ok(!(await r.text()).includes('private details'));
console.log('Drawer deposit reader passed: employee auth, inactive/workstation denial, exact reservation ID, no-store, Preview read only, existing initializer retained outside Preview, sanitized errors.');
})().catch(e=>{console.error(e);process.exit(1)});
