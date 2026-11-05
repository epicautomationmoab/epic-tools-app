const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('node:assert/strict');
function load(path,deps={}){const e={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:e,Map,Set,URLSearchParams,process:{env:{EXP_ASSESSMENT_SERVER_ENABLED:'true'}},require:n=>{if(deps[n])return deps[n];throw Error(n)}});return e}
const {expExceptionReasons:reasons}=load('lib/exp/exception-reasons.ts');
const base={expReady:false,sessions:[],participants:[],drivers:[],outstanding:[]};
assert.equal(reasons(base).length,0);
const retry={...base,sessions:[{id:'old',created_at:'2026-11-01',outcome:'critical_retry'}],participants:[{session_id:'old',display_name:'Test Driver'}]};
assert.match(reasons(retry)[0],/retry/);
const latest={...retry,sessions:[...retry.sessions,{id:'new',created_at:'2026-11-02',outcome:'complete'}],participants:[...retry.participants,{session_id:'new',display_name:'test driver'}],drivers:[{orientationComplete:true}],outstanding:['ohvCertificates']};
assert.equal(reasons(latest).length,1);assert.match(reasons(latest)[0],/OHV/);assert(!reasons(latest).some(x=>/retry/.test(x)));
assert.equal(reasons({...latest,expReady:true}).length,0);
assert.match(reasons({...retry,sessions:[{id:'old',created_at:'2026-11-01',outcome:'in_progress',pause_reason:'technician'}]})[0],/assistance/);
let requested=[];
const reader=load('lib/server/exp-exceptions.ts',{
 './supabase-rest':{supabaseSelect:async(table)=>table==='epic_operational_handoffs'?[{readiness_id:'out',handoff_status:'rental_out'},{readiness_id:'returned',handoff_status:'rental_returned'}]:[{readiness_id:'out',handoff_status:'rental_out'},{readiness_id:'returned',handoff_status:'rental_returned'},{readiness_id:'open',handoff_status:null}]},
 './exp-readiness':{loadExpReadinessMany:async(ids)=>{requested=ids;return new Map([['open',latest]])}},
 '@/lib/exp/exception-reasons':{expExceptionReasons:reasons},
 '@/lib/exp/window':{expCheckoutClosed:s=>['rental_out','rental_returned'].includes(s)}
});
(async()=>{const rows=await reader.loadExpExceptions();assert.equal(rows.length,1);assert.equal(rows[0].readiness_id,'open');assert.deepEqual([...requested],['open']);console.log('EXC exceptions: optional not-started excluded; retry and assistance included; latest driver session supersedes old failures; pending documents retained; qualified and checked-out/returned excluded.');})().catch(e=>{console.error(e);process.exit(1)});
