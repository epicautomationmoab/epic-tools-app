# Epic Tour Tag Printer

This is the local Raspberry Pi worker for automatically printing Tour Dispatch windshield tags.

## What is already automated

- Supabase creates one print job per guest-driven vehicle slot.
- Jobs become due one hour before the tour departure time.
- The Pi polls the Epic Tools device API and claims one due job at a time.
- Epic Tools renders the exact same SVG tag template used by the manual native-print buttons.
- The Pi converts the SVG to PDF, submits it to CUPS as Letter landscape, waits for the CUPS job to leave the queue, and reports success/failure.
- Failed jobs retry; stale claimed/printing leases can be reclaimed after a crash or power outage.
- systemd restarts the worker automatically after reboot or failure.
- Printer authentication is stored as a hashed device token in Supabase, so no additional Vercel environment variable is required.

## Pi arrival checklist

1. Assemble the Pi 5, active cooler and case.
2. Boot Raspberry Pi OS from the included microSD card and connect Wi-Fi or Ethernet.
3. Connect the printer to the Pi by USB.
4. Provision one dedicated Epic printer device token using the server-only `provision_tour_tag_printer_device` function.
5. Copy this `scripts/tour-tag-printer` folder to the Pi.
6. Run `sudo ./install.sh` and enter the one-time printer token when prompted.
7. Configure the USB printer in CUPS and make it the default, or enter its CUPS queue name in `/etc/epic-tour-tag-printer.env`.
8. Start the service and test one controlled print job.

## Configuration

`/etc/epic-tour-tag-printer.env`:

- `EPIC_PRINTER_API` - Epic Tools printer device endpoint.
- `EPIC_PRINTER_KEY` - dedicated printer credential. The plaintext token exists only on the Pi; Supabase stores its SHA-256 hash.
- `EPIC_PRINTER_WORKER` - audit name written to claimed jobs.
- `EPIC_PRINTER_POLL_SECONDS` - normal poll interval; 15 seconds by default.
- `EPIC_PRINTER_TIMEOUT_SECONDS` - maximum time a CUPS job may remain active before it is cancelled and retried.
- `CUPS_PRINTER` - optional explicit CUPS queue name. Blank uses the CUPS default printer.

## Useful commands

```bash
lpstat -p -d
lpinfo -v
sudo systemctl status epic-tour-tag-printer
sudo journalctl -u epic-tour-tag-printer -f
sudo systemctl restart epic-tour-tag-printer
```

## Remaining arrival-time work

The exact printer model is intentionally not hard-coded. When the Pi arrives, confirm the USB printer/driver in CUPS and perform one alignment print on plain Letter paper. The software and print-job flow do not depend on the printer model.
