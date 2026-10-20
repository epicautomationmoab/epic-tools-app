import test from 'node:test';
import assert from 'node:assert/strict';
import {hasPermission,visibleWorkspaces} from './auth-policy.mjs';
const profile=role=>({role,active:true});
test('missing, inactive or unknown roles are denied',()=>{
  assert.equal(hasPermission(null,'sales.view'),false);
  assert.equal(hasPermission({role:'manager',active:false},'audit.view'),false);
  assert.equal(hasPermission(profile('ownerish'),'audit.view'),false);
});
test('agent cannot view manager audit',()=>assert.equal(hasPermission(profile('agent'),'audit.view'),false));
test('manager sees audit activity but not sensitive sessions',()=>{
  assert.equal(hasPermission(profile('manager'),'audit.team_activity.view'),true);
  assert.equal(hasPermission(profile('manager'),'audit.sessions.view'),false);
});
test('admin may view sensitive sessions',()=>assert.equal(hasPermission(profile('admin'),'audit.sessions.view'),true));
test('workstation is restricted to readiness',()=>{
  assert.deepEqual(visibleWorkspaces(profile('workstation')).map(x=>x.id),['readiness']);
  assert.equal(hasPermission(profile('workstation'),'management.work'),false);
});
