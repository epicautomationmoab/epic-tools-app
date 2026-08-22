import Link from "next/link";
import TeamSidebar from "../../../TeamSidebar";
import HeaderClock from "../../../readiness/HeaderClock";
import LogoutButton from "../../../readiness/LogoutButton";
import styles from "../../../readiness/ReadinessShell.module.css";
import { supabaseSelect } from "@/lib/server/supabase-rest";
import DamageDocumentationClient from "./DamageDocumentationClient";

type CaseRow = {
  id: string;
  operational_reservation_id: string | null;
  confirmation_code: string | null;
  business_line: string | null;
  case_type: string;
  status: string;
  vehicle_number: string | null;
  opened_by: string | null;
  opened_at: string;
  metadata: Record<string, unknown> | null;
};

type Reservation = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  experience_name: string | null;
  start_time: string | null;
};

type Workflow = {
  id: string;
  workflow_status: string;
  metadata: Record<string, unknown> | null;
};

type DamageItem = {
  id: string;
  item_order: number;
  area_component: string | null;
  description: string | null;
  disposition: string | null;
  possible_hidden_damage: boolean;
  internal_notes: string | null;
};

type Evidence = {
  id: string;
  damage_item_id: string | null;
  photo_slot: string | null;
  original_filename: string | null;
  content_type: string | null;
  byte_size: number | null;
  uploaded_at: string;
};

export default async function DamageCasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const cases = await supabaseSelect<CaseRow>("operational_cases", new URLSearchParams({
    select: "id,operational_reservation_id,confirmation_code,business_line,case_type,status,vehicle_number,opened_by,opened_at,metadata",
    id: `eq.${caseId}`,
    limit: "1",
  }));
  const caseRow = cases[0];

  if (!caseRow) {
    return <div className={styles.page}><TeamSidebar active="Incident & Damage" /><main className={styles.main}><section className={styles.content}>Case not found.</section></main></div>;
  }

  let reservation: Reservation | null = null;
  if (caseRow.operational_reservation_id) {
    const rows = await supabaseSelect<Reservation>("operational_reservations", new URLSearchParams({
      select: "id,customer_name,customer_phone,customer_email,experience_name,start_time",
      id: `eq.${caseRow.operational_reservation_id}`,
      limit: "1",
    }));
    reservation = rows[0] ?? null;
  }

  const workflows = await supabaseSelect<Workflow>("operational_case_workflows", new URLSearchParams({
    select: "id,workflow_status,metadata",
    case_id: `eq.${caseId}`,
    workflow_type: "eq.damage_documentation",
    limit: "1",
  }));
  const workflow = workflows[0] ?? null;

  const items = workflow ? await supabaseSelect<DamageItem>("operational_case_damage_items", new URLSearchParams({
    select: "id,item_order,area_component,description,disposition,possible_hidden_damage,internal_notes",
    case_id: `eq.${caseId}`,
    workflow_id: `eq.${workflow.id}`,
    order: "item_order.asc,created_at.asc",
  })) : [];

  const evidence = await supabaseSelect<Evidence>("operational_case_evidence", new URLSearchParams({
    select: "id,damage_item_id,photo_slot,original_filename,content_type,byte_size,uploaded_at",
    case_id: `eq.${caseId}`,
    source_type: "eq.staff_damage_documentation",
    order: "created_at.asc",
  }));

  let guestAcknowledgmentStatus: string | null = null;
  if (caseRow.confirmation_code) {
    const templates = await supabaseSelect<{ id: string }>("guest_form_templates", new URLSearchParams({
      select: "id",
      template_key: "eq.damage_acknowledgment",
      is_active: "eq.true",
      limit: "1",
    }));
    if (templates[0]) {
      const tasks = await supabaseSelect<{ task_status: string }>("guest_form_tasks", new URLSearchParams({
        select: "task_status",
        confirmation_code: `eq.${caseRow.confirmation_code}`,
        template_id: `eq.${templates[0].id}`,
        task_status: "not.in.(cancelled,expired)",
        order: "created_at.desc",
        limit: "1",
      }));
      guestAcknowledgmentStatus = tasks[0]?.task_status ?? null;
    }
  }

  return (
    <div className={styles.page}>
      <TeamSidebar active="Incident & Damage" />
      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.titleBlock}>
            <h1>Damage Case</h1>
            <HeaderClock />
          </div>
          <div className={styles.headerActions}>
            <Link className={styles.actionButton} href="/team/incident-damage">Incident & Damage</Link>
            <LogoutButton />
          </div>
        </header>
        <section className={styles.content}>
          <DamageDocumentationClient
            caseId={caseRow.id}
            confirmationCode={caseRow.confirmation_code}
            vehicleNumber={caseRow.vehicle_number}
            caseStatus={caseRow.status}
            openedBy={caseRow.opened_by}
            openingNote={typeof caseRow.metadata?.opening_note === "string" ? caseRow.metadata.opening_note : ""}
            reservation={reservation}
            workflow={workflow}
            initialItems={items}
            initialEvidence={evidence}
            guestAcknowledgmentStatus={guestAcknowledgmentStatus}
          />
        </section>
      </main>
    </div>
  );
}
