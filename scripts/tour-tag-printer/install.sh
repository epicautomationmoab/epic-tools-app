#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run this installer with sudo."
  exit 1
fi

INSTALL_USER="${SUDO_USER:-pi}"
INSTALL_DIR="/opt/epic-tour-tag-printer"
ENV_FILE="/etc/epic-tour-tag-printer.env"
SERVICE_FILE="/etc/systemd/system/epic-tour-tag-printer.service"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y cups cups-client librsvg2-bin ipp-usb printer-driver-all
systemctl enable --now cups
usermod -a -G lp,lpadmin "$INSTALL_USER"

install -d -m 0755 "$INSTALL_DIR"
install -m 0755 "$SCRIPT_DIR/worker.py" "$INSTALL_DIR/worker.py"

if [[ ! -f "$ENV_FILE" ]]; then
  read -r -p "Epic printer API key: " EPIC_KEY
  read -r -p "CUPS printer name (leave blank to use default): " CUPS_NAME
  cat > "$ENV_FILE" <<EOF
EPIC_PRINTER_API=https://team.myepicreservation.com/api/device/tour-tag-printer
EPIC_PRINTER_KEY=$EPIC_KEY
EPIC_PRINTER_WORKER=epic-tour-tag-printer
EPIC_PRINTER_POLL_SECONDS=15
EPIC_PRINTER_TIMEOUT_SECONDS=900
CUPS_PRINTER=$CUPS_NAME
EOF
  chmod 0600 "$ENV_FILE"
fi

sed "s/^User=.*/User=$INSTALL_USER/" "$SCRIPT_DIR/epic-tour-tag-printer.service" > "$SERVICE_FILE"
systemctl daemon-reload
systemctl enable epic-tour-tag-printer.service

echo
echo "Core printer service installed."
echo "Next: add/test the USB printer in CUPS, then run:"
echo "  sudo systemctl start epic-tour-tag-printer"
echo "  sudo journalctl -u epic-tour-tag-printer -f"
