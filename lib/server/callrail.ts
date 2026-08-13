function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function callRailConfigured() {
  return ["CALLRAIL_API_KEY", "CALLRAIL_ACCOUNT_NUMERIC_ID", "CALLRAIL_COMPANY_NUMERIC_ID", "CALLRAIL_TRACKING_NUMBER"]
    .every((name) => Boolean(process.env[name]?.trim()));
}

async function callRailGet(path: string) {
  const response = await fetch(`https://api.callrail.com${path}`, {
    headers: { Authorization: `Token token="${requiredEnv("CALLRAIL_API_KEY")}"`, "Request-From": "epictools" },
    cache: "no-store",
  });
  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Unable to read CallRail configuration.");
  return data;
}

let identifiersPromise: Promise<{ accountId: string; companyId: string }> | null = null;

async function resolveIdentifiers() {
  if (identifiersPromise) return identifiersPromise;
  identifiersPromise = (async () => {
    const accountNumericId = requiredEnv("CALLRAIL_ACCOUNT_NUMERIC_ID");
    const companyNumericId = requiredEnv("CALLRAIL_COMPANY_NUMERIC_ID");
    const accountData = await callRailGet("/v3/a.json?fields=numeric_id&per_page=100");
    const accounts = Array.isArray(accountData.accounts) ? accountData.accounts as Array<Record<string, unknown>> : [];
    const account = accounts.find((item) => String(item.numeric_id) === accountNumericId);
    if (!account || typeof account.id !== "string") throw new Error("CallRail account could not be matched.");

    const companyData = await callRailGet(`/v3/a/${encodeURIComponent(account.id)}/companies.json?per_page=250`);
    const companies = Array.isArray(companyData.companies) ? companyData.companies as Array<Record<string, unknown>> : [];
    const company = companies.find((item) =>
      typeof item.script_url === "string" && item.script_url.includes(`/companies/${companyNumericId}/`),
    );
    if (!company || typeof company.id !== "string") throw new Error("CallRail company could not be matched.");
    return { accountId: account.id, companyId: company.id };
  })().catch((error) => {
    identifiersPromise = null;
    throw error;
  });
  return identifiersPromise;
}

export async function sendCallRailSms(input: {
  phone: string;
  body: string;
}) {
  const { accountId, companyId } = await resolveIdentifiers();
  const response = await fetch(`https://api.callrail.com/v3/a/${encodeURIComponent(accountId)}/text-messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Token token="${requiredEnv("CALLRAIL_API_KEY")}"`,
      "Content-Type": "application/json",
      "Request-From": "epictools",
    },
    body: JSON.stringify({
      customer_phone_number: input.phone,
      tracking_number: requiredEnv("CALLRAIL_TRACKING_NUMBER"),
      content: input.body,
      company_id: companyId,
    }),
    cache: "no-store",
  });
  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const errors = Array.isArray(data.error) ? data.error.join(" ") : data.error;
    throw new Error(
      (typeof data.message === "string" && data.message) ||
        (typeof errors === "string" && errors) ||
        "CallRail could not send the agreement text.",
    );
  }

  return {
    conversationId: typeof data.id === "string" ? data.id : null,
    response: data,
  };
}
