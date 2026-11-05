import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeReadinessDocuments } from '../lib/readiness-document-links.ts';
const evidence = (id, source = 'epic', name = 'Test Guest', url = `waivers/session/${id}.pdf`) => ({waiver_id:id, document_source:source, signer_name:name, signed_pdf_url:url, waiver_is_adult:true, signer_category:'adult_signer'});
const owned = id => ({id, signer_full_name:'Test Guest'});
test('three signatures appearing in both sources produce three working links', () => {
  const ids=['a','b','c'];
  const result=mergeReadinessDocuments(ids.map(id=>evidence(id)),ids.map(owned));
  assert.equal(result.length,3);
  assert.deepEqual(result.map(d=>d.document_url),ids.map(id=>`/api/team/waivers/${id}/pdf`));
});
test('Epic evidence without a second copy still uses the PDF endpoint',()=>{
  assert.equal(mergeReadinessDocuments([evidence('a')],[])[0].document_url,'/api/team/waivers/a/pdf');
});
test('distinct documents and same-name guests are preserved',()=>{
  assert.equal(mergeReadinessDocuments([evidence('a','tripworks','Test Guest','https://cdn-images.tripworks.com/a.pdf')],[owned('a'),owned('b')]).length,3);
});
test('duplicate evidence and owned records collapse by source and ID',()=>{
  assert.equal(mergeReadinessDocuments([evidence('a'),evidence('a')],[owned('b'),owned('b')]).length,2);
});
test('TripWorks link and minor status remain intact',()=>{
  const row={...evidence('tw','tripworks','Child','https://cdn-images.tripworks.com/tw.pdf'),waiver_is_adult:false};
  const [result]=mergeReadinessDocuments([row],[]);
  assert.equal(result.document_url,row.signed_pdf_url);
  assert.equal(result.is_minor_or_child,true);
});
test('invalid external paths are not clickable',()=>{
  for(const path of ['waivers/a.pdf','javascript:alert(1)',null]) {
    assert.equal(mergeReadinessDocuments([evidence('x','tripworks','Guest',path)],[])[0].document_url,null);
  }
});
