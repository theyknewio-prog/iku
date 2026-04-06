#!/bin/bash
# ──────────────────────────────────────────────────────────────
# Setup SEO Autopilot cron on Hetzner
#
# Run ONCE via:
#   ssh root@204.168.233.29 'bash -s' < scripts/setup-seo-cron.sh
#
# What it does:
#   1. Installs Node.js 20 if missing
#   2. Clones the repo to /opt/iku-seo
#   3. Copies the GSC service account key
#   4. Installs deps
#   5. Sets up cron: 2x/day (8h + 20h Paris = 6h + 18h UTC)
# ──────────────────────────────────────────────────────────────
set -e

WORK_DIR="/opt/iku-seo"
LOG="/var/log/iku-seo.log"
GSC_KEY="$WORK_DIR/gsc-service-account.json"

echo "=== Setting up SEO Autopilot on $(hostname) ==="

# 1. Node.js
if ! command -v node &>/dev/null; then
  echo "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "Node: $(node -v)"

# 2. Clone/update repo
if [ -d "$WORK_DIR/.git" ]; then
  echo "Updating existing repo..."
  cd "$WORK_DIR" && git pull origin master
else
  echo "Cloning repo..."
  # Use the same token Coolify uses
  COOLIFY_DB=$(docker exec coolify cat /data/coolify/database/database.sqlite 2>/dev/null || true)
  # Fallback: manual clone
  echo "Please run: git clone https://<TOKEN>@github.com/theyknewio-prog/iku.git $WORK_DIR"
  echo "Then re-run this script."
  mkdir -p "$WORK_DIR"
fi

# 3. Install deps (just googleapis)
cd "$WORK_DIR"
if [ -f package.json ]; then
  npm install googleapis --save-dev 2>/dev/null
  echo "Dependencies installed"
fi

# 4. Create the runner script
cat > /opt/iku-seo-run.sh << 'RUNNER'
#!/bin/bash
cd /opt/iku-seo

# Pull latest
git pull origin master --quiet 2>/dev/null || true

# Run autopilot
node scripts/seo-autopilot.mjs 2>&1

# The script handles git commit + push internally
RUNNER
chmod +x /opt/iku-seo-run.sh

# 5. Install cron
cat > /etc/cron.d/iku-seo << CRON
# SEO Autopilot — 2x/day (8h + 20h Paris = 6h + 18h UTC)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

0 6 * * * root /opt/iku-seo-run.sh >> $LOG 2>&1
0 18 * * * root /opt/iku-seo-run.sh >> $LOG 2>&1
CRON
chmod 644 /etc/cron.d/iku-seo

echo ""
echo "=== DONE ==="
echo "Cron: 6h UTC (8h Paris) + 18h UTC (20h Paris)"
echo "Log: $LOG"
echo ""
echo "IMPORTANT: You still need to:"
echo "  1. Copy gsc-service-account.json to $GSC_KEY"
echo "  2. Make sure git push works from $WORK_DIR"
echo ""
echo "Test now with: /opt/iku-seo-run.sh"
