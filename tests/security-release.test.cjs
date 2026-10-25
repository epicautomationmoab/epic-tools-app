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
