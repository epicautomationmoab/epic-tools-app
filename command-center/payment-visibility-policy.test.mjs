import test from 'node:test';
import assert from 'node:assert/strict';
import {canChangeGuestPaymentVisibility, requireNamedActor, visibilityAuditSummary} from './payment-visibility-policy.mjs';
test('deny generic workstation, missing and inactive actors',()=>{
 for(const actor of [null,{role:'workstation',id:'abc',active:true},{role:'agent',id:'abc',active:false},{role:'agent',active:true}]) {
  assert.equal(canChangeGuestPaymentVisibility(actor),false);
 }
});
test('allow active named agent and managers',()=>{
 for(const role of ['agent','manager','admin']) {
  assert.equal(requireNamedActor({id:'employee-id',role,active:true}).ok,true);
 }
});
test('old/new audit change is explicit and no-op is identifiable',()=>{
 assert.equal(visibilityAuditSummary({before:false,after:true,actorProfileId:'a',reservationId:'r'}).changed,true);
 assert.equal(visibilityAuditSummary({before:true,after:true,actorProfileId:'a',reservationId:'r'}).changed,false);
});
test('reject audit events with missing identifiers',()=>{
 assert.throws(()=>visibilityAuditSummary({before:false,after:true,actorProfileId:'',reservationId:'r'}));
});
