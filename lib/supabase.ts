export type ReadinessRow = {
  visit_start_time: string;
  confirmation_code: string;
  customer_name: string;
  business_line: "tour" | "rental" | string;
  product_display_name: string;
  expected_guest_count: number | null;
  epic_document_count_label: string;
  epic_document_count_color: "green" | "yellow" | "red" | "gray" | string;
  mpwr_confirmation_number: string | null;
  amount_due_cents: number | null;
  is_paid: boolean | null;
  ohv