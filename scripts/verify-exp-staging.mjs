/** Integration checks against disposable EXP fixtures. No production target allowed.
 * EXP_STAGING_URL, EXP_STAGING_COOKIE (Vercel + synthetic staff session) required.
 * This intentionally never fabricates video completion or contacts guests. */
import assert from 'node:assert/strict';
const base=process.env.EXP_STAGING_URL;
if(!base || !(base==="https://epic-tools-exp-staging.vercel.app" || /^https:\/\/epic-tools-exp-staging-[a-z0-9-]+\.vercel\.app$/.test(base)))throw Error('An isolated EXP staging deployment URL is required');
const cookie=process.env.EXP_STAGING_COOKIE;
if(!cookie)throw Error('Synthetic staging session cookie required');
const token='ee100000-0000-4000-8000-000000000002';
const readinessId='ee100000-0000-4000-8000-000000000003';
const results=[];
async function request(path,{method='GET',body,authenticated=true}={}){
 const headers={cookie:authenticated?cookie:cookie.split('; ').filter(c=>c.startsWith('_vercel_jwt=')).join('; ')};
 if(body && !(body instanceof FormData))headers['content-type']='application/json';
 const response=await fetch(base+path,{method,headers,...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{})});
 return {status:response.status,data:await response.json()};
}
function pass(name,condition){assert(condition,name);results.push({name,passed:true});console.log('PASS',name)}
const health=await request('/api/exp-staging-health');
pass('isolated database and outbound guards',health.status===200&&health.data.environment==='isolated_staging'&&health.data.checks.correctDatabase&&health.data.checks.noLiveSendingKeys);
const forms=await request(`/api/guest/${token}/guest-forms`);
pass('signed drivers discovered from stored agreements',forms.status===200&&['Avery Staging','Blake Staging','Casey Staging'].every(n=>forms.data.signedRentalDrivers.includes(n)));
const guest=await request(`/api/guest/${token}/exp/status`);
const staff=await request(`/api/team/exp/readiness?readinessId=${readinessId}`);
pass('guest and staff use the same readiness determination',guest.status===200&&staff.status===200&&guest.data.rentals[0].expReady===staff.data.expReady&&JSON.stringify(guest.data.rentals[0].outstanding)===JSON.stringify(staff.data.outstanding));
pass('all three drivers covered by certificates',staff.data.documentChecks.ohvCertificates===true&&staff.data.expectedDriverCount===3);
pass('unverified video cannot award EXP readiness',staff.data.videoVerificationAvailable || (!staff.data.expReady&&staff.data.assessmentQualifiedDriverCount===0));
const noStaff=await request(`/api/team/exp/readiness?readinessId=${readinessId}`,{authenticated:false});pass('staff endpoint requires staff authentication',noStaff.status===401);
const kiosk=await request('/api/kiosk/lookup',{method:'POST',body:{lastFour:'0982'}});pass('kiosk stays on the tested deployment',kiosk.status===200&&kiosk.data.portalPath===`${base}/guest/${token}`);
for(const [label,body,status] of [['short code',{lastFour:'1'},400],['honeypot',{lastFour:'0982',website:'bot'},404],['unknown code',{lastFour:'9999'},404]]){const r=await request('/api/kiosk/lookup',{method:'POST',body});pass(`kiosk rejects ${label}`,r.status===status)}
const uploads=await request(`/api/team/ohv?token=${token}`);pass('all uploaded certificates have retrieval links',uploads.status===200&&uploads.data.uploads.length===3&&uploads.data.uploads.every(u=>u.viewUrl));
for(const u of uploads.data.uploads){const response=await fetch(u.viewUrl);const bytes=Buffer.from(await response.arrayBuffer());pass(`stored PDF retrievable for ${u.driverName}`,response.ok&&bytes.subarray(0,5).toString()==='%PDF-');}
const file=Buffer.from('%PDF-1.4\n%%EOF');
for(const [label,name,type,bytes,status] of [['duplicate','Avery Staging','application/pdf',file,409],['unsigned identity','Unsigned Synthetic Driver','application/pdf',file,409],['unsupported type','Avery Staging','text/plain',file,415],['empty file','Avery Staging','application/pdf',Buffer.alloc(0),413]]){
 const body=new FormData();body.set('readinessId',readinessId);body.set('driverName',name);body.set('certificate',new Blob([bytes],{type}),'negative-test.pdf');const r=await request(`/api/guest/${token}/ohv`,{method:'POST',body});pass(`certificate rejects ${label}`,r.status===status);
}
const forbidden=await request('/api/guest-communications/send',{method:'POST',body:{}});pass('operational writes remain disabled',forbidden.status===403);
const ready=await request(`/api/guest/${token}/exp/assessment`,{method:'POST',body:{action:'start',readinessId}});pass('assessment starts without exposing answer keys',ready.status===200&&ready.data.questions.length===10&&!JSON.stringify(ready.data).includes('correctOptionId'));
const sessionId=ready.data.sessionId;
const wrong=await request(`/api/guest/355335d7-8546-47da-8603-93e16abbe194/exp/progress?readinessId=${readinessId}&sessionId=${sessionId}`);pass('reservation token cannot read another reservation session',wrong.status===404);
const badProgress=await request(`/api/guest/${token}/exp/progress`,{method:'PATCH',body:{readinessId,sessionId,videoWatchedSeconds:[-1]}});pass('invalid video checkpoint rejected',badProgress.status===400);
console.log(JSON.stringify({deployment:base,count:results.length,results},null,2));
