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
  miles_until_service: number | null;
  service_status: string;
  inspection_status: string;
  next_weekly_inspection_due_at: string | null;
};

export async function getFleetVehicles() {
  return supabaseSelect<FleetVehicle>(
    "fleet_maintenance_dashboard_v",
    new URLSearchParams({ select: "*", order: "vehicle_number.asc" }),
  );
}

export async function getFleetVehicle(vehicleNumber: number) {
  const rows = await supabaseSelect<FleetVehicle>(
    "fleet_maintenance_dashboard_v",
    new URLSearchParams({
      select: "*",
      vehicle_number: `eq.${vehicleNumber}`,
      limit: "1",
    }),
  );
  return rows[0] ?? null;
}
