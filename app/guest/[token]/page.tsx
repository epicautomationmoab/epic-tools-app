"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import styles from "./GuestPortal.module.css";

const UTAH_ADULT_OHV_COURSE_URL =
  "https://recreation.utah.gov/off-highway-vehicles/education/ohv-education-course/";

type VehicleBreakdownItem = {
  model: string;
  quantity: number;
};

type Activity = {
  readinessId: string;
  businessLine: string;
  productDisplayName: string;
  visitStartTime: string;
  rentalDuration: string | null;
  expectedGuestCount: number | null;
  totalVehicleCount: number | null;
  vehicleBreakdown: VehicleBreakdownItem[] | null;
  premierAdventureAssure: boolean | null;
  adventureAssureLevel: string | null;
  ohvRequired: boolean | null;
  ohvCertificateUploaded: boolean | null;
  ohvCertificateFilename: string | null;
  ohvCertificateUploadedAt: string | null;
};

type EpicDocumentStatus = {
  readinessId: string;
  received: number;
  expected: number;
  signers: Array<{
    name: string;
    isMinorOrChild?: boolean | null;
    isWaiverAdult?: boolean | null;
    is_minor_or_child?: boolean | null;
    is_waiver_adult?: boolean | null;
  }>;
};

type MpwrWaiverStatus = {
  readinessId: string;
  received: number;
  expected: number;
  signers: Array<{
    name: string;
    isMinor?: boolean | null;
    isPassenger?: boolean | null;
    is_minor?: boolean | null;
    is_passenger?: boolean | null;
  }>;
};

type PortalReservation = {
  guestPortalToken: string;
  confirmationCode: string;
  customerName: string;
  customerEmail: string | null;
  customerPhoneLastFour: string | null;
  additionalWaiversUrl: string | null;
  mpwrWaiverUrl: string | null;
  activities: Activity[];
  epicDocuments: EpicDocumentStatus[];
  mpwrWaivers: MpwrWaiverStatus[];
};

type PortalResponse = {
  reservation: PortalReservation;
};

