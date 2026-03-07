#!/usr/bin/env bash
set -euo pipefail

# Labs21 VPS Worker Deployment Script
# Target: AWS Lightsail (Ubuntu 22.04+ instance, $5/mo or higher)
#
# Usage:
#   1. Create an AWS Lightsail instance: Ubuntu 22.04 LTS, 512MB RAM minimum
#   2. SSH: ssh -i your-key.pem ubuntu@<lightsail-ip>
#   3. scp this script + the backend folder to the server
#   4. Run: bash deploy.sh
#
# Prerequisites: The .env file must exist at AiCorp/backend/.env with all required vars.

INSTALL_DIR="/opt/aicorp/backend"
SERVICE_NAME="aicorp-worker"
CRON_USER="root"

echo "=== Labs21 VPS Worker Deployment ==="

# 1. System packages
echo "[1/7] Installing system packages..."
apt-get update -qq
apt-get install -y -qq python3.11 python3.11-venv python3-pip git curl nodejs npm

# 2. Create directory structure
echo "[2/7] Setting up directory structure..."
mkdir -p "$INSTALL_DIR"
cp -r "$(dirname "$0")"/* "$INSTALL_DIR/"

# 3. Create virtual environment and install deps
echo "[3/7] Creating Python virtual environment..."
cd "$INSTALL_DIR"
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q

# 4. Install gws CLI (Google Workspace)
echo "[4/7] Installing Google Workspace CLI..."
npm install -g @googleworkspace/cli 2>/dev/null || echo "  gws install skipped (optional, configure later)"

# 5. Install systemd service
echo "[5/7] Installing systemd service..."
cat > /etc/systemd/system/${SERVICE_NAME}.service << 'UNIT'
[Unit]
Description=Labs21 AI Worker (Mission Executor + Flask API)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/aicorp/backend
EnvironmentFile=/opt/aicorp/backend/.env
ExecStart=/opt/aicorp/backend/venv/bin/python app.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=aicorp-worker

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"

# 6. Set up cron jobs for CEO reports
echo "[6/7] Setting up CEO email cron jobs..."
CRON_FILE="/etc/cron.d/labs21-ceo"
cat > "$CRON_FILE" << CRON
# Labs21 CEO Reports
# Daily briefing at 7am ET (12:00 UTC)
0 12 * * * root cd /opt/aicorp/backend && /opt/aicorp/backend/venv/bin/python ceo_daily.py daily >> /var/log/labs21-ceo.log 2>&1

# Weekly recap every Monday at 7am ET
0 12 * * 1 root cd /opt/aicorp/backend && /opt/aicorp/backend/venv/bin/python ceo_daily.py weekly >> /var/log/labs21-ceo.log 2>&1

# Monthly board meeting prep on 1st of each month at 7am ET
0 12 1 * * root cd /opt/aicorp/backend && /opt/aicorp/backend/venv/bin/python ceo_daily.py monthly >> /var/log/labs21-ceo.log 2>&1

# Heartbeat every 5 minutes (trigger evaluation + reactions)
*/5 * * * * root cd /opt/aicorp/backend && /opt/aicorp/backend/venv/bin/python -c "import requests; requests.post('https://labs21.xyz/api/ops/heartbeat', headers={'Authorization': 'Bearer ' + open('.env').read().split('OPS_API_SECRET=')[1].split('\n')[0]}, timeout=15)" >> /var/log/labs21-heartbeat.log 2>&1
CRON

chmod 644 "$CRON_FILE"

# 7. Start the service
echo "[7/7] Starting worker service..."
systemctl start "$SERVICE_NAME"
systemctl status "$SERVICE_NAME" --no-pager

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Worker status:  systemctl status $SERVICE_NAME"
echo "Worker logs:    journalctl -u $SERVICE_NAME -f"
echo "CEO email log:  tail -f /var/log/labs21-ceo.log"
echo "Heartbeat log:  tail -f /var/log/labs21-heartbeat.log"
echo ""
echo "Next steps:"
echo "  1. Verify .env is at $INSTALL_DIR/.env"
echo "  2. Test: curl http://localhost:5000/health"
echo "  3. Test CEO email: cd $INSTALL_DIR && venv/bin/python ceo_daily.py daily"
echo "  4. Optional: Set up gws auth: gws auth login -s drive,gmail,sheets,calendar"
