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
