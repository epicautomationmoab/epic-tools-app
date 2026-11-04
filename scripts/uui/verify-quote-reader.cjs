const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {NextRequest,NextResponse}=require('next/server');
let profile=null,requests=[],payload=[];
const ctx={exports:{},process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://jgpihdpcdlqugmqanzfj.supabase.co',SUPABASE_SECRET_KEY:'test-placeholder'}},require(n){if(n==='next/server')return {NextRequest,NextResponse};if(n==='@/lib/team-auth')return {getAuthenticatedTeamProfile:async()=>profile};if(n.includes('modules/sales'))return {POST:()=>{}};throw Error(n);},fetch:async(url,init)=>{requests.push({url,init});return new Response(JSON.stringify(payload));}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/sales/quotes/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,ctx);
const get=q=>ctx.exports.GET(new NextRequest('https://preview.example/api/sales/quotes'+q));
(async()=>{
 for(const p of [null,{active:false,role:'agent'},{active:true,role:'workstation'}]){profile=p;requests=[];assert.equal((await get('')).status,401);assert.equal(requests.length,0);}
 profile={active:true,role:'agent'};requests=[];assert.equal((await get('?limit=999999')).status,200);assert.equal(JSON.parse(requests[0].init.body).p_limit,100);
 requests=[];assert.equal((await get('?quote=invalid')).status,400);assert.equal(requests.length,0);
 payload=null;assert.equal((await get('?quote=00000000-0000-4000-8000-000000000001')).status,404);
 payload={quote:{id:'fixture'},activities:[]};const r=await get('?quote=00000000-0000-4000-8000-000000000001');assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.equal((await r.json()).quote.id,'fixture');
 console.log('Quote reader: denied unauthenticated/inactive/workstation, bounded list, UUID validation, 404 and authenticated detail verified (mocked transport).');
})().catch(e=>{console.error(e);process.exit(1)});
