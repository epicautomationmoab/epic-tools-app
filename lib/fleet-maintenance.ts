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