function maskEmail(email: string | null) {
  if (!email || !email.includes("@")) return null;

  const [localPart, domain] = email.split("@");

  if (localPart.length <= 2) {
    return `${localPart.slice(0, 1)}•@${domain}`;
  }

  const visibleStart =
    localPart.length >= 8 ? localPart.slice(0, 3) : localPart.slice(0, 1);

  const visibleEnd =
    localPart.length >= 5 ? localPart.slice(-2) : localPart.slice(-1);

  return `${visibleStart}••••${visibleEnd}@${domain}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  return {
    date: new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "America/Denver",
    }).format(date),
    time: new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Denver",
    }).format(date),
  };
}

function getLocation(businessLine: string) {
  if (businessLine.toLowerCase() === "rental") {
    return {
      label: "Rental Pickup Location",
      address: "11860 S. Highway 191, Moab, UT 84532",
      mapsUrl:
        "https://www.google.com/maps/search/?api=1&query=11860+S+Highway+191+Moab+UT+84532",
    };
  }

  return {
    label: "Tour Meeting Location",
    address: "1041 S. Main Street, Moab, UT 84532",
    note: "Please arrive 15 minutes in advance for check-in and a timely tour departure.",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=1041+S+Main+Street+Moab+UT+84532",
  };
}

function requirementComplete(received: number, expected: number) {
  if (expected <= 0) return true;
  return received >= expected;
}

function StatusBadge({
  complete,
  requiredLabel = "Action Required",
}: {
  complete: boolean;
  requiredLabel?: string;
}) {
  return (
    <span
      className={`${styles.statusBadge} ${
        complete ? styles.statusComplete : styles.statusRequired
      }`}
    >
      {complete ? "Complete" : requiredLabel}
    </span>
  );
}

export default function GuestPortalPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;

  const [reservation, setReservation] =
    useState<PortalReservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function loadPortal() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/guest/${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );

        const data = (await response.json()) as
          | PortalResponse
          | { error?: string };

        if (!response.ok || !("reservation" in data)) {
          throw new Error(
            "error" in data && data.error
              ? data.error
              : "Unable to load this guest portal.",
          );
        }

        if (!cancelled) {
          setReservation(data.reservation);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load this guest portal.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPortal();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const readiness = useMemo(() => {
    if (!reservation) {
      return { completed: 0, total: 0, percent: 0, allComplete: false };
    }

    const steps: boolean[] = [];

    for (const activity of reservation.activities) {
      const epic = reservation.epicDocuments.find(
        (item) => item.readinessId === activity.readinessId,
      );
      const mpwr = reservation.mpwrWaivers.find(
        (item) => item.readinessId === activity.readinessId,
      );

      if (epic) {
        steps.push(requirementComplete(epic.received, epic.expected));
      }

      if (mpwr && mpwr.expected > 0) {
        steps.push(requirementComplete(mpwr.received, mpwr.expected));
      }

      if (activity.businessLine.toLowerCase() === "rental") {
        steps.push(activity.ohvCertificateUploaded === true);
      }
    }

    const completed = steps.filter(Boolean).length;
    const total = steps.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 100;

    return {
      completed,
      total,
      percent,
      allComplete: total === 0 || completed === total,
    };
  }, [reservation]);

  async function sharePortal() {
    if (!reservation) return;

    const shareData = {
      title: "Epic 4X4 Adventures",
      text: `Reservation details for confirmation ${reservation.confirmationCode}.`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch (shareError) {
      if (
        shareError instanceof DOMException &&
        shareError.name === "AbortError"
      ) {
        return;
      }
      console.error("Unable to share portal:", shareError);
    }
  }

  async function copyConfirmationCode() {
    if (!reservation) return;

    try {
      await navigator.clipboard.writeText(reservation.confirmationCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch (copyError) {
      console.error("Unable to copy confirmation code:", copyError);
    }
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.portalMessage}>
          <h1>Loading your adventure…</h1>
          <p>Please give us just a moment.</p>
        </div>
      </main>
    );
  }

  if (error || !reservation) {
    return (
      <main className={styles.page}>
        <div className={styles.portalMessage}>
          <h1>We could not open this portal.</h1>
          <p>{error || "The link may be invalid or no longer available."}</p>
          <a href="tel:+14352202700" className={styles.primaryButton}>
            Call Epic at 435-220-2700
          </a>
        </div>
      </main>
    );
  }

  const maskedEmail = maskEmail(reservation.customerEmail);
  const primaryActivity = reservation.activities[0];
  const hasRentalActivity = reservation.activities.some(
    (activity) => activity.businessLine.toLowerCase() === "rental",
  );

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroOverlay} />

        <header className={styles.header}>
          <img
            src="/epic-logo.png"
            alt="Epic 4X4 Adventures"
            className={styles.logo}
          />

          <button
            type="button"
            className={styles.shareButton}
            onClick={sharePortal}
          >
            Share
          </button>
        </header>

        <div className={styles.heroContent}>
          <span className={styles.heroKicker}>Your Moab adventure awaits</span>
          <h1>Your adventure is almost here!</h1>
          <p>
            Everything you need for a smooth arrival is right here. Complete
            any remaining steps below and we will take care of the rest.
          </p>
        </div>
      </section>

      <div className={styles.content}>
        {copied ? (
          <div className={styles.toast}>Copied to your clipboard.</div>
        ) : null}

        <section className={styles.reservationCard}>
          <div className={styles.reservationMain}>
            <p className={styles.eyebrow}>Upcoming Reservation</p>
            <h2>{reservation.customerName}</h2>

            <div className={styles.contactSummary}>
              {reservation.customerPhoneLastFour ? (
                <span>Phone ending in {reservation.customerPhoneLastFour}</span>
              ) : null}
              {maskedEmail ? <span>{maskedEmail}</span> : null}
            </div>
          </div>

          <div className={styles.confirmationPanel}>
            <span className={styles.confirmationLabel}>Confirmation Code</span>
            <button
              type="button"
              className={styles.confirmationCode}
              onClick={copyConfirmationCode}
              title="Copy confirmation code"
            >
              {reservation.confirmationCode}
            </button>
            <span className={styles.copyHint}>Click to copy</span>
          </div>
        </section>

        <section className={styles.sectionCard}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Your Itinerary</p>
              <h2>
                {reservation.activities.length === 1
                  ? "Your upcoming Epic adventure"
                  : "Your upcoming Epic adventures"}
              </h2>
            </div>
          </div>

          <div className={styles.itineraryList}>
            {reservation.activities.map((activity, index) => {
              const dateTime = formatDateTime(activity.visitStartTime);
              const location = getLocation(activity.businessLine);

              return (
                <article
                  className={styles.itineraryItem}
                  key={`${activity.readinessId}-${index}`}
                >
                  <div className={styles.itineraryNumber}>{index + 1}</div>

                  <div className={styles.itineraryContent}>
                    <div className={styles.itineraryTopline}>
                      <h3>{activity.productDisplayName}</h3>
                      <span className={styles.businessLinePill}>
                        {activity.businessLine}
                      </span>
                    </div>

                    <div className={styles.reservationDetails}>
                      <span>{dateTime.date}</span>
                      <span>{dateTime.time}</span>

                      {activity.rentalDuration ? (
                        <span>{activity.rentalDuration}</span>
                      ) : null}

                      {activity.expectedGuestCount ? (
                        <span>
                          {activity.expectedGuestCount}{" "}
                          {activity.expectedGuestCount === 1
                            ? "Guest"
                            : "Guests"}
                        </span>
                      ) : null}
                    </div>

                    <div className={styles.itineraryLocation}>
                      <strong>{location.label}</strong>
                      <span>{location.address}</span>

                      {"note" in location ? (
                        <span className={styles.locationNote}>
                          {location.note}
                        </span>
                      ) : null}

                      <a
                        href={location.mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open in Maps
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {hasRentalActivity ? (
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>Protection</p>
                <h2>Adventure Assure</h2>
              </div>
            </div>

            <div className={styles.adventureAssureCard}>
              <img
                src="/aa-logo.png"
                alt="Adventure Assure"
                className={styles.adventureAssureLogo}
              />

              <div className={styles.adventureAssureContent}>
                <h3>
                  {primaryActivity?.premierAdventureAssure
                    ? "Premier Adventure Assure"
                    : "Standard Adventure Assure"}
                </h3>

                <p>Selected for this reservation.</p>
              </div>
            </div>
          </section>
        ) : null}

        <section className={styles.sectionCard}>
          <div className={styles.progressHeader}>
            <div>
              <p className={styles.eyebrow}>Your Progress</p>
              <h2>
                {readiness.allComplete
                  ? "You are ready for your adventure."
                  : "A few things still need your attention."}
              </h2>
              <p className={styles.sectionIntro}>
                We will update this page automatically as each requirement is
                completed.
              </p>
            </div>

            <div className={styles.progressNumber}>
              <strong>
                {readiness.completed}/{readiness.total}
              </strong>
              <span>Complete</span>
            </div>
          </div>

          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${readiness.percent}%` }}
            />
          </div>

          <span className={styles.progressPercent}>
            {readiness.percent}% ready
          </span>

          <div className={styles.requirementList}>
            {reservation.activities.map((activity, index) => {
              const epic = reservation.epicDocuments.find(
                (item) => item.readinessId === activity.readinessId,
              );
              const mpwr = reservation.mpwrWaivers.find(
                (item) => item.readinessId === activity.readinessId,
              );

              const epicComplete = epic
                ? requirementComplete(epic.received, epic.expected)
                : true;
              const mpwrComplete = mpwr
                ? requirementComplete(mpwr.received, mpwr.expected)
                : true;

              const isRental =
                activity.businessLine.toLowerCase() === "rental";

              const epicTitle = isRental
                ? "Epic Rental Terms & Conditions"
                : "Guide Services Agreement & Waiver";

              const epicInstructions = isRental
                ? "The responsible party for each vehicle must complete the Epic Rental Terms & Conditions."
                : "Every participant must complete our guided services agreement. Adults complete for themselves, and a parent or legal guardian must complete the waiver for each minor.";

              const epicCountLabel = isRental
                ? "responsible parties"
                : "participants";

              return (
                <div
                  className={styles.activityRequirements}
                  key={`${activity.readinessId}-requirements-${index}`}
                >
                  <div className={styles.activityRequirementTitle}>
                    <span>Requirements for</span>
                    <strong>{activity.productDisplayName}</strong>
                  </div>

                  {epic ? (
                    <article
                      className={`${styles.requirement} ${styles.epicRequirement}`}
                    >
                      <div className={styles.requirementAccent} />

                      <div className={styles.requirementContent}>
                        <div className={styles.requirementHeading}>
                          <div>
                            <span className={styles.requirementKicker}>
                              Epic Documents
                            </span>
                            <h3>{epicTitle}</h3>
                          </div>
                          <StatusBadge complete={epicComplete} />
                        </div>

                        <p className={styles.requirementInstructions}>
                          {epicInstructions}
                        </p>

                        <p className={styles.requirementCount}>
                          {epic.received} of {epic.expected}{" "}
                          {epicCountLabel} complete
                        </p>

                        {epic.signers.length ? (
                          <div className={styles.signerList}>
                            {epic.signers.map((signer, signerIndex) => {
                              const minor =
                                signer.isMinorOrChild ??
                                signer.is_minor_or_child ??
                                false;

                              return (
                                <div
                                  className={styles.signerRow}
                                  key={`${signer.name}-${signerIndex}`}
                                >
                                  <div className={styles.signerCheck}>✓</div>
                                  <div>
                                    <strong>{signer.name}</strong>
                                    <span>
                                      {minor ? "Minor" : "Adult"} · Signed
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>

                      {reservation.additionalWaiversUrl ? (
                        <a
                          className={styles.primaryButton}
                          href={reservation.additionalWaiversUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {isRental
                          ? "Complete Terms & Conditions"
                          : "Complete Tour Waivers"}
                        </a>
                      ) : null}
                    </article>
                  ) : null}

                  {mpwr && mpwr.expected > 0 ? (
                    <article
                      className={`${styles.requirement} ${styles.polarisRequirement}`}
                    >
                      <div className={styles.requirementAccent} />

                      <div className={styles.requirementContent}>
                        <div className={styles.requirementHeading}>
                          <div className={styles.polarisTitleBlock}>
                            <div className={styles.polarisTitleRow}>
                              <span className={styles.requirementKicker}>
                                Polaris Adventures
                              </span>

                              <img
                                src="/polaris-adventures-elite.png"
                                alt="Polaris Adventures Elite"
                                className={styles.polarisLogo}
                              />
                            </div>

                            <h3>Polaris Participant Waivers</h3>
                          </div>

                          <div className={styles.polarisHeadingMeta}>
                            <StatusBadge complete={mpwrComplete} />
                          </div>
                        </div>

                        <p className={styles.requirementInstructions}>
                          Every adult participant must complete a waiver.
                          Children must be added to a parent or legal guardian
                          waiver.
                        </p>

                        <p className={styles.requirementCount}>
                          {mpwr.received} of {mpwr.expected} participants
                          complete
                        </p>

                        {mpwr.signers.length ? (
                          <div className={styles.signerList}>
                            {mpwr.signers.map((signer, signerIndex) => {
                              const minor =
                                signer.isMinor ?? signer.is_minor ?? false;
                              const passenger =
                                signer.isPassenger ??
                                signer.is_passenger ??
                                false;

                              return (
                                <div
                                  className={styles.signerRow}
                                  key={`${signer.name}-${signerIndex}`}
                                >
                                  <div className={styles.signerCheck}>✓</div>
                                  <div>
                                    <strong>{signer.name}</strong>
                                    <span>
                                      {minor
                                        ? "Minor"
                                        : passenger
                                          ? "Passenger"
                                          : "Driver"}{" "}
                                      · Signed
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>

                      {reservation.mpwrWaiverUrl ? (
                        <a
                          className={styles.primaryButton}
                          href={reservation.mpwrWaiverUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Complete Polaris Waivers
                          
                        </a>
                      ) : null}
                    </article>
                  ) : null}

                  {isRental ? (
                    <>
                      <article
                        className={`${styles.requirement} ${styles.ohvRequirement}`}
                      >
                        <div className={styles.requirementAccent} />

                        <div className={styles.requirementContent}>
                          <div className={styles.requirementHeading}>
                            <div>
                              <span className={styles.requirementKicker}>
                                Utah Requirement
                              </span>
                              <h3>Adult OHV Safety Course</h3>
                            </div>

                            <StatusBadge
                              complete={
                                activity.ohvCertificateUploaded === true
                              }
                              requiredLabel="Required"
                            />
                          </div>

                          <p className={styles.requirementInstructions}>
                            Every adult driver must complete Utah&apos;s free
                            online OHV education course before operating a
                            rental vehicle.
                          </p>
                        </div>

                        <a
                          className={styles.primaryButton}
                          href={UTAH_ADULT_OHV_COURSE_URL}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Take OHV Course
                        </a>
                      </article>

                      <article
                        className={`${styles.requirement} ${styles.uploadRequirement}`}
                      >
                        <div className={styles.requirementAccent} />

                        <div className={styles.requirementContent}>
                          <div className={styles.requirementHeading}>
                            <div>
                              <span className={styles.requirementKicker}>
                                Final Step
                              </span>
                              <h3>Upload OHV Certificate</h3>
                            </div>

                            <StatusBadge
                              complete={
                                activity.ohvCertificateUploaded === true
                              }
                              requiredLabel="Upload Required"
                            />
                          </div>

                          <p className={styles.requirementInstructions}>
                            Upload the completed certificate so our team can
                            verify it before rental pickup.
                          </p>

                          {activity.ohvCertificateFilename ? (
                            <p className={styles.uploadedFile}>
                              Uploaded: {activity.ohvCertificateFilename}
                            </p>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          className={styles.primaryButton}
                          disabled
                          title="Certificate upload is the next feature being connected."
                        >
                          Upload Coming Next
                        </button>
                      </article>
                    </>
                  ) : null}
                </div>
              );
            })}

            <article
              className={`${styles.requirement} ${styles.readyRow}`}
            >
              <div className={styles.requirementAccent} />
              <div className={styles.requirementContent}>
                <div className={styles.requirementHeading}>
                  <div>
                    <span className={styles.requirementKicker}>
                      Arrival Status
                    </span>
                    <h3>Ready for Adventure</h3>
                  </div>

                  <StatusBadge
                    complete={readiness.allComplete}
                    requiredLabel="Pending"
                  />
                </div>

                <p className={styles.requirementInstructions}>
                  {readiness.allComplete
                    ? "Everything is complete. We will see you soon!"
                    : "This page will update automatically as your required items are completed."}
                </p>
              </div>
            </article>
          </div>
        </section>

        <section className={styles.helpCard}>
          <div>
            <p className={styles.eyebrow}>Need Help?</p>
            <h2>We are here for you.</h2>
            <p>
              Questions about your reservation or one of the steps above?
              Reach out and our team will help.
            </p>
          </div>

          <div className={styles.helpLinks}>
            <a href="sms:+14352202700">Text 435-220-2700</a>
            <a href="tel:+14352202700">Call 435-220-2700</a>
            <a href="mailto:hello@epic4x4adventures.com">
              hello@epic4x4adventures.com
            </a>
          </div>
        </section>

        <footer className={styles.footer}>
          Your reservation information is private. Share this page only with
          members of your travel group.
        </footer>
      </div>
    </main>
  );
}
