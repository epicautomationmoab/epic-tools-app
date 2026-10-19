import { supabaseSelect } from "@/lib/server/supabase-rest";

export type FleetVehicle = {
  id: string;
  vehicle_number: number;
  model_family: string;
  model_year: number;
  vin: string | null;
  mpwr_vehicle_reference: string | null;
  current_mileage: number | null;
  current_engine_hours: number | null;
  last_service_mileage: number | null;
  last_service_at: string | null;
  service_interval_miles: number;
  last_weekly_inspection_at: string | null;
  operational_status: string;
  status_reason: string | null;
  in_service_date: string | null;
  active: boolean;
  booking_resource_id: string | null;
  booking_resource_name: string | null;
  booking_inventory_state: string;
  booking_inventory_reason: string | null;
  booking_sync_status: string;
  booking_sync_error: string | null;
  booking_synced_at: string | null;
  on_ride: boolean;
  on_ride_trip_order_id: string | null;
  on_ride_started_at: string | null;
  setup_needed: boolean;
  miles_until_service: number | null;
  service_status: string;
  inspection_status: string;
  next_weekly_inspection_due_at: string | null;
};

export async function getFleetVehicles() {
  return supabaseSelect<FleetVehicle>(
    "fleet_maintenance_dashboard_v2",
    new URLSearchParams({ select: "*", order: "vehicle_number.asc" }),
  );
}

export async function getFleetVehicle(vehicleNumber: number) {
  const rows = await supabaseSelect<FleetVehicle>(
    "fleet_maintenance_dashboard_v2",
    new URLSearchParams({
      select: "*",
      vehicle_number: `eq.${vehicleNumber}`,
      limit: "1",
    }),
  );
  return rows[0] ?? null;
}


export type FleetIncidentCase = {
  id: string;
  case_type: string;
  status: string;
  vehicle_number: string | null;
  confirmation_code: string | null;
  opened_at: string | null;
  closed_at: string | null;
  metadata: Record<string, unknown> | null;
};

export async function getFleetIncidentCases(vehicleNumber: number) {
  return supabaseSelect<FleetIncidentCase>(
    "operational_cases",
    new URLSearchParams({
      select: "id,case_type,status,vehicle_number,confirmation_code,opened_at,closed_at,metadata",
      vehicle_number: `eq.${vehicleNumber}`,
      order: "opened_at.desc",
    }),
  );
}


export type ActiveTechTimeRow = {
  vehicle_number: string;
  technician_name: string;
  entry_state: string;
  job_number: number;
  category: string;
};

export async function getActiveTechTimeRows() {
  return supabaseSelect<ActiveTechTimeRow>(
    "tech_time_board_v",
    new URLSearchParams({ select: "vehicle_number,technician_name,entry_state,job_number,category", order: "started_at.asc" }),
  );
}

export type FleetServiceRecord = {
  id: string;
  vehicle_id: string;
  vehicle_number: number;
  service_type: string;
  status: string;
  due_mileage: number | null;
  start_mileage: number | null;
  completion_mileage: number | null;
  technician_profile_id: string | null;
  technician_name: string | null;
  started_at: string | null;
  completed_at: string | null;
  parts_and_fluids_used: string | null;
  additional_concerns: string | null;
  mpwr_documented: boolean;
  full_inspection_completed: boolean;
  created_at: string;
  updated_at: string;
};

export type FleetServiceItem = {
  id: string;
  service_record_id: string;
  item_code: string;
  label: string;
  action_text: string;
  model_scope: string | null;
  status: string;
  notes: string | null;
  sort_order: number;
};

export async function getLatestFleetService(vehicleNumber: number) {
  const rows = await supabaseSelect<FleetServiceRecord>(
    "fleet_service_records",
    new URLSearchParams({
      select: "*",
      vehicle_number: `eq.${vehicleNumber}`,
      order: "created_at.desc",
      limit: "1",
    }),
  );
  const service = rows[0] ?? null;
  if (!service) return { service: null, items: [] as FleetServiceItem[] };
  const items = await supabaseSelect<FleetServiceItem>(
    "fleet_service_record_items",
    new URLSearchParams({
      select: "*",
      service_record_id: `eq.${service.id}`,
      order: "sort_order.asc",
    }),
  );
  return { service, items };
}
