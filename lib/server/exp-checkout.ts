import {supabaseSelect} from './supabase-rest';
import {expCheckoutClosed} from '@/lib/exp/window';
// Call only after confirming the guest token owns this readiness item.
export async function expItemCheckedOut(readinessId:string) {
 const rows=await supabaseSelect<{handoff_status:string|null}>('epic_operational_handoffs',new URLSearchParams({select:'handoff_status',readiness_id:'eq.'+readinessId,limit:'1'}));
 return expCheckoutClosed(rows[0]?.handoff_status);
}
