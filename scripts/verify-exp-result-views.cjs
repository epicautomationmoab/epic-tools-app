// Verify completion messaging never hides an individually ready driver or
// presents orientation-only completion as verified EXP readiness.
const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
function load(path){const out={};new Function('exports','require',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(out,id=>id.endsWith('.css')?{default:new Proxy({},{get:(_,key)=>key})}:require(id));return out.default}
const Result=load('app/guest/[token]/ExpAssessmentResult.tsx'),Intro=load('app/guest/[token]/ExpAssessmentRetryIntro.tsx');
const driver={name:'Jordan Test',expReady:true,orientationComplete:true,outstanding:[]};
function result(props){return renderToStaticMarkup(React.createElement(Result,{result:props,onExit(){}}))}
let html=result({status:'assessment_complete',expReady:false,participatingDrivers:[driver],otherDriversPending:true});
assert(html.includes('You’re Epic Xpress Ready!'));assert(html.includes('Jordan Test'));assert(html.includes('Other drivers on your reservation'));assert(!html.includes('One Last Step'));
console.log('PASS an individually ready driver is recognized while the party is pending');
html=result({status:'assessment_complete',expReady:false,participatingDrivers:[{...driver,expReady:false,outstanding:['ohvCertificate']}]});
assert(html.includes('Orientation Complete!'));assert(html.includes('OHV certificate still needed'));assert(!html.includes('You’re Epic Xpress Ready!'));
console.log('PASS orientation alone cannot display verified EXP readiness');
html=result({status:'assessment_complete',expReady:true,participatingDrivers:[driver],corrections:[{questionId:'x',correctAnswer:'Correct answer',explanation:'Review explanation'}]});
assert(html.includes('fastest check-out'));assert(html.includes('A Quick Review Before You Go'));assert(html.includes('Review explanation'));assert(!html.includes('One Last Step'));
console.log('PASS full completion celebrates readiness and preserves corrections');
for(const count of [1,2]){html=renderToStaticMarkup(React.createElement(Intro,{count}));assert(html.includes('finished all 10 questions'));assert(html.includes(`Review ${count} Safety`));assert(html.includes('other answers are saved'));}
console.log('PASS targeted reviews explain the transition from ten questions for singular and plural cases');
