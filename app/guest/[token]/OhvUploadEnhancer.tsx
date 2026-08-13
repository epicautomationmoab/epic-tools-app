"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import styles from "./OhvUploadEnhancer.module.css";

type Activity = {
  readinessId: string;
  businessLine: string;
  productDisplayName: string;
  totalVehicleCount: number | null;
};

type PortalResponse = {
  reservation: {
    activities: Activity[];
  };
};

type Upload = {
  id: string;
  readiness_id: string;
  driver_name: string;
  original_filename: string;
  uploaded_at: string;
};

const DIRECT_UPLOAD_LIMIT = 4 * 1024 * 1024;

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= DIRECT_UPLOAD_LIMIT) {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("This image could not be prepared for upload."));
      element.src = objectUrl;
    });

    const maxDimension = 2200;
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));

    const context = canvas.getContext("2d");
    if (!context) throw new Error("This image could not be prepared for upload.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    let quality = 0.86;
    let blob: Blob | null = null;

    while (quality >= 0.45) {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (blob && blob.size <= DIRECT_UPLOAD_LIMIT) break;
      quality -= 0.1;
    }

    if (!blob) throw new Error("This image could not be prepared for upload.");
    if (blob.size > DIRECT_UPLOAD_LIMIT) {
      throw new Error("This photo is still too large. Please retake it at a lower resolution.");
    }

    const baseName = file.name.replace(/\.[^.]+$/, "") || "ohv-certificate";
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function readResponse(response: Response) {
  const text = await response.text();
  if (!text) return {} as { error?: string; uploads?: Upload[] };

  try {
    return JSON.parse(text) as { error?: string; uploads?: Upload[] };
  } catch {
    return {
      error:
        response.status === 413
          ? "That photo is too large to upload. Please choose a smaller image."
          : text.slice(0, 180),
    };
  }
}

export default function OhvUploadEnhancer() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [readinessId, setReadinessId] = useState("");
  const [driverName, setDriverName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  const selectedActivity = useMemo(
    () => activities.find((activity) => activity.readinessId === readinessId),
    [activities, readinessId],
  );

  const selectedUploads = uploads.filter(
    (upload) => upload.readiness_id === readinessId,
  );
  const requiredCount = Math.max(selectedActivity?.totalVehicleCount ?? 0, 0);
  const complete = requiredCount > 0 && selectedUploads.length >= requiredCount;

  useEffect(() => {
    if (!token) return;

    fetch(`/api/guest/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data: PortalResponse) => {
        const rentals = (data.reservation?.activities ?? []).filter(
          (activity) => activity.businessLine.toLowerCase() === "rental",
        );
        setActivities(rentals);
        setReadinessId(rentals[0]?.readinessId ?? "");
      })
      .catch(() => setMessage("Unable to load rental details."));
  }, [token]);

  useEffect(() => {
    if (!token) return;

    fetch(`/api/guest/${encodeURIComponent(token)}/ohv`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { uploads?: Upload[] }) => setUploads(data.uploads ?? []))
      .catch(() => setUploads([]));
  }, [token]);

  useEffect(() => {
    const activateButton = () => {
      const button = Array.from(document.querySelectorAll("button")).find(
        (item) => item.textContent?.trim() === "Upload Coming Next",
      );

      if (!(button instanceof HTMLButtonElement)) return false;
      button.disabled = false;
      button.textContent = complete ? "View OHV Uploads" : "Upload Certificate";
      button.title = "Upload an OHV certificate";
      button.onclick = () => setOpen(true);
      return true;
    };

    if (activateButton()) return;
    const observer = new MutationObserver(() => {
      if (activateButton()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [complete]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setMessage("");
  }

  async function uploadCertificate() {
    if (!token || !readinessId || !driverName.trim() || !file) {
      setMessage("Enter the driver's name and choose a certificate.");
      return;
    }

    setWorking(true);
    setMessage("");

    try {
      setMessage(file.size > DIRECT_UPLOAD_LIMIT ? "Preparing photo for upload…" : "");
      const preparedFile = await compressImage(file);

      const form = new FormData();
      form.set("readinessId", readinessId);
      form.set("driverName", driverName.trim());
      form.set("certificate", preparedFile);

      const response = await fetch(`/api/guest/${encodeURIComponent(token)}/ohv`, {
        method: "POST",
        body: form,
      });
      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "Unable to upload certificate.");
      }

      setUploads(data.uploads ?? []);
      setDriverName("");
      setFile(null);
      if (cameraInput.current) cameraInput.current.value = "";
      if (fileInput.current) fileInput.current.value = "";
      setMessage("Certificate uploaded successfully.");
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to upload certificate.",
      );
    } finally {
      setWorking(false);
    }
  }

  if (!open) return null;

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <section className={styles.modal}>
        <button className={styles.close} type="button" onClick={() => setOpen(false)}>
          ×
        </button>

        <p className={styles.kicker}>Utah OHV Requirement</p>
        <h2>Upload Driver Certificates</h2>
        <p className={styles.intro}>
          Enter the name shown on the certificate, then take a photo or choose an
          existing image or PDF.
        </p>

        {activities.length > 1 ? (
          <label className={styles.field}>
            <span>Rental</span>
            <select value={readinessId} onChange={(event) => setReadinessId(event.target.value)}>
              {activities.map((activity) => (
                <option key={activity.readinessId} value={activity.readinessId}>
                  {activity.productDisplayName}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className={styles.progress}>
          <strong>{selectedUploads.length} of {requiredCount || "—"}</strong>
          <span>{complete ? "Required certificates complete" : "Certificates uploaded"}</span>
        </div>

        {selectedUploads.length ? (
          <div className={styles.uploadList}>
            {selectedUploads.map((upload) => (
              <div key={upload.id} className={styles.uploadRow}>
                <span className={styles.check}>✓</span>
                <div>
                  <strong>{upload.driver_name}</strong>
                  <small>{upload.original_filename}</small>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <label className={styles.field}>
          <span>Driver name</span>
          <input
            value={driverName}
            onChange={(event) => setDriverName(event.target.value)}
            placeholder="Name exactly as shown on certificate"
            autoComplete="name"
          />
        </label>

        <input
          ref={cameraInput}
          className={styles.hiddenInput}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={chooseFile}
        />
        <input
          ref={fileInput}
          className={styles.hiddenInput}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/heic,image/heif"
          onChange={chooseFile}
        />

        <div className={styles.chooserRow}>
          <button type="button" onClick={() => cameraInput.current?.click()}>
            Open Camera
          </button>
          <button type="button" onClick={() => fileInput.current?.click()}>
            Choose File
          </button>
        </div>

        {file ? <p className={styles.selectedFile}>Selected: {file.name}</p> : null}
        {message ? <p className={styles.message}>{message}</p> : null}

        <button
          className={styles.uploadButton}
          type="button"
          disabled={working || !driverName.trim() || !file}
          onClick={uploadCertificate}
        >
          {working ? "Uploading…" : "Upload Certificate"}
        </button>
      </section>
    </div>
  );
}
