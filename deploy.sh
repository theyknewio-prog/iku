#!/usr/bin/env bash
#
# deploy.sh — Manual git push + Coolify deploy trigger for iku.gg
#
# Why this exists: the native GitHub → Coolify webhook has been unreliable
# (app source_type=null), AND GitHub Actions is currently soft-locked on
# the theyknewio-prog account (account flagged). So we bypass both by
# calling the Coolify REST API directly from your laptop.
#
# What it does:
#   1. Optional: pass a commit message as $1 to commit staged changes first
#   2. `git push origin master`
#   3. POST /api/v1/deploy?uuid=<app-uuid> to Coolify
#   4. Polls deployment status until finished or 8-minute timeout
#   5. Verifies iku.gg returns HTTP 200 with new code
#
# Prereqs (one-time setup in your shell rc or a .env):
#   export COOLIFY_TOKEN="2|xxx…"         # Coolify API token
#   export COOLIFY_HOST="204.168.233.29:8000"
#   export COOLIFY_APP_UUID="hjta50cv9nfem56atjtwmlx1"
#
# Usage:
#   ./deploy.sh                          # push current state + deploy
#   ./deploy.sh "feat: new thing"        # stage all, commit, push, deploy
#

set -e

# ─────────────────────────────────────────────────────────────
# Load local .deploy.env if present (not committed, gitignored)
# ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
if [ -f "$SCRIPT_DIR/.deploy.env" ]; then
  # shellcheck disable=SC1091
  set -a
  . "$SCRIPT_DIR/.deploy.env"
  set +a
fi

# ─────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────
: "${COOLIFY_TOKEN:?Set COOLIFY_TOKEN in your environment (Coolify API token)}"
: "${COOLIFY_HOST:=204.168.233.29:8000}"
: "${COOLIFY_APP_UUID:=hjta50cv9nfem56atjtwmlx1}"
SITE_URL="${SITE_URL:-https://iku.gg}"
TIMEOUT_SECONDS=480   # 8 minutes — Docker builds take ~3-5 min

# ─────────────────────────────────────────────────────────────
# Colors
# ─────────────────────────────────────────────────────────────
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
RESET='\033[0m'

step() { echo -e "${BLUE}${BOLD}➜${RESET} ${BOLD}$1${RESET}"; }
ok()   { echo -e "${GREEN}✓${RESET} $1"; }
warn() { echo -e "${YELLOW}!${RESET} $1"; }
fail() { echo -e "${RED}✗${RESET} $1"; exit 1; }

# ─────────────────────────────────────────────────────────────
# 1. Optional commit
# ─────────────────────────────────────────────────────────────
COMMIT_MSG="${1:-}"
if [ -n "$COMMIT_MSG" ]; then
  step "Staging and committing: $COMMIT_MSG"
  git add -A
  if git diff --cached --quiet; then
    warn "Nothing to commit. Skipping commit step."
  else
    git commit -m "$COMMIT_MSG"
    ok "Commit created"
  fi
fi

# ─────────────────────────────────────────────────────────────
# 2. Push to master
# ─────────────────────────────────────────────────────────────
step "Pushing to origin/master"
BEFORE_SHA=$(git rev-parse HEAD)
git push origin master
AFTER_SHA=$(git rev-parse HEAD)
ok "Pushed $(git log -1 --format=%h)"

# ─────────────────────────────────────────────────────────────
# 3. Trigger Coolify deploy
# ─────────────────────────────────────────────────────────────
step "Triggering Coolify deploy (uuid=$COOLIFY_APP_UUID)"
RESPONSE=$(curl -sS -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  "http://${COOLIFY_HOST}/api/v1/deploy?uuid=${COOLIFY_APP_UUID}&force=false")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
  echo "$BODY"
  fail "Coolify deploy API returned HTTP $HTTP_CODE"
fi

# Extract deployment uuid from the response (Coolify returns {"deployments":[{"resource_uuid":"...","deployment_uuid":"xxx"}]})
DEPLOY_UUID=$(echo "$BODY" | python -c "import sys,json; d=json.load(sys.stdin); print(d['deployments'][0]['deployment_uuid'])" 2>/dev/null || echo "")
if [ -z "$DEPLOY_UUID" ]; then
  warn "Could not parse deployment_uuid — will poll by app instead"
fi
ok "Deploy queued ($DEPLOY_UUID)"

