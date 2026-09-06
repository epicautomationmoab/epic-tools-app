import TeamReadinessPage from "../page";
import { getReadinessRows } from "@/lib/supabase";
import JourneyPreviewOverlay from "./JourneyPreviewOverlay";

export const dynamic = "force-dynamic";

export default async function CustomerJourneyPreviewPage() {
  const rows = await getReadinessRows();

  return (
    <>
      <TeamReadinessPage />
      <JourneyPreviewOverlay rows={rows} />
    </>
  );
}
