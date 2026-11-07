import {notFound} from "next/navigation";
export const dynamic="force-dynamic";
export default function StagingLayout({children}:{children:React.ReactNode}){
 if(process.env.EPIC_STAGING_NO_OUTBOUND!=="true" || process.env.NEXT_PUBLIC_SUPABASE_URL!=="https://cchsrkhpvvrvcuepkqdu.supabase.co")notFound();
 return children;
}
