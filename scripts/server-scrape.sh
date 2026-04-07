#!/bin/sh
# =============================================================================
# server-scrape.sh — Daily scraper cron running inside the Docker app container
# =============================================================================
#
# SETUP GUIDE (run these commands once on the Hetzner server via SSH):
#
# STEP 1 — Find the app container name:
#   docker ps --format '{{.Names}}' | grep hjta50cv9nfem56atjtwmlx1
#   (example result: hjta50cv9nfem56atjtwmlx1-iku-1)
#   Store it: CONTAINER=hjta50cv9nfem56atjtwmlx1-iku-1
#
# STEP 2 — Create the log directory on the HOST (survives container restarts):
#   mkdir -p /var/log/iku-scrape
#
# STEP 3 — Add a cron job on the HOST (runs daily at 04:00 UTC):
#   crontab -e
#   Then add this line (replace CONTAINER_NAME with the real name from step 1):
#
#   0 4 * * * CONTAINER=$(docker ps --format '{{.Names}}' | grep hjta50cv9nfem56atjtwmlx1 | head -1); [ -n "$CONTAINER" ] && docker exec "$CONTAINER" /bin/sh /app/scripts/server-scrape.sh >> /var/log/iku-scrape/scrape.log 2>&1
#
#   This auto-discovers the container name at runtime, so it survives redeploys.
#
# STEP 4 — Verify env vars are injected by Coolify into the container:
#   docker exec $CONTAINER env | grep -E 'DATABASE_URL|GELBOORU|RULE34'
#   You should see all 5 variables. If not, check Coolify env var panel.
#
# STEP 5 — Test manually before relying on cron:
#   docker exec $CONTAINER /bin/sh /app/scripts/server-scrape.sh
#   tail -f /var/log/iku-scrape/scrape.log
#
# STEP 6 — Rotate logs weekly (prevent disk fill). Add to crontab:
#   0 3 * * 1 find /var/log/iku-scrape -name '*.log' -mtime +30 -delete
#
# WHY this approach:
# - GitHub Actions account is flagged/blocked — cron on host is the fallback.
# - The Docker app container already has Node.js 20, npx, tsx, and all
#   node_modules installed. No reinstall needed.
# - Coolify injects env vars into the container at startup — DATABASE_URL,
#   GELBOORU_API_KEY, GELBOORU_USER_ID, RULE34_API_KEY, RULE34_USER_ID are
#   all available inside the container without any extra config.
# - Running inside the container means the scraper connects to iku-postgres
#   via the Docker Coolify network (hostname "iku-postgres") — same as the
#   Next.js app itself. No port exposure needed.
# - timeout(1) kills a hanging scraper after 10 min so a stuck scraper cannot
#   block the rest of the batch. Total max wall time: ~65 min.
#
# =============================================================================

set -e

WORKDIR="/app"
TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M:%S UTC')
LOG_PREFIX="[iku-scrape]"

log() {
    echo "$LOG_PREFIX [$( date -u '+%H:%M:%S')] $1"
}

# ---------------------------------------------------------------------------
# Sanity checks
# ---------------------------------------------------------------------------

log "===== SCRAPE START — $TIMESTAMP ====="

if [ -z "$DATABASE_URL" ]; then
    log "ERROR: DATABASE_URL is not set. Aborting."
    exit 1
fi

# Verify Node / tsx are available
if ! command -v node > /dev/null 2>&1; then
    log "ERROR: node not found in PATH."
    exit 1
fi

log "Node: $(node --version)"
log "Working directory: $WORKDIR"
cd "$WORKDIR"

# ---------------------------------------------------------------------------
# Helper: run a single scraper with a 10-minute timeout
# Returns 0 on success, 1 on failure — never aborts the whole batch.
# ---------------------------------------------------------------------------

run_scraper() {
    SCRIPT_NAME="$1"
    SCRIPT_PATH="scripts/$SCRIPT_NAME"

    log "--- START $SCRIPT_NAME ---"
    START_TS=$(date +%s)

    # timeout(1) is POSIX and available in Alpine. 600s = 10 min.
    if timeout 600 npx tsx "$SCRIPT_PATH"; then
        END_TS=$(date +%s)
        ELAPSED=$((END_TS - START_TS))
        log "--- OK $SCRIPT_NAME (${ELAPSED}s) ---"
        return 0
    else
        EXIT_CODE=$?
        END_TS=$(date +%s)
        ELAPSED=$((END_TS - START_TS))
        if [ "$EXIT_CODE" = "124" ]; then
            log "--- TIMEOUT $SCRIPT_NAME after 600s (killed) ---"
        else
            log "--- FAIL $SCRIPT_NAME exit=$EXIT_CODE (${ELAPSED}s) ---"
        fi
        return 1
    fi
}

# ---------------------------------------------------------------------------
# Run all scrapers — continue-on-error for each (mirrors GitHub Actions config)
# ---------------------------------------------------------------------------

FAIL_COUNT=0

run_scraper "scrape-danbooru.ts"     || FAIL_COUNT=$((FAIL_COUNT + 1))
run_scraper "scrape-gelbooru.ts"     || FAIL_COUNT=$((FAIL_COUNT + 1))
run_scraper "scrape-rule34.ts"       || FAIL_COUNT=$((FAIL_COUNT + 1))
run_scraper "scrape-rule34video.ts"  || FAIL_COUNT=$((FAIL_COUNT + 1))
run_scraper "scrape-wp-sites.ts"     || FAIL_COUNT=$((FAIL_COUNT + 1))
run_scraper "enrich-wp-thumbnails.ts" || FAIL_COUNT=$((FAIL_COUNT + 1))

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

END_TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M:%S UTC')

if [ "$FAIL_COUNT" = "0" ]; then
    log "===== SCRAPE COMPLETE — all scrapers OK — $END_TIMESTAMP ====="
else
    log "===== SCRAPE COMPLETE — $FAIL_COUNT scraper(s) failed — $END_TIMESTAMP ====="
fi

# Exit 0 regardless: we don't want the host cron to flag this as a cron failure
# just because one scraper had a transient error. Check the log for details.
exit 0
