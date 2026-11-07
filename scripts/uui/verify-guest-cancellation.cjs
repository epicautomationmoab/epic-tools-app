const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const {NextResponse}=require('next/server');
let row,reads,patches,rpcs,race;
const reset=()=>{row={id:'test',status:'created',expires_at:new Date(Date.now()+3600000).toISOString(),opened_at:null,policy_version:'test-v1'};reads=0;patches=[];rpcs=[];race=false};
const ctx={exports:{},URLSearchParams,Date,require(name){if(name==='node:crypto')return require(name);if(name==='next/server')return {NextResponse};if(name.endsWith('/supabase-rest'))return {
 supabaseSelect:async()=>{reads++;return row?[{...row}]:[]},
 supabasePatch:async(table,filters,patch)=>{patches.push({table,filters,patch});if(race){row.status='accepted';row.accepted_at=new Date().toISOString()}if(filters.get('status')==='in.(created,sent)'&&!['created','sent'].includes(row.status))return;Object.assign(row,patch)},
 supabaseRpc:async(name,args)=>{rpcs.push({name,args});return {accepted:true,acceptanceId:'synthetic',acceptedAt:'2026-11-07T00:00:00Z'}}};throw Error(name)}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/agreements/[token]/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,ctx);
const context={params:Promise.resolve({token:'synthetic-token-for-unit-tests-only-12345'})};
const req=body=>new Request('https://preview.invalid/api/agreements/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
(async()=>{
 reset();race=true;let response=await ctx.exports.GET(new Request('https://preview.invalid'),context);assert.equal((await response.json()).agreement.status,'accepted');assert.equal(row.status,'accepted');assert.equal(patches[0].filters.get('status'),'in.(created,sent)');
 reset();await ctx.exports.GET(new Request('https://preview.invalid'),context);assert.equal(row.status,'opened');
 reset();row.status='accepted';row.expires_at='2000-01-01';response=await ctx.exports.GET(new Request('https://preview.invalid'),context);assert.equal(response.status,200);assert.equal(patches.length,0);
 reset();row.expires_at='2000-01-01';assert.equal((await ctx.exports.GET(new Request('https://preview.invalid'),context)).status,410);assert.equal(row.status,'expired');
 for(const body of [null,{}, {agreed:true,signerName:42}, {agreed:true,signerName:'Test',signatureDataUrl:42}]){reset();assert.equal((await ctx.exports.POST(req(body),context)).status,400);assert.equal(rpcs.length,0)}
 reset();response=await ctx.exports.POST(req({agreed:true,signerName:'Synthetic Test',signatureDataUrl:'data:image/png;base64,UNIT_TEST_ONLY'}),context);assert.equal(response.status,200);assert.equal(rpcs[0].name,'record_cancellation_agreement_acceptance');assert.equal(rpcs[0].args.p_signer_name,'Synthetic Test');assert.equal(rpcs[0].args.p_token_hash.length,64);
 console.log('Guest cancellation checks passed: concurrent acceptance preserved, open/expiry behavior, accepted history retained, malformed input rejected, existing acceptance RPC used. Mock storage only; no legal signature submitted.');
})().catch(e=>{console.error(e);process.exit(1)});
