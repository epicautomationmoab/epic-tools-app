import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

type CommunicationRow = {
  id: string;
  confirmation_code: string;
  communication_type: string;
  guest_portal_token: string;
  customer_name: string;
  customer_email: string | null;
  attempt_count: number | null;
};

type GuestPortalRow = {
  product_display_name: string;
  visit_start_time: string;
  business_line: string | null;
  total_vehicle_count: number | null;
  epic_document_received_count: number | null;
  epic_document_expected_count: number | null;
  mpwr_document_received_count: number | null;
  mpwr_document_expected_count: number | null;
  ohv_certificate_uploaded: boolean | null;
};