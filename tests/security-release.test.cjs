const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const read = (file) => fs.readFileSync(file, "utf8");
test("every privileged Readiness route verifies employee identity and denies workstation", () => {
  for (const name of ["handoff","no-show","finance","people-override","contact-override","legacy-note","courtesy-call","mpwr-override","adventure-assure","notes"]) {
    const code = read("app/api/team/readiness/" + name + "/route.ts");
    assert.match(code, /getAuthenticatedTeamProfile/, name);
    assert.match(code, /workstation/, name);
  }
});
test("shared session cannot authorize sensitive actions", () => {
  const code = read("lib/server/action-identity.ts");
  assert.match(code, /getAuthenticatedTeamProfile/);
  assert.match(code, /role === "workstation"/);
});
test("public arrival board never sends reservation confirmation codes", () => {
  const page = read("app/team/arrival-board/page.tsx");
  const board = read("app/team/arrival-board/ArrivalBoardDisplay.tsx");
  assert.match(page, /displayGuestName\(row.customer_name\)/);
  assert.doesNotMatch(page, /confirmation_code:/);
  assert.doesNotMatch(board, /row.confirmation_code/);
});

test("middleware sends unauthenticated team traffic to employee login", () => {
  const code = read("middleware.ts");
  assert.match(code, /hasEmployeeSession/);
  assert.match(code, /pathname\.startsWith\("\/team"\)/);
  assert.match(code, /new URL\("\/employee-login"/);
  assert.match(code, /guestArrivalBoard/);
});
test("privileged readiness routes do not use preview-password authorization", () => {
  for (const name of ["handoff","no-show","finance","people-override","contact-override","legacy-note","courtesy-call","mpwr-override","adventure-assure","notes"]) {
    const code = read("app/api/team/readiness/" + name + "/route.ts");
    assert.doesNotMatch(code, /requestHasEpicToolsAccess/, name);
    assert.doesNotMatch(code, /actorPin/, name);
  }
});
test("server action identity does not permit caller supplied actor name", () => {
  const code = read("lib/server/action-identity.ts");
  assert.match(code, /actorName: profile\.display_name/);
  assert.match(code, /sharedSession: false/);
});

test("middleware behavior: unauthenticated staff redirected; lobby and kiosk remain public", async () => {
  const ts = require("typescript");
  const vm = require("node:vm");
  const source = read("middleware.ts");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const redirects = [];
  const NextResponse = {
    redirect(url) { redirects.push(String(url)); return { kind: "redirect", url: String(url) }; },
    next() { return { kind: "next" }; },
  };
  const sandbox = { exports: {}, require(name) { if (name === "next/server") return { NextResponse }; throw new Error(name); }, URL };
  vm.runInNewContext(js, sandbox, { filename: "middleware.js" });
  const request = (path, token) => ({
    cookies: { get() { return token ? { value: token } : undefined; } },
    nextUrl: { pathname: path, clone() { return { pathname: path }; } },
    url: "https://preview.example" + path,
    headers: { get() { return "preview.example"; } },
  });
  const middleware = sandbox.exports.middleware;
  assert.equal((await middleware(request("/team/readiness"))).kind, "redirect");
  assert.match(redirects[0], /\/employee-login$/);
  assert.equal((await middleware(request("/team/readiness", "mock-token"))).kind, "next");
  assert.equal((await middleware(request("/team/arrival-board"))).kind, "next");
  assert.equal((await middleware(request("/kiosk"))).kind, "next");
});

test("handoff API rejects missing and workstation identities, permits valid employee", async () => {
  const ts = require("typescript");
  const vm = require("node:vm");
  const source = read("app/api/team/readiness/handoff/route.ts");
  const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  let identity = null;
  const calls = [];
  const response = { json(body, options = {}) { return { body, status: options.status || 200 }; } };
  const sandbox = { exports:{}, require(name) {
    if (name === "next/server") return {NextResponse:response};
    if (name === "@/lib/team-auth") return {getAuthenticatedTeamProfile:async () => identity};
    throw new Error("unexpected module: "+name);
  }, process:{env:{NEXT_PUBLIC_SUPABASE_URL:"https://stub.invalid",SUPABASE_SECRET_KEY:"test-only"}}, fetch:async (url,init) => {calls.push({url,init});return {ok:true,status:200};} };
  vm.runInNewContext(js,sandbox,{filename:"handoff-route.js"});
  const request = (body) => ({cookies:{get(){return undefined;}},json:async()=>body});
  const valid = {readiness_id:"123e4567-e89b-42d3-a456-426614174000",handoff_status:"checked_in"};
  assert.equal((await sandbox.exports.POST(request(valid))).status,401);
  assert.equal(calls.length,0);
  identity={role:"workstation",display_name:"Shared"};
  assert.equal((await sandbox.exports.POST(request(valid))).status,401);
  assert.equal(calls.length,0);
  identity={role:"agent",display_name:"Test Employee"};
  assert.equal((await sandbox.exports.POST(request({...valid,actorDisplayName:"Forged Actor"}))).status,200);
  assert.equal(calls.length,1);
  assert.equal(JSON.parse(calls[0].init.body).p_recorded_by,"Test Employee");
  assert.equal((await sandbox.exports.POST(request({...valid,handoff_status:"unexpected"}))).status,400);
  assert.equal(calls.length,1);
});

function mockedRoute(path, identity) {
  const ts=require("typescript"),vm=require("node:vm");
  let current=identity,calls=[];
  const response={json(body,options={}){return {body,status:options.status||200};}};
  const sandbox={exports:{},URL,require(name){
    if(name==="next/server")return {NextResponse:response};
    if(name==="@/lib/team-auth")return {getAuthenticatedTeamProfile:async()=>current,listTeamProfiles:async()=>[],listSupabaseAuthUsers:async()=>[]};
    throw Error("unexpected import "+name);
  },process:{env:{NEXT_PUBLIC_SUPABASE_URL:"https://mock.invalid",SUPABASE_SECRET_KEY:"mock-key"}},fetch:async(url,init)=>{calls.push({url,init});return {ok:true,status:200,json:async()=>({}),text:async()=>("{}")};}};
  const js=ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(js,sandbox);
  return {route:sandbox.exports,setIdentity(x){current=x},calls,request(body){return {cookies:{get(){return undefined}},json:async()=>body}}};
}
test("finance API blocks workstation and invalid deposit changes without database calls",async()=>{
  const t=mockedRoute("app/api/team/readiness/finance/route.ts",null);
  const id="123e4567-e89b-42d3-a456-426614174000";
  const input={operation:"set_rental_damage_deposit_basis",readiness_id:id,basis:"standard"};
  assert.equal((await t.route.POST(t.request(input))).status,401);
  t.setIdentity({role:"workstation",display_name:"Shared"});
  assert.equal((await t.route.POST(t.request(input))).status,401);
  t.setIdentity({role:"agent",display_name:"Employee One"});
  assert.equal((await t.route.POST(t.request({...input,basis:"invalid"}))).status,400);
  assert.equal(t.calls.length,0);
  assert.equal((await t.route.POST(t.request(input))).status,200);
  assert.equal(JSON.parse(t.calls[0].init.body).p_updated_by,"Employee One");
});
test("no-show API checks identity and boolean before any database update",async()=>{
  const t=mockedRoute("app/api/team/readiness/no-show/route.ts",null);
  const input={readiness_id:"123e4567-e89b-42d3-a456-426614174000",is_no_show:true};
  assert.equal((await t.route.POST(t.request(input))).status,401);
  t.setIdentity({role:"workstation",display_name:"Shared"});
  assert.equal((await t.route.POST(t.request(input))).status,401);
  t.setIdentity({role:"agent",display_name:"Employee Two"});
  assert.equal((await t.route.POST(t.request({...input,is_no_show:"yes"}))).status,400);
  assert.equal(t.calls.length,0);
  assert.equal((await t.route.POST(t.request(input))).status,200);
  assert.equal(JSON.parse(t.calls[0].init.body).p_marked_by,"Employee Two");
});
test("team invites endpoint restricts access to managers and administrators",async()=>{
  const t=mockedRoute("app/api/admin/team-invites/route.ts",null);
  assert.equal((await t.route.GET(t.request({}))).status,401);
  t.setIdentity({role:"agent",display_name:"Employee"});
  assert.equal((await t.route.GET(t.request({}))).status,401);
  t.setIdentity({role:"workstation",display_name:"Shared"});
  assert.equal((await t.route.GET(t.request({}))).status,401);
  assert.equal(t.calls.length,0);
  const code=read("app/api/admin/team-invites/route.ts");
  assert.match(code,/profile\?\.role === "admin" \|\| profile\?\.role === "manager"/);
});

test("manager and admin may list team profiles without changing records",async()=>{
  const t=mockedRoute("app/api/admin/team-invites/route.ts",{role:"manager",display_name:"Test Manager"});
  const managerResult=await t.route.GET(t.request({}));
  assert.equal(managerResult.status,200);
  assert.equal(Array.from(managerResult.body.profiles).length,0);
  t.setIdentity({role:"admin",display_name:"Test Administrator"});
  const adminResult=await t.route.GET(t.request({}));
  assert.equal(adminResult.status,200);
  assert.equal(Array.from(adminResult.body.profiles).length,0);
  assert.equal(t.calls.length,0);
});

test("people override enforces employee identity, bounds and server actor",async()=>{
 const t=mockedRoute("app/api/team/readiness/people-override/route.ts",null);
 const input={operation:"set_readiness_people_override",readiness_id:"123e4567-e89b-42d3-a456-426614174000",people_count:4,reason:"Guest count correction"};
 assert.equal((await t.route.POST(t.request(input))).status,401);
 t.setIdentity({role:"workstation",display_name:"Shared"});
 assert.equal((await t.route.POST(t.request(input))).status,401);
 t.setIdentity({role:"agent",display_name:"Employee Verified"});
 assert.equal((await t.route.POST(t.request({...input,people_count:101}))).status,400);
 assert.equal((await t.route.POST(t.request({...input,reason:""}))).status,400);
 assert.equal(t.calls.length,0);
 assert.equal((await t.route.POST(t.request({...input,actorDisplayName:"Forged"}))).status,200);
 assert.equal(JSON.parse(t.calls[0].init.body).p_updated_by,"Employee Verified");
});
test("guest contact update rejects invalid data and uses authenticated actor",async()=>{
 const t=mockedRoute("app/api/team/readiness/contact-override/route.ts",null);
 const input={confirmation_code:"EPIC-TEST",field:"email",value:"guest@example.invalid"};
 assert.equal((await t.route.POST(t.request(input))).status,401);
 t.setIdentity({role:"agent",display_name:"Contact Employee"});
 assert.equal((await t.route.POST(t.request({...input,value:"not-email"}))).status,400);
 assert.equal(t.calls.length,0);
 assert.equal((await t.route.POST(t.request(input))).status,200);
 assert.equal(JSON.parse(t.calls[0].init.body).p_updated_by,"Contact Employee");
});
test("coverage update rejects unsupported level before database mutation",async()=>{
 const t=mockedRoute("app/api/team/readiness/adventure-assure/route.ts",null);
 const input={readiness_id:"123e4567-e89b-42d3-a456-426614174000",level:"Premier"};
 assert.equal((await t.route.POST(t.request(input))).status,401);
 t.setIdentity({role:"agent",display_name:"Coverage Employee"});
 assert.equal((await t.route.POST(t.request({...input,level:"Unauthorized"}))).status,400);
 assert.equal(t.calls.length,0);
 assert.equal((await t.route.POST(t.request(input))).status,200);
 assert.equal(JSON.parse(t.calls[0].init.body).p_updated_by,"Coverage Employee");
});

test("courtesy call validates all input and uses authenticated employee",async()=>{
 const t=mockedRoute("app/api/team/readiness/courtesy-call/route.ts",null);
 const input={readiness_id:"123e4567-e89b-42d3-a456-426614174000",arrival_confirmed:true,location_discussed:false,call_outcome:"Reached guest",notes:"Confirmed"};
 assert.equal((await t.route.POST(t.request(input))).status,401);
 t.setIdentity({role:"workstation",display_name:"Shared"});
 assert.equal((await t.route.POST(t.request(input))).status,401);
 t.setIdentity({role:"agent",display_name:"Verified Employee"});
 assert.equal((await t.route.POST(t.request({...input,arrival_confirmed:"true"}))).status,400);
 assert.equal(t.calls.length,0);
 assert.equal((await t.route.POST(t.request(input))).status,200);
 assert.equal(JSON.parse(t.calls[0].init.body).p_completed_by,"Verified Employee");
});
test("MPWR waiver override rejects unsafe URL and shared workstation",async()=>{
 const t=mockedRoute("app/api/team/readiness/mpwr-override/route.ts",null);
 const input={readiness_id:"123e4567-e89b-42d3-a456-426614174000",confirmation_number:"EXAMPLE",waiver_url:"https://example.invalid/waiver"};
 assert.equal((await t.route.POST(t.request(input))).status,401);
 t.setIdentity({role:"workstation",display_name:"Shared"});
 assert.equal((await t.route.POST(t.request(input))).status,401);
 t.setIdentity({role:"agent",display_name:"Verified"});
 assert.equal((await t.route.POST(t.request({...input,waiver_url:"http://example.invalid"}))).status,400);
 assert.equal(t.calls.length,0);
 assert.equal((await t.route.POST(t.request(input))).status,200);
 assert.equal(t.calls.length,1);
});
test("legacy readiness notes reject oversize data and unauthenticated requests",async()=>{
 const t=mockedRoute("app/api/team/readiness/legacy-note/route.ts",null);
 const input={readiness_id:"123e4567-e89b-42d3-a456-426614174000",notes:"Test note"};
 assert.equal((await t.route.POST(t.request(input))).status,401);
 t.setIdentity({role:"agent",display_name:"Verified"});
 assert.equal((await t.route.POST(t.request({...input,notes:"x".repeat(10001)}))).status,400);
 assert.equal(t.calls.length,0);
 assert.equal((await t.route.POST(t.request(input))).status,200);
 assert.equal(t.calls.length,1);
});
