// Ambassador referral capture and attribution.
(() => {
  const params = new URLSearchParams(window.location.search);
  const ref = (params.get("ref") || "").trim().toLowerCase();
  if (!ref) return;

  const STORAGE_KEY = "epic_referral_attribution";
  const VISITOR_KEY = "epic_referral_visitor_id";
  const endpoint = "https://www.epic4x4ambassador.com/api/referral/capture";

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return `v-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function getVisitorId() {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  }

  function persist(payload) {
    const record = { ref, referral_visit_id: payload.referral_visit_id, visitor_id: payload.visitor_id, expires_at: payload.expires_at, partner: payload.partner };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    const maxAge = Math.max(60, Math.floor((new Date(payload.expires_at).getTime() - Date.now()) / 1000));
    document.cookie = `epic_ref=${encodeURIComponent(ref)}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure`;
    document.cookie = `epic_rid=${encodeURIComponent(payload.referral_visit_id || "")}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure`;
  }

  function cleanVisibleUrl() {
    try {
      const clean = new URL(window.location.href);
      clean.searchParams.delete("ref");
      window.history.replaceState(window.history.state, "", `${clean.pathname}${clean.search}${clean.hash}` || "/");
    } catch (_) {}
  }

  function decorateLinks(payload) {
    document.querySelectorAll("a[href]").forEach((anchor) => {
      try {
        const url = new URL(anchor.href, window.location.href);
        if (!/tripworks|book|reserve|checkout/i.test(url.hostname + url.pathname)) return;
        url.searchParams.set("epic_ref", ref);
        if (payload.referral_visit_id) url.searchParams.set("epic_rid", payload.referral_visit_id);
        anchor.href = url.toString();
      } catch (_) {}
    });
  }

  function defaultOfferText(partner) {
    if (partner.reward_basis === "percent" && Number(partner.guest_discount_percent) > 0) return `Save ${Number(partner.guest_discount_percent)}% on your Epic adventure.`;
    if (Number(partner.guest_discount_cents) > 0) {
      const dollars = Number(partner.guest_discount_cents) / 100;
      return `Save ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(dollars)} on your Epic adventure.`;
    }
    return "Thanks for booking with Epic through this partner.";
  }

  function showOffer(partner) {
    if (!partner || !partner.show_promo_popup) return;
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-epic-referral-offer", "true");
    wrapper.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(16,24,40,.58);display:grid;place-items:center;padding:20px;box-sizing:border-box;";
    const card = document.createElement("div");
    card.style.cssText = "width:min(430px,calc(100vw - 40px));background:#fff;border-radius:18px;padding:28px;box-shadow:0 24px 70px rgba(0,0,0,.24);font-family:Arial,sans-serif;color:#202733;box-sizing:border-box;line-height:1.4;";
    const heading = document.createElement("h2");
    heading.textContent = partner.popup_heading || `A special offer from ${partner.name}`;
    heading.style.cssText = "display:block;margin:0 0 10px!important;padding:0!important;font-family:Arial,sans-serif!important;font-size:24px!important;font-weight:800!important;line-height:1.2!important;letter-spacing:-.02em!important;color:#202733!important;white-space:normal!important;position:static!important;transform:none!important;";
    const body = document.createElement("p");
    body.textContent = partner.popup_body || defaultOfferText(partner);
    body.style.cssText = "display:block;margin:0 0 18px!important;padding:0!important;font-family:Arial,sans-serif!important;font-size:16px!important;line-height:1.5!important;color:#5f6874!important;position:static!important;transform:none!important;";
    card.appendChild(heading);
    card.appendChild(body);
    if (partner.promo_code) {
      const code = document.createElement("button");
      code.type = "button";
      code.textContent = `Copy code ${partner.promo_code}`;
      code.style.cssText = "display:block;width:100%;border:0;border-radius:9px;background:#d5521d;color:white;padding:12px 14px;font-family:Arial,sans-serif;font-size:16px;font-weight:800;line-height:1.2;cursor:pointer;margin:0 0 10px;box-sizing:border-box;";
      code.addEventListener("click", async () => { try { await navigator.clipboard.writeText(partner.promo_code); code.textContent = "Code copied"; } catch (_) {} });
      card.appendChild(code);
    }
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Continue";
    close.style.cssText = "display:block;width:100%;border:1px solid #cfd6de;border-radius:9px;background:white;color:#202733;padding:12px 14px;font-family:Arial,sans-serif;font-size:16px;font-weight:800;line-height:1.2;cursor:pointer;margin:0;box-sizing:border-box;";
    close.addEventListener("click", () => wrapper.remove());
    card.appendChild(close);
    wrapper.appendChild(card);
    document.body.appendChild(wrapper);
  }

  const utm = ["utm_source","utm_medium","utm_campaign","utm_term","utm_content"].reduce((acc, key) => { acc[key] = params.get(key); return acc; }, {});
  const landingUrl = window.location.href;

  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref, visitor_id: getVisitorId(), landing_url: landingUrl, referrer_url: document.referrer || null, ...utm }),
  })
    .then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Referral capture failed.");
      persist(payload);
      cleanVisibleUrl();
      decorateLinks(payload);
      showOffer(payload.partner);
    })
    .catch(() => {});
})();
