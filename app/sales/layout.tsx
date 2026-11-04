import {requireUnifiedEmployee} from "@/lib/unified-session";
import Customer360Enhancer from "@/modules/sales/app/customer-360/Customer360Enhancer";
import CancellationAutoPopup from "@/modules/sales/app/customer-360/CancellationAutoPopup";
import "./sales-scoped.css";
export default async function Layout({children}:{children:React.ReactNode}){await requireUnifiedEmployee();return <div className="uuiSales"><Customer360Enhancer/>{children}<CancellationAutoPopup/></div>}
