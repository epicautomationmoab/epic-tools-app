/** Public synthetic fixture identifiers. These are never real guests. */
export const EXP_WALKTHROUGH={confirmation:'EXP-WALKTHROUGH-20261027',portalToken:'ee200000-0000-4000-8000-000000000002',readinessId:'ee200000-0000-4000-8000-000000000003',waiverToken:'exp-walkthrough-waiver-20261027',kioskCode:'0983',date:'2026-10-28'};
export const EXP_SAMPLE_SIGNERS=['Jordan','Morgan','Taylor'].map(firstName=>({firstName,lastName:'Trailtest',email:firstName.toLowerCase()+'@example.invalid',phone:'+12025550983',dob:'1988-01-01'}));
export function expWalkthroughEnabled(){return process.env.EPIC_STAGING_NO_OUTBOUND==='true' && process.env.NEXT_PUBLIC_SUPABASE_URL==='https://cchsrkhpvvrvcuepkqdu.supabase.co'}
