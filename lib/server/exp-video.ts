/** Server-owned video identity and duration. Browser-reported durations never
 * establish full-viewing credit. Vimeo may hide metadata on restricted domains. */
export const EXP_VIDEO_ID = "1239550688";
export const EXP_VIDEO_VERSION = "3.2";
export const EXP_ASSESSMENT_VERSION = "exp-2026-10-26-v1";
export async function expVideoDuration(): Promise<number | null> {
  const configured=Number(process.env.EXP_VIDEO_DURATION_SECONDS);
  if(Number.isInteger(configured)&&configured>=60&&configured<=1800)return configured;
  try {
    const origin=process.env.EXP_PUBLIC_ORIGIN?.replace(/\/+$/, "") || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
    const response=await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${EXP_VIDEO_ID}`)}`,{
      ...(origin?{headers:{Referer:origin}}:{}),next:{revalidate:60}
    });
    if(!response.ok)return null;
    const data=await response.json() as {video_id?:number;duration?:number;domain_status_code?:number};
    if(data.domain_status_code===403||String(data.video_id)!==EXP_VIDEO_ID)return null;
    const seconds=Math.ceil(Number(data.duration));
    return Number.isInteger(seconds)&&seconds>=60&&seconds<=1800?seconds:null;
  }catch{return null;}
}

/** oEmbed reports whole seconds; the player reports fractional seconds and the
 * browser rounds up. Permit that one-second representation difference only. */
export function matchesExpVideoDuration(reported:number|null,expected:number|null){
  return expected!==null&&reported!==null&&Math.abs(reported-expected)<=1;
}

/** Temporary, isolated staging-only QA shortcut. Never qualifies on production Supabase. */
export function expQaVideoThreshold(){
 const host=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^https?:\/\//,"").replace(/\/$/,"");
 return process.env.EPIC_STAGING_NO_OUTBOUND==="true" && host==="cchsrkhpvvrvcuepkqdu.supabase.co" && process.env.NEXT_PUBLIC_EXC_QA_VIDEO_10_PERCENT==="true" ? 0.1 : 0.98;
}
