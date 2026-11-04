import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {expWalkthroughEnabled} from '@/lib/exp/staging-walkthrough';
const documents={jordan:()=>readFile(path.join(process.cwd(),'lib/exp/walkthrough-certificates/jordan.pdf')),morgan:()=>readFile(path.join(process.cwd(),'lib/exp/walkthrough-certificates/morgan.pdf')),taylor:()=>readFile(path.join(process.cwd(),'lib/exp/walkthrough-certificates/taylor.pdf'))};
export async function GET(_request:Request,{params}:{params:Promise<{driver:string}>}){
 const {driver}=await params;
 if(!expWalkthroughEnabled() || !Object.hasOwn(documents,driver))return new Response('Not found',{status:404});
 const bytes=await documents[driver as keyof typeof documents]();
 return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${driver}-Trailtest-TEST-OHV.pdf"`,'Cache-Control':'private, no-store'}});
}
