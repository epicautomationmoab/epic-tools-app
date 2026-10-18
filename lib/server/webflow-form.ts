export const WEBFLOW_SENDERS = new Set(["no-reply@webforms.io", "no-reply@webflow.com"]);

export function parseWebflowGuest(body: string): { name: string | null; email: string | null; phone: string | null } {
  const fields = new Map<string, string>();
  for (const line of body.split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const label = line.slice(0, colon).trim().toLowerCase();
    if (!["name", "email", "phone"].includes(label) || fields.has(label)) continue;
    fields.set(label, line.slice(colon + 1).trim());
  }
  const candidate = fields.get("email") || "";
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate.toLowerCase() : null;
  return {
    name: fields.get("name")?.slice(0, 200) || null,
    email: email && !WEBFLOW_SENDERS.has(email) ? email : null,
    phone: fields.get("phone")?.slice(0, 80) || null,
  };
}
