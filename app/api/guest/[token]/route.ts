import { NextResponse } from "next/server";

type GuestPortalRow = {
  guest_portal_token: string;
  readiness_id: string;
  confirmation_code: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone_last_four: string | null;
  business_line: string;
  product_display_name: string;
  visit_start_time: string;
  rental_duration: string | null;
  expected_guest_count: number | null;
  total_vehicle_count: number | null;
  vehicle