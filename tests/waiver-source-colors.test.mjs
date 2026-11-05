import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
const source=readFileSync(new URL('../app/team/readiness/SignedWaiverDrawerEnhancer.tsx',import.meta.url),'utf8');
const code=stripTypeScriptTypes(source.replace(/^import .*;$/gm,'').replace('export default function','function'));
for(const heading of ['Epic Documents 3','Epic Agreements 3']) {
 test(`${heading} receives Epic and TripWorks source classes`,()=>{
  const links=['/api/team/waivers/a/pdf','https://cdn-images.tripworks.com/b.pdf'].map(href=>({getAttribute:()=>href,classList:{classes:new Set(),remove(...names){names.forEach(n=>this.classes.delete(n))},add(n){this.classes.add(n)}}}));
  const section={querySelector:()=>({textContent:heading}),querySelectorAll:()=>links};
  runInNewContext(code+';styleSourceLinks(epicDocumentsSection());',{document:{querySelectorAll:()=>[section]},sourceStyles:{epicWaiverLink:'epic',tripWorksWaiverLink:'tw'}});
  assert.deepEqual([...links[0].classList.classes],['epic']);
  assert.deepEqual([...links[1].classList.classes],['tw']);
 });
}
test('approved source colors remain teal and blue',()=>{
 const css=readFileSync(new URL('../app/team/readiness/WaiverSourceLinks.module.css',import.meta.url),'utf8');
 assert.match(css,/\.epicWaiverLink\s*\{\s*color: #16756b !important;/);
 assert.match(css,/\.tripWorksWaiverLink\s*\{\s*color: #1689e8 !important;/);
});
