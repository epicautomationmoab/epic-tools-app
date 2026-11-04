const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {NextRequest,NextResponse}=require('next/server');
let profile=null,requests=[],upstreamStatus=200;
const ctx={exports:{},URLSearchParams,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://jgpihdpcdlqugmqanzfj.supabase.co',SUPABASE_SECRET_KEY:'test-placeholder'}},require(n){if(n==='next/server')return {NextRequest,NextResponse};if(n==='@/lib/team-auth')return {getAuthenticatedTeamProfile:async()=>profile};throw Error(n);},fetch:async(url,init)=>{requests.push({url,init});return new Response(upstreamStatus===200?'[{"experience_id":"fixture"}]':'private upstream detail',{status:upstreamStatus});}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/sales/quote-catalog/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,ctx);
const get=kind=>ctx.exports.GET(new NextRequest('https://preview.example/api/sales/quote-catalog?kind='+encodeURIComponent(kind)));
(async()=>{
 for(const p of [null,{active:false,role:'agent'},{active:true,role:'workstation'}]){profile=p;requests=[];assert.equal((await get('rates')).status,401);assert.equal(requests.length,0);}
 profile={active:true,role:'agent'};
 for(const kind of ['rates','links','fees']){requests=[];const r=await get(kind);assert.equal(r.status,200);assert.equal((await r.json())[0].experience_id,'fixture');assert.equal(requests.length,1);assert.equal(requests[0].init.cache,'no-store');assert.equal(r.headers.get('Cache-Control'),'no-store');}
 requests=[];assert.equal((await get('../team_profiles')).status,400);assert.equal(requests.length,0);
 upstreamStatus=403;const r=await get('rates');assert.equal(r.status,502);assert.equal((await r.text()).includes('private upstream detail'),false);
 console.log('Quote catalog: anonymous/inactive/workstation denied, employee catalogs loaded, arbitrary resource rejected, upstream details hidden (mocked transport).');
})().catch(e=>{console.error(e);process.exit(1)});
