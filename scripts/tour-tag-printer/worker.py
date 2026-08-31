#!/usr/bin/env python3
import json
import os
import re
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

API_URL = os.environ.get("EPIC_PRINTER_API", "https://team.myepicreservation.com/api/device/tour-tag-printer").strip()
API_KEY = os.environ.get("EPIC_PRINTER_KEY", "").strip()
PRINTER = os.environ.get("CUPS_PRINTER", "").strip()
WORKER = os.environ.get("EPIC_PRINTER_WORKER", "epic-tour-tag-printer").strip()
POLL_SECONDS = max(5, int(os.environ.get("EPIC_PRINTER_POLL_SECONDS", "15")))
PRINT_TIMEOUT_SECONDS = max(60, int(os.environ.get("EPIC_PRINTER_TIMEOUT_SECONDS", "900")))


def log(message: str):
    print(time.strftime("%Y-%m-%d %H:%M:%S"), message, flush=True)


def api(action: str, **extra):
    payload = {"action": action, "worker": WORKER, **extra}
    request = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "EpicTourTagPrinter/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            if response.status == 204:
                return None
            body = response.read().decode("utf-8")
            return json.loads(body) if body else None
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Printer API HTTP {exc.code}: {body}") from exc


def run(command, timeout=60):
    result = subprocess.run(command, text=True, capture_output=True, timeout=timeout)
    if result.returncode != 0:
        raise RuntimeError((result.stderr or result.stdout or "Command failed").strip())
    return result.stdout.strip()


def cups_job_id(lp_output: str):
    match = re.search(r"request id is\s+([^\s]+)", lp_output, re.IGNORECASE)
    if not match:
        raise RuntimeError(f"Could not read CUPS job id from: {lp_output}")
    return match.group(1)


def wait_for_print(job_id: str):
    deadline = time.time() + PRINT_TIMEOUT_SECONDS
    while time.time() < deadline:
        active = subprocess.run(
            ["lpstat", "-W", "not-completed", "-o", job_id],
            text=True,
            capture_output=True,
            timeout=20,
        )
        if active.returncode != 0 or not active.stdout.strip():
            completed = subprocess.run(
                ["lpstat", "-W", "completed", "-o", job_id],
                text=True,
                capture_output=True,
                timeout=20,
            )
            if completed.returncode == 0 and completed.stdout.strip():
                return
            # Some CUPS configurations discard completed history quickly. If the
            # job is no longer pending after at least a few seconds, treat it as done.
            return
        time.sleep(3)

    subprocess.run(["cancel", job_id], text=True, capture_output=True, timeout=20)
    raise RuntimeError(f"CUPS job {job_id} did not finish within {PRINT_TIMEOUT_SECONDS} seconds and was cancelled.")


def print_svg(svg: str, confirmation: str):
    with tempfile.TemporaryDirectory(prefix="epic-tour-tag-") as tempdir:
        svg_path = os.path.join(tempdir, "tag.svg")
        pdf_path = os.path.join(tempdir, "tag.pdf")
        with open(svg_path, "w", encoding="utf-8") as handle:
            handle.write(svg)

        run(["rsvg-convert", "-f", "pdf", "-o", pdf_path, svg_path], timeout=30)

        command = ["lp"]
        if PRINTER:
            command += ["-d", PRINTER]
        command += [
            "-t", f"Epic Vehicle Tag {confirmation}",
            "-o", "media=Letter",
            "-o", "landscape",
            "-o", "sides=one-sided",
            pdf_path,
        ]
        output = run(command, timeout=30)
        job_id = cups_job_id(output)
        log(f"Submitted {job_id} for {confirmation}")
        wait_for_print(job_id)
        log(f"Completed {job_id} for {confirmation}")


def process_one():
    claimed = api("claim")
    if not claimed:
        return False

    job = claimed["job"]
    job_id = job["id"]
    confirmation = job.get("confirmation_code", "unknown")
    try:
        api("printing", job_id=job_id)
        print_svg(claimed["svg"], confirmation)
        api("complete", job_id=job_id)
    except Exception as exc:
        log(f"Print failed for {confirmation}: {exc}")
        try:
            api("fail", job_id=job_id, error=str(exc))
        except Exception as report_error:
            log(f"Could not report failure: {report_error}")
    return True


def main():
    if not API_KEY:
        raise SystemExit("EPIC_PRINTER_KEY is required.")
    log(f"Tour tag printer started. API={API_URL} printer={PRINTER or 'CUPS default'} poll={POLL_SECONDS}s")
    while True:
        try:
            while process_one():
                pass
        except Exception as exc:
            log(f"Worker cycle failed: {exc}")
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
