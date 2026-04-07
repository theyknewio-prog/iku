#!/usr/bin/env bash
# scripts/setup-revenue-cron.sh
#
# Installs the daily revenue report cron on the Hetzner server.
# Run this once on the server: bash scripts/setup-revenue-cron.sh
#
# Prerequisites on the server:
#   - /opt/iku-scrapers/ must contain the repo (or a copy of scripts/)
#   - npx / tsx must be available (Node.js 18+)
#   - env vars: TELEGRAM_BOT_TOKEN, STRIPE_SECRET_KEY, DATABASE_URL
#
# Usage:
#   ssh root@204.168.233.29
#   cd /opt/iku-scrapers
#   bash scripts/setup-revenue-cron.sh

set -euo pipefail

SCRIPT_DIR="/opt/iku-scrapers/scripts"
LOG_FILE="/var/log/iku-revenue.log"
CRON_FILE="/etc/cron.d/iku-revenue"

echo "── Setting up iku.gg daily revenue cron ──────────────────────"

# 1. Copy the script
if [ ! -d "$SCRIPT_DIR" ]; then
  echo "ERROR: $SCRIPT_DIR does not exist. Deploy the repo to /opt/iku-scrapers first."
  exit 1
fi

echo "Script location : $SCRIPT_DIR/daily-revenue-report.ts"

# 2. Create log file
touch "$LOG_FILE"
echo "Log file        : $LOG_FILE"

# 3. Load env vars from .env if present
ENV_FILE="/opt/iku-scrapers/.env"
ENV_SOURCE=""
if [ -f "$ENV_FILE" ]; then
  ENV_SOURCE="set -a; source $ENV_FILE; set +a;"
  echo "Env source      : $ENV_FILE"
else
  echo "WARNING: $ENV_FILE not found."
  echo "  Create it with:"
  echo "    TELEGRAM_BOT_TOKEN=8428448598:AAFwli73qAOBXrhMYqAGLfgpBjeM5M5Ehkw"
  echo "    STRIPE_SECRET_KEY=sk_live_..."
  echo "    DATABASE_URL=postgresql://..."
  echo "    # Optional — add when API keys are obtained:"
  echo "    EXOCLICK_API_KEY=..."
  echo "    ADSTERRA_API_KEY=..."
  echo "    CRAKREVENUE_API_KEY=..."
  echo "    CHATURBATE_API_KEY=..."
fi

# 4. Write cron file (runs at 08:00 UTC every day)
cat > "$CRON_FILE" << 'CRON'
# iku.gg daily revenue report — runs at 08:00 UTC
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

0 8 * * * root set -a; source /opt/iku-scrapers/.env 2>/dev/null; set +a; cd /opt/iku-scrapers && npx tsx scripts/daily-revenue-report.ts >> /var/log/iku-revenue.log 2>&1
CRON

chmod 644 "$CRON_FILE"
echo "Cron installed  : $CRON_FILE (runs at 08:00 UTC)"

# 5. Test run (dry-run — no Telegram message sent, just prints to console)
echo ""
echo "── Running dry-run test ───────────────────────────────────────"
set -a
[ -f "$ENV_FILE" ] && source "$ENV_FILE"
set +a
cd /opt/iku-scrapers && npx tsx scripts/daily-revenue-report.ts --dry-run

echo ""
echo "── Done ───────────────────────────────────────────────────────"
echo "Cron is active. First live report will arrive at 08:00 UTC."
echo "To trigger manually: cd /opt/iku-scrapers && npx tsx scripts/daily-revenue-report.ts"
echo "To view logs: tail -f $LOG_FILE"
