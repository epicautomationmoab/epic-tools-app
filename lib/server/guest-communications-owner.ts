const GUEST_COMMUNICATIONS_OWNER_PROJECT_ID = "prj_UWMks41frvwzomqw3h8R0VzkRcOl";

export function isGuestCommunicationsOwner() {
  if (process.env.VERCEL !== "1") return true;
  return process.env.VERCEL_PROJECT_ID?.trim() === GUEST_COMMUNICATIONS_OWNER_PROJECT_ID;
}

export function guestCommunicationsOwnerReason() {
  return "Guest communications are owned exclusively by the epic-tools-app Vercel project.";
}
