import { getReadinessRows } from "@/lib/supabase";
import JourneyPreviewClient from "./JourneyPreviewClient";

export default async function CustomerJourneyPreviewPage() {
  const rows = await getReadinessRows();
  return <JourneyPreviewClient rows={rows} />;
}
