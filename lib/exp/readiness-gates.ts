/** Individual orientation completion feeds reservation-wide EXC qualification. */
export type ExpReadinessInput = {
  assessmentComplete: boolean;
  videoAcknowledged: boolean;
  signerVerified: boolean;
  requiredFormsLoaded: boolean;
  requiredFormsComplete: boolean;
  rentalWaiverComplete: boolean;
  polarisWaiverComplete: boolean;
  ohvCertificateComplete: boolean;
};
export type ExpReadinessResult = {
  expReady: boolean;
  outstanding: string[];
};
export function evaluateExpDriverReadiness(input: ExpReadinessInput): ExpReadinessResult {
  const outstanding: string[] = [];
  if (!input.requiredFormsLoaded || !input.requiredFormsComplete) outstanding.push("Required forms");
  if (!input.rentalWaiverComplete) outstanding.push("Epic rental agreement");
  if (!input.polarisWaiverComplete) outstanding.push("Polaris participant waiver");
  if (!input.ohvCertificateComplete) outstanding.push("OHV certificate");
  if (!input.signerVerified) outstanding.push("Driver waiver identity verification");
  if (!input.videoAcknowledged) outstanding.push("Safety video acknowledgment");
  if (!input.assessmentComplete) outstanding.push("Knowledge check");
  return { expReady: outstanding.length === 0, outstanding };
}
