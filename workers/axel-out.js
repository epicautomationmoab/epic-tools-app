import { chromium } from "playwright";

const REQUIRED_ENV = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "MPWR_EMAIL",
  "MPWR_PASSWORD",
];

function requireEnv() {
  for (const key of REQUIRED_ENV) {
    if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
  }
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function supabase(path, options = {}) {
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function claimNextJob() {
  const rows = await supabase(
    "tour_vehicle_jobs?action_type=eq.checkout&execution_mode=eq.shadow&builder_name=eq.Miles&builder_version=eq.miles-shadow-v2&status=eq.shadow_ready&order=created_at.asc&limit=1"
  );
  const job = rows?.[0];
  if (!job) return null;

  const claimed = await supabase(`tour_vehicle_jobs?id=eq.${job.id}&status=eq.shadow_ready`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "claimed",
      worker_name: "Axel Out",
      claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });

  return claimed?.[0] || null;
}

async function updateJob(jobId, patch) {
  await supabase(`tour_vehicle_jobs?id=eq.${jobId}`, {
    method: "PATCH",
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
}

async function updateDispatch(dispatchId, patch) {
  await supabase(`tour_vehicle_dispatches?id=eq.${dispatchId}`, {
    method: "PATCH",
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
}

async function clickFirst(locatorCandidates) {
  for (const locator of locatorCandidates) {
    if (await locator.count()) {
      await locator.first().click();
      return true;
    }
  }
  return false;
}

async function login(page) {
  await page.goto("https://mpwr-hq.poladv.com/", { waitUntil: "domcontentloaded" });

  const email = page.locator('input[type="email"], input[name*="email" i], input[placeholder*="email" i]').first();
  if (await email.count()) {
    await email.fill(process.env.MPWR_EMAIL);
    const password = page.locator('input[type="password"]').first();
    await password.fill(process.env.MPWR_PASSWORD);
    const submitted = await clickFirst([
      page.getByRole("button", { name: /sign in|log in|login/i }),
      page.locator('button[type="submit"]'),
    ]);
    if (!submitted) throw new Error("Could not find MPWR login submit button.");
    await page.waitForLoadState("domcontentloaded");
  }
}

async function openReservation(page, mpwrConfirmationNumber) {
  if (!mpwrConfirmationNumber) throw new Error("Miles packet has no MPWR confirmation number.");
  await page.goto(`https://mpwr-hq.poladv.com/orders/${encodeURIComponent(mpwrConfirmationNumber)}`, {
    waitUntil: "domcontentloaded",
  });
  if (!page.url().includes("/orders/")) throw new Error("MPWR reservation page did not open as expected.");
}

async function chooseValidDriver(page, validDriverNames) {
  if (!Array.isArray(validDriverNames) || validDriverNames.length === 0) {
    throw new Error("Miles packet has no valid Driver waiver names.");
  }

  const driverLabel = page.getByText(/^Driver$/i).first();
  if (!(await driverLabel.count())) throw new Error("Could not locate Driver field.");

  const driverControl = page.locator('select').filter({ has: page.locator('option') });
  if (await driverControl.count()) {
    const select = driverControl.first();
    const options = await select.locator("option").allTextContents();
    const valid = new Set(validDriverNames.map(normalizeName));
    const match = options.find((name) => valid.has(normalizeName(name)));
    if (!match) throw new Error(`No Driver dropdown option matches Miles valid Driver list: ${validDriverNames.join(", ")}`);
    await select.selectOption({ label: match });
    return match;
  }

  await driverLabel.click();
  const valid = new Set(validDriverNames.map(normalizeName));
  const visibleOptions = page.getByRole("option");
  const optionTexts = await visibleOptions.allTextContents();
  const match = optionTexts.find((name) => valid.has(normalizeName(name)));
  if (!match) throw new Error(`No Driver dropdown option matches Miles valid Driver list: ${validDriverNames.join(", ")}`);
  await page.getByRole("option", { name: match, exact: true }).click();
  return match;
}

async function fillCheckout(page, packet) {
  const opened = await clickFirst([
    page.getByRole("button", { name: /^check out$/i }),
    page.getByText(/^check out$/i),
  ]);
  if (!opened) throw new Error("Could not open MPWR Check Out workflow.");

  const selectedDriver = await chooseValidDriver(page, packet.valid_driver_names);

  const vehicleSearch = page.locator('input[placeholder*="vehicle" i], input[name*="vehicle" i]').first();
  if (!(await vehicleSearch.count())) throw new Error("Could not locate vehicle selector.");
  await vehicleSearch.fill(String(packet.vehicle_number));

  const vehicleOption = page.getByText(new RegExp(`^${String(packet.vehicle_number).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")).first();
  if (!(await vehicleOption.count())) throw new Error(`MPWR did not return vehicle ${packet.vehicle_number}.`);
  await vehicleOption.click();

  const mileage = page.locator('input[name*="mileage" i], input[placeholder*="mileage" i]').first();
  if (!(await mileage.count())) throw new Error("Could not locate mileage field.");
  await mileage.fill(String(packet.checkout_mileage));

  const hours = page.locator('input[name*="hour" i], input[placeholder*="hour" i]').first();
  if (!(await hours.count())) throw new Error("Could not locate engine hours field.");
  await hours.fill(String(packet.checkout_engine_hours));

  const missingWaiverContinue = page.getByRole("button", { name: /continue|proceed/i });
  if (await page.getByText(/missing waiver/i).count() && await missingWaiverContinue.count()) {
    await missingWaiverContinue.first().click();
  }

  const guestName = page.locator('input[name*="guest" i], input[placeholder*="guest" i]').first();
  if (await guestName.count()) await guestName.fill(packet.guest_signature_name || "Staff - Tour");

  const employeeName = page.locator('input[name*="employee" i], input[placeholder*="employee" i]').first();
  if (await employeeName.count()) await employeeName.fill(packet.employee_signature_name || "Epic Automation");

  const acknowledgementChecks = page.locator('input[type="checkbox"]:not(:checked)');
  for (let i = 0; i < await acknowledgementChecks.count(); i += 1) {
    await acknowledgementChecks.nth(i).check();
  }

  const finalButton = page.getByRole("button", { name: /^check[- ]?out$/i }).last();
  if (!(await finalButton.count())) throw new Error("Could not locate final Check-Out button.");
  if (!(await finalButton.isVisible())) throw new Error("Final Check-Out button is not visible.");

  return { selectedDriver };
}

async function rehearse(job) {
  const packet = job.instruction_snapshot || {};
  if (packet.driver_rule !== "select_any_dropdown_name_matching_valid_driver_names_or_stop") {
    throw new Error(`Unexpected Miles driver rule: ${packet.driver_rule || "missing"}`);
  }

  await updateJob(job.id, { status: "processing", last_error: null });
  await updateDispatch(job.dispatch_id, { checkout_status: "checking_out", last_error: null });

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page);
    await openReservation(page, packet.mpwr_confirmation_number);
    const { selectedDriver } = await fillCheckout(page, packet);

    // Rehearsal safety boundary: NEVER click the final MPWR Check-Out button.
    await updateJob(job.id, {
      status: "completed",
      result_notes: `REHEARSAL COMPLETE - stopped before final Check-Out. Driver matched: ${selectedDriver}`,
      completed_at: new Date().toISOString(),
      last_error: null,
    });
    await updateDispatch(job.dispatch_id, {
      checkout_status: "checkout_queued",
      last_error: null,
    });
  } finally {
    await browser.close();
  }
}

async function main() {
  requireEnv();
  const job = await claimNextJob();
  if (!job) {
    console.log("No Miles v2 checkout rehearsal job available.");
    return;
  }

  try {
    await rehearse(job);
    console.log(`Axel Out rehearsal completed for job ${job.id}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateJob(job.id, { status: "failed", last_error: message });
    await updateDispatch(job.dispatch_id, { checkout_status: "needs_attention", last_error: message });
    console.error(message);
    process.exitCode = 1;
  }
}

main();
