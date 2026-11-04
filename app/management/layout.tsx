import {requireUnifiedEmployee} from "@/lib/unified-session";
export default async function Layout({children}:{children:React.ReactNode}){await requireUnifiedEmployee(true);return children}
