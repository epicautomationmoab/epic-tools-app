const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function compile(file,context){vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);return context.exports;}
(async()=>{
 for(const path of ['/team/readiness','/sales/customers','/uui-home','/admin/users','/management/sales','/uui-login','/employee-login','/guest/test','/sales-other']){
  let effect,fetches=0,cleaned=0;const ctx={exports:{},require(n){if(n==='@/lib/employee-activity')return {recordEmployeeActivity(){}};if(n==='react')return {useEffect:f=>effect=f};if(n==='next/navigation')return {usePathname:()=>path};throw Error(n)},window:{location:{pathname:path,search:'',replace(){throw Error('unexpected redirect')}},setInterval:()=>1,clearInterval:()=>cleaned++,addEventListener(){},removeEventListener(){}},document:{addEventListener(){},removeEventListener(){}},fetch:async()=>{fetches++;return {ok:true}}};
  const c=compile('app/EmployeeSessionRefresher.tsx',ctx);c.default();const cleanup=effect();await Promise.resolve();assert.equal(fetches,['/team/readiness','/sales/customers','/uui-home','/admin/users','/management/sales'].includes(path)?1:0);if(cleanup){cleanup();assert.equal(cleaned,1)}
 }
 const {NextRequest,NextResponse}=require('next/server');let profile={active:true},refreshes=0;
 const ctx={exports:{},require(n){if(n==='next/server')return {NextRequest,NextResponse};return {authCookieOptions:maxAge=>({httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge}),getAuthenticatedTeamProfile:async()=>profile,refreshSessionWithRefreshToken:async()=>{refreshes++;return {access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600}}}}};
 const route=compile('app/api/auth/refresh-session/route.ts',ctx);assert.equal((await route.POST(new NextRequest('https://preview.example/api/auth/refresh-session',{method:'POST'}))).status,401);assert.equal(refreshes,0);
 const request=()=>new NextRequest('https://preview.example/api/auth/refresh-session',{method:'POST',headers:{cookie:'epic_refresh_token=fixture'}});
 let r=await route.POST(request());assert.equal(r.status,200);assert(r.cookies.get('epic_access_token'));assert(r.headers.get('set-cookie').includes('HttpOnly'));profile=null;r=await route.POST(request());assert.equal(r.status,401);assert.equal(r.cookies.getAll().length,0);
 console.log('Session renewal: all employee workspaces covered, login/guest/lookalike paths excluded, cleanup verified, absent/unauthorized refresh rejected, valid refresh retains secure HttpOnly cookies.');
})().catch(e=>{console.error(e);process.exit(1)});
