export type VehicleBreakdownItem = {
  model: string;
  quantity: number;
};

export type ReadinessRow = {
  readiness_id?: string;
  visit_start_time: string;
  confirmation_code: string;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_phone_last_four?: string | null;
  business_line: "tour" |