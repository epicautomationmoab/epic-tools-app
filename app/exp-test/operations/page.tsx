import {redirect,notFound} from "next/navigation";
export default function LegacyExpPreview(){
 if(process.env.EPIC_STAGING_NO_OUTBOUND!=="true" || process.env.NEXT_PUBLIC_SUPABASE_URL!=="https://cchsrkhpvvrvcuepkqdu.supabase.co")notFound();
 redirect("/staging");
}
