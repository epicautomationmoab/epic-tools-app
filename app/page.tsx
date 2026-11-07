import {redirect} from "next/navigation";
import GuestReservationLookup from "./GuestReservationLookup";
export default function Home(){
 if(process.env.EPIC_STAGING_NO_OUTBOUND==="true" && process.env.NEXT_PUBLIC_SUPABASE_URL==="https://cchsrkhpvvrvcuepkqdu.supabase.co")redirect("/staging");
 return <GuestReservationLookup/>;
}