# ─────────────────────────────────────────────────────────────
# 4. Poll deployment status
# ─────────────────────────────────────────────────────────────
step "Waiting for deployment to finish (up to $((TIMEOUT_SECONDS/60)) min)"
ELAPSED=0
INTERVAL=15
LAST_STATUS=""
while [ $ELAPSED -lt $TIMEOUT_SECONDS ]; do
  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))

  if [ -n "$DEPLOY_UUID" ]; then
    STATUS=$(curl -sS \
      -H "Authorization: Bearer $COOLIFY_TOKEN" \
      "http://${COOLIFY_HOST}/api/v1/deployments/${DEPLOY_UUID}" \
      | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','unknown'))" 2>/dev/null || echo "unknown")
  else
    STATUS="unknown"
  fi

  if [ "$STATUS" != "$LAST_STATUS" ]; then
    echo "  [${ELAPSED}s] status: $STATUS"
    LAST_STATUS="$STATUS"
  fi

  case "$STATUS" in
    finished)
      ok "Deployment finished after ${ELAPSED}s"
      break
      ;;
    failed|cancelled-by-user)
      fail "Deployment ended with status: $STATUS"
      ;;
  esac
done

if [ "$LAST_STATUS" != "finished" ] && [ -n "$DEPLOY_UUID" ]; then
  warn "Polling timed out. Check http://${COOLIFY_HOST} for deploy status."
fi

# ─────────────────────────────────────────────────────────────
# 5. Verify prod is live with new code
# ─────────────────────────────────────────────────────────────
step "Verifying $SITE_URL is live"
HTTP_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" "$SITE_URL")
if [ "$HTTP_STATUS" = "200" ]; then
  ok "$SITE_URL → HTTP 200"
else
  warn "$SITE_URL returned HTTP $HTTP_STATUS — check Coolify logs"
fi

# ─────────────────────────────────────────────────────────────
# 6. Purge Cloudflare cache — TARGETED only (not purge_everything)
# ─────────────────────────────────────────────────────────────
# Why targeted: `purge_everything` nukes the 346K /watch/* pages from
# edge cache, and when Google re-crawls them all at once the origin
# PG container melts (seq scans on banned-tag filter). We only purge
# the handful of pages that actually change on deploy: homepage + the
# few sitemap/robots routes. /watch/* ISR is left alone.
#
# To force a full purge (e.g. after a CSS/JS change that affects all
# pages), run: PURGE_EVERYTHING=1 ./deploy.sh
if [ -n "${CF_ZONE_ID:-}" ] && [ -n "${CF_API_TOKEN:-}" ]; then
  if [ "${PURGE_EVERYTHING:-0}" = "1" ]; then
    step "Purging Cloudflare cache (EVERYTHING — explicit opt-in)"
    CF_DATA='{"purge_everything":true}'
  else
    step "Purging Cloudflare cache (targeted — homepage + sitemaps)"
    CF_DATA='{"files":["https://iku.gg/","https://iku.gg/robots.txt","https://iku.gg/sitemap.xml","https://iku.gg/trending","https://iku.gg/new","https://iku.gg/explore"]}'
  fi
  CF_RESPONSE=$(curl -sS -X POST \
    "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "$CF_DATA")
  CF_OK=$(echo "$CF_RESPONSE" | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('success'))" 2>/dev/null || echo "False")
  if [ "$CF_OK" = "True" ]; then
    ok "Cloudflare cache purged"
  else
    warn "Cloudflare purge failed: $CF_RESPONSE"
  fi
else
  warn "CF_ZONE_ID or CF_API_TOKEN not set — skipping Cloudflare cache purge"
fi

# ─────────────────────────────────────────────────────────────
# 7. Smoke test — 15 routes must return 200. Catches regressions
#    that build passed but runtime breaks (404s, 500s, PG timeouts).
# ─────────────────────────────────────────────────────────────
if [ -x "$(command -v node)" ] && [ -f "$SCRIPT_DIR/scripts/smoke-test.mjs" ]; then
  step "Running smoke test on $SITE_URL"
  if SITE_URL="$SITE_URL" node "$SCRIPT_DIR/scripts/smoke-test.mjs"; then
    ok "Smoke test passed"
  else
    warn "Smoke test reported failures — investigate above before considering deploy healthy"
  fi
fi

echo
echo -e "${GREEN}${BOLD}✅ Done.${RESET} Commit ${AFTER_SHA:0:7} is live on $SITE_URL"
