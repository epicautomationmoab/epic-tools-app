const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('modules/sales/app/customer-360/Customer360Modal.tsx','utf8');
const callback=source.split('const timeline=useMemo<EventItem[]>(()=>{')[1].split('},[data,leadSheets,shownTexts,mediaByEvent]);')[0];
const context={exports:{},data:{notes:[{id:'older',created_at:'2026-11-04T12:00:00Z',author_name:'Test',note_text:'Earlier note'}]},leadSheets:[{id:'saved-sheet',updated_at:'2026-11-05T12:00:00Z',fields:{notes:'Persisted discovery',disposition:'Researching'}}],shownTexts:[],mediaByEvent:{}};
vm.runInNewContext(ts.transpileModule('exports.result=(()=>{'+callback+'})();',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
assert.equal(context.exports.result.length,2);assert.equal(context.exports.result[0].id,'ls-saved-sheet');assert.equal(context.exports.result[0].body,'Persisted discovery');assert.equal(context.exports.result[1].id,'n-older');
console.log('C360 lifecycle includes saved Lead Sheet notes, with newest-first ordering beside existing history.');
