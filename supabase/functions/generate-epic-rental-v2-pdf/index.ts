import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const ACCENT = rgb(219 / 255, 94 / 255, 37 / 255);
const CHARCOAL = rgb(41 / 255, 45 / 255, 50 / 255);
const MUTED = rgb(104 / 255, 112 / 255, 120 / 255);
const LIGHT = rgb(250 / 255, 248 / 255, 244 / 255);
const BORDER = rgb(221 / 255, 216 / 255, 208 / 255);
const PDF_LAYOUT_VERSION = "rental-v2";

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&rsquo;|&#8217;/gi, "'")
    .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/&ndash;|&#8211;/gi, "-")
    .replace(/&mdash;|&#8212;/gi, "-")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[\u00a0\u202f]/g, " ");
}

function htmlToBlocks(html: string | null | undefined) {
  if (!html) return [] as { text: string; heading: boolean }[];
  const withMarkers = html
    .replace(/<h[1-4]\b[^>]*>/gi, "\n\n[[HEADING]]")
    .replace(/<\/h[1-4]>/gi, "[[/HEADING]]\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/(p|li|ol|ul|div)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "");

  return decodeEntities(withMarkers)
    .split(/\n\s*\n+/)
    .map((raw) => raw.replace(/[ \t]+/g, " ").replace(/\n+/g, " ").trim())
    .filter(Boolean)
    .map((text) => ({
      heading: text.includes("[[HEADING]]"),
      text: text.replace("[[HEADING]]", "").replace("[[/HEADING]]", "").trim(),
    }));
}

function safe(value: unknown, fallback = "-") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function legalName(signature: any) {
  return [signature.signer_first_name, signature.signer_middle_initial, signature.signer_last_name]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");
}

function mountainDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value)).replace(/[\u00a0\u202f]/g, " ");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.replace(/[\u00a0\u202f]/g, " ").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
    else if (line) { lines.push(line); line = word; }
    else lines.push(word);
  }
  if (line) lines.push(line);
  return lines;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const { signature_id, confirmation_code, public_token } = await request.json();
    if (!signature_id || !confirmation_code || !public_token) {
      return Response.json({ error: "signature_id, confirmation_code, and public_token are required" }, { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: sig, error: sigError } = await supabase
      .from("epic_waiver_signatures")
      .select("*")
      .eq("id", signature_id)
      .eq("confirmation_code", confirmation_code)
      .eq("business_line", "rental")
      .single();
    if (sigError || !sig) return Response.json({ error: "Rental signature record not found" }, { status: 404 });

    const { data: session } = await supabase
      .from("epic_waiver_sessions")
      .select("id, public_token")
      .eq("id", sig.waiver_session_id)
      .eq("confirmation_code", confirmation_code)
      .eq("public_token", public_token)
      .single();
    if (!session) return Response.json({ error: "Agreement session authorization failed" }, { status: 403 });

    const { data: minors } = await supabase
      .from("epic_waiver_minors")
      .select("minor_first_name, minor_last_name, minor_dob, relationship_to_signer")
      .eq("adult_signature_id", sig.id)
      .order("created_at");

    const pdf = await PDFDocument.create();
    pdf.setTitle(`Epic 4X4 Adventures Signed Rental Agreement - ${confirmation_code}`);
    pdf.setAuthor("Epic 4X4 Adventures");
    pdf.setSubject("Signed UTV Rental Agreement V2 and audit record");
    pdf.setProducer("EpicTools");

    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

    let page: PDFPage;
    let y = 0;
    const addPage = () => {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      page.drawText("EPIC 4X4 ADVENTURES", { x: MARGIN, y: PAGE_H - 34, size: 9, font: bold, color: ACCENT });
      page.drawLine({ start: { x: MARGIN, y: PAGE_H - 43 }, end: { x: PAGE_W - MARGIN, y: PAGE_H - 43 }, thickness: 2, color: ACCENT });
      page.drawText(`Signed Rental Agreement - ${confirmation_code}`, { x: MARGIN, y: 24, size: 7, font: regular, color: MUTED });
      y = PAGE_H - 66;
    };
    const ensure = (height: number) => { if (y - height < 45) addPage(); };
    const paragraph = (text: string, options: { bold?: boolean; italic?: boolean; size?: number; color?: any; after?: number } = {}) => {
      const font = options.bold ? bold : options.italic ? italic : regular;
      const size = options.size ?? 9.2;
      const lineHeight = size * 1.42;
      for (const line of wrapText(text, font, size, CONTENT_W)) {
        ensure(lineHeight + 2);
        page.drawText(line, { x: MARGIN, y, size, font, color: options.color ?? CHARCOAL });
        y -= lineHeight;
      }
      y -= options.after ?? 7;
    };
    const heading = (text: string) => {
      ensure(30);
      page.drawText(text, { x: MARGIN, y, size: 11, font: bold, color: ACCENT });
      y -= 18;
    };
    const field = (label: string, value: string) => {
      ensure(29);
      page.drawRectangle({ x: MARGIN, y: y - 20, width: CONTENT_W, height: 25, color: LIGHT, borderColor: BORDER, borderWidth: 0.7 });
      page.drawText(label.toUpperCase(), { x: MARGIN + 8, y: y - 4, size: 6.5, font: bold, color: MUTED });
      page.drawText(value, { x: MARGIN + 8, y: y - 14, size: 9, font: bold, color: CHARCOAL });
      y -= 31;
    };

    addPage();
    page.drawText("UTV RENTAL AGREEMENT", { x: MARGIN, y, size: 22, font: bold, color: CHARCOAL });
    y -= 28;
    paragraph(`${String(sig.rental_role || "participant").toUpperCase()} · Signed electronic record`, { size: 10.5, color: MUTED, after: 14 });

    heading("Signer Information");
    field("Legal Name", legalName(sig));
    field("Role", safe(sig.rental_role).toUpperCase());
    field("Email", safe(sig.signer_email));
    field("Phone", safe(sig.signer_phone));
    field("Date of Birth", safe(sig.signer_dob));
    heading(sig.rental_role === "driver" ? "Driver Agreement" : "Passenger Agreement");
    for (const block of htmlToBlocks(sig.signed_agreement_html)) {
      paragraph(block.text, { bold: block.heading, size: block.heading ? 10.3 : 9.1, color: block.heading ? ACCENT : CHARCOAL, after: block.heading ? 8 : 6 });
    }

    if ((minors?.length || 0) > 0) {
      heading("Minor Participants");
      for (const block of htmlToBlocks(sig.signed_minor_ack_html)) paragraph(block.text, { size: 9.1, after: 6 });
      for (const [index, minor] of (minors || []).entries()) {
        paragraph(`Minor ${index + 1}: ${minor.minor_first_name} ${minor.minor_last_name} · DOB ${safe(minor.minor_dob)} · ${safe(minor.relationship_to_signer)}`, { bold: true, after: 6 });
      }
    }

    heading("Electronic Signature");
    paragraph(sig.electronic_signature_consent_text || "Electronic signature consent acknowledged.", { size: 9.1, after: 12 });

    ensure(105);
    page.drawRectangle({ x: MARGIN, y: y - 85, width: CONTENT_W, height: 90, color: LIGHT, borderColor: BORDER, borderWidth: 0.8 });
    page.drawText("SIGNATURE", { x: MARGIN + 12, y: y - 14, size: 7, font: bold, color: MUTED });
    if (sig.signature_method === "drawn" && sig.drawn_signature_storage_path) {
      const { data: blob, error } = await supabase.storage.from("epic-signatures").download(sig.drawn_signature_storage_path);
      if (error || !blob) throw new Error(`Unable to retrieve drawn signature: ${error?.message || "missing"}`);
      const image = await pdf.embedPng(new Uint8Array(await blob.arrayBuffer()));
      const factor = Math.min(1, 200 / image.width, 55 / image.height);
      page.drawImage(image, { x: MARGIN + 12, y: y - 74, width: image.width * factor, height: image.height * factor });
    } else {
      page.drawText((sig.typed_signature_name || legalName(sig)).replace(/[\u00a0\u202f]/g, " "), { x: MARGIN + 12, y: y - 55, size: 20, font: italic, color: CHARCOAL });
    }
    page.drawText(`Signed: ${mountainDate(sig.signed_at)}`, { x: PAGE_W - MARGIN - 190, y: y - 72, size: 8, font: regular, color: MUTED });
    y -= 105;

    heading("Audit Record");
    for (const [label, value] of [
      ["Confirmation", confirmation_code],
      ["Signature record", sig.id],
      ["Role", safe(sig.rental_role)],
      ["Agreement content version", safe(sig.agreement_content_version)],
      ["Template version", safe(sig.waiver_template_version)],
      ["Signature method", safe(sig.signature_method)],
      ["Electronic consent version", safe(sig.electronic_signature_consent_version)],
      ["Signed date/time", mountainDate(sig.signed_at)],
      ["IP address", safe(sig.signer_ip_address)],
      ["User agent", safe(sig.signer_user_agent)],
    ]) paragraph(`${label}: ${value}`, { size: 8, after: 3 });

    const pdfBytes = await pdf.save();
    const hashBuffer = await crypto.subtle.digest("SHA-256", pdfBytes);
    const hash = Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const storagePath = `rental-v2/${sig.waiver_session_id}/${sig.id}-${PDF_LAYOUT_VERSION}.pdf`;
    const { error: uploadError } = await supabase.storage.from("epic-legal-documents").upload(
      storagePath,
      new Blob([pdfBytes], { type: "application/pdf" }),
      { contentType: "application/pdf", upsert: false },
    );
    if (uploadError && !uploadError.message.toLowerCase().includes("already exists")) throw new Error(uploadError.message);

    const { error: updateError } = await supabase
      .from("epic_waiver_signatures")
      .update({ signed_pdf_storage_path: storagePath, signed_pdf_sha256: hash, updated_at: new Date().toISOString() })
      .eq("id", sig.id);
    if (updateError) throw new Error(updateError.message);

    return Response.json({ ok: true, signature_id: sig.id, storage_path: storagePath, sha256: hash, layout_version: PDF_LAYOUT_VERSION });
  } catch (error) {
    console.error("generate-epic-rental-v2-pdf", error);
    return Response.json({ error: error instanceof Error ? error.message : "Unable to generate signed rental V2 PDF" }, { status: 500 });
  }
});
