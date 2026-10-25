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
