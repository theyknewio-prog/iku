#!/bin/bash
# ──────────────────────────────────────────────────────────────
# Setup warmup cron on Hetzner
#
# Run ONCE via:
#   ssh root@204.168.233.29 'bash -s' < scripts/setup-warmup-cron.sh
#
# What it does:
#   - Finds the running iku app container
#   - Installs host-side cron that runs warmup-cron.mjs inside the container
#     every 4 minutes (so localhost:3000 is reachable without port exposure)
#   - Logs to /var/log/iku-warmup.log
# ──────────────────────────────────────────────────────────────
set -e

LOG=/var/log/iku-warmup.log
touch "$LOG"

echo "=== Setting up warmup cron on $(hostname) ==="

# Find the app container (name starts with the Coolify app UUID)
APP_CID=$(docker ps --format '{{.ID}} {{.Names}}' | grep -E 'hjta50cv9nfem56atjtwmlx1' | awk '{print $1}' | head -n1)
if [ -z "$APP_CID" ]; then
  echo "ERROR: iku app container not found (hjta50cv9nfem56atjtwmlx1)"
  exit 1
fi
echo "App container: $APP_CID"

# Warmup runner — exec inside the container so localhost:3000 works without publishing ports
cat > /opt/iku-warmup-run.sh << 'RUNNER'
#!/bin/bash
APP_CID=$(docker ps --format '{{.ID}} {{.Names}}' | grep -E 'hjta50cv9nfem56atjtwmlx1' | awk '{print $1}' | head -n1)
if [ -z "$APP_CID" ]; then
  echo "$(date -Iseconds) [warmup] app container missing"
  exit 0
fi
# The container has node + fetch + pg built in (standalone output)
docker exec "$APP_CID" node /app/scripts/warmup-cron.mjs 2>&1
RUNNER
chmod +x /opt/iku-warmup-run.sh

# Cron — every 4 minutes
cat > /etc/cron.d/iku-warmup << CRON
# iku.gg warmup — keeps memoize cache hot for top ~56 pages
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

*/4 * * * * root /opt/iku-warmup-run.sh >> $LOG 2>&1
CRON
chmod 644 /etc/cron.d/iku-warmup

echo "Cron installed → /etc/cron.d/iku-warmup"
echo "Log: $LOG"
echo ""
echo "Test now with: /opt/iku-warmup-run.sh"
