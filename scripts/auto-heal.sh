#!/bin/bash
# auto-heal.sh — runs every 15 min on Hetzner, silently fixes common fires.
# Only pings Telegram when a fix actually ran (not on every heartbeat).

set -u
LOG=/var/log/iku-auto-heal.log
STATE=/var/lib/iku-auto-heal
mkdir -p "$STATE"

: "${TELEGRAM_BOT_TOKEN:=}"
: "${TELEGRAM_CHAT_ID:=5617056258}"

log() { echo "[$(date -Is)] $*" >> "$LOG"; }

ping_sab() {
  local msg="$1"
  [ -z "$TELEGRAM_BOT_TOKEN" ] && return
  curl -sS -m 8 -X POST \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=🛠️ auto-heal: ${msg}" \
    --data-urlencode "parse_mode=HTML" > /dev/null || true
}

# ---- 1. PG CPU > 80% sustained → restart container ----
PG_CPU=$(docker stats --no-stream --format '{{.CPUPerc}}' iku-postgres 2>/dev/null | tr -d '%' | cut -d. -f1)
if [ -n "${PG_CPU:-}" ] && [ "$PG_CPU" -gt 80 ]; then
  # Confirm sustained load before restarting. The hourly precompute (cron iku-precompute-counts)
  # spikes PG to 80-230% CPU for 3-5 seconds at XX:00, and */15 auto-heal runs collide with it.
  # A real overload lasts minutes; a precompute spike is gone after one 20s sample.
  sleep 20
  PG_CPU_2=$(docker stats --no-stream --format '{{.CPUPerc}}' iku-postgres 2>/dev/null | tr -d '%' | cut -d. -f1)
  if [ -n "${PG_CPU_2:-}" ] && [ "$PG_CPU_2" -gt 80 ]; then
    last_pg_heal=$(cat "$STATE/last_pg_heal" 2>/dev/null || echo 0)
    now=$(date +%s)
    if [ $((now - last_pg_heal)) -gt 1800 ]; then
      log "PG CPU ${PG_CPU}%→${PG_CPU_2}% sustained — restarting iku-postgres"
      docker restart iku-postgres > /dev/null 2>&1
      echo "$now" > "$STATE/last_pg_heal"
      ping_sab "PG saturé (${PG_CPU_2}% CPU sustained) → restart. Site reprend."
    fi
  else
    log "PG CPU spike ${PG_CPU}% (transient, now ${PG_CPU_2:-?}%) — no restart"
  fi
fi

# ---- 2. Disque > 85% → purge ISR cache + old logs ----
DISK_PCT=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
if [ "${DISK_PCT:-0}" -gt 85 ]; then
  log "Disk ${DISK_PCT}% — purging caches"
  APP_CNT=$(docker ps --filter name=hjta50cv9nfem56atjtwmlx1 -q)
  if [ -n "$APP_CNT" ]; then
    docker exec "$APP_CNT" sh -c 'find /app/.next/cache -type f -mtime +1 -delete 2>/dev/null' || true
  fi
  find /var/log -type f -name '*.log' -size +100M -mtime +3 -exec truncate -s 10M {} \; 2>/dev/null
  journalctl --vacuum-time=3d > /dev/null 2>&1
  DISK_AFTER=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
  ping_sab "Disque ${DISK_PCT}% → nettoyé, maintenant ${DISK_AFTER}%."
fi

# ---- 3. App dead (non-2xx / unreachable) OR slow (TTFB>5s) → app restart ----
# Probe the app directly through local Traefik (--resolve to 127.0.0.1), bypassing Cloudflare.
# WHY: a hung Node process keeps the container "Running" so check #5 never fires, and a failed
# curl reports time_starttransfer=0 — the OLD check read that as "0ms = instant = healthy" and
# sat on a dead site for 17h (incident 2026-05-16). The fix keys off the HTTP CODE, not speed.
# /api/health is a dynamic route — a frozen event loop physically cannot serve a 200.
PROBE=$(curl -sk -o /dev/null --max-time 15 --resolve iku.gg:443:127.0.0.1 \
  -w '%{http_code} %{time_starttransfer}' https://iku.gg/api/health 2>/dev/null)
HOME_CODE=$(echo "$PROBE" | awk '{print $1}')
HOME_MS=$(echo "$PROBE" | awk '{print int($2*1000)}')
[ -z "${HOME_CODE:-}" ] && HOME_CODE=000
[ -z "${HOME_MS:-}" ] && HOME_MS=0

APP_DEAD=0
case "$HOME_CODE" in
  200) [ "$HOME_MS" -gt 5000 ] && APP_DEAD=1 ;;  # responds but too slow
  *)   APP_DEAD=1 ;;                              # 000 / 5xx / 502 / 522 = hung or down
esac

if [ "$APP_DEAD" = "1" ]; then
  last_app_heal=$(cat "$STATE/last_app_heal" 2>/dev/null || echo 0)
  now=$(date +%s)
  if [ $((now - last_app_heal)) -gt 1200 ]; then
    APP_CNT=$(docker ps --filter name=hjta50cv9nfem56atjtwmlx1 -q | head -1)
    DUMP="none"
    if [ -n "$APP_CNT" ]; then
      # Capture forensics BEFORE restart — past freezes were silent (no logs at all).
      DUMP="$STATE/freeze-$(date +%Y%m%d-%H%M%S)"
      docker logs --tail 150 "$APP_CNT" > "${DUMP}.log" 2>&1 || true
      docker stats --no-stream "$APP_CNT" > "${DUMP}.stats" 2>&1 || true
    fi
    log "app probe HTTP ${HOME_CODE} (${HOME_MS}ms) — restarting app, forensics: ${DUMP}"
    [ -n "$APP_CNT" ] && docker restart "$APP_CNT" > /dev/null 2>&1
    echo "$now" > "$STATE/last_app_heal"
    streak=$(cat "$STATE/app_heal_streak" 2>/dev/null || echo 0)
    streak=$((streak + 1))
    echo "$streak" > "$STATE/app_heal_streak"
    if [ "$streak" -ge 3 ]; then
      ping_sab "🚨 App relancée ${streak}× d'affilée (HTTP ${HOME_CODE}) — ça reboucle, intervention manuelle requise."
    else
      ping_sab "🚨 App morte (HTTP ${HOME_CODE}, ${HOME_MS}ms) → restart. Site reprend."
    fi
  else
    log "app probe HTTP ${HOME_CODE} (${HOME_MS}ms) but in cooldown ($((now - last_app_heal))s < 1200s) — no restart"
  fi
else
  echo 0 > "$STATE/app_heal_streak"
fi

# ---- 4. iku-postgres stopped ? → restart ----
PG_RUNNING=$(docker inspect -f '{{.State.Running}}' iku-postgres 2>/dev/null)
if [ "$PG_RUNNING" != "true" ]; then
  log "iku-postgres not running — starting"
  docker start iku-postgres > /dev/null 2>&1
  ping_sab "🚨 PG était down → relancé."
fi

# ---- 5. App container stopped ? → start ----
APP_CNT=$(docker ps -a --filter name=hjta50cv9nfem56atjtwmlx1 -q | head -1)
if [ -n "$APP_CNT" ]; then
  APP_RUNNING=$(docker inspect -f '{{.State.Running}}' "$APP_CNT" 2>/dev/null)
  if [ "$APP_RUNNING" != "true" ]; then
    log "app container stopped — starting"
    docker start "$APP_CNT" > /dev/null 2>&1
    ping_sab "🚨 App container down → relancé."
  fi
fi

# ---- 6. Firewall drift check — make sure 5432 still blocked from outside ----
if ! iptables -L DOCKER-USER -n 2>/dev/null | grep -q 'DROP.*tcp dpt:5432'; then
  log "iptables 5432 DROP rule missing — reinstalling"
  iptables -I DOCKER-USER -p tcp --dport 5432 -s 172.16.0.0/12 -j RETURN 2>/dev/null
  iptables -I DOCKER-USER -p tcp --dport 5432 -s 10.0.0.0/8 -j RETURN 2>/dev/null
  iptables -I DOCKER-USER -p tcp --dport 5432 -s 127.0.0.1 -j RETURN 2>/dev/null
  iptables -A DOCKER-USER -p tcp --dport 5432 -j DROP 2>/dev/null
  iptables-save > /etc/iptables/rules.v4 2>/dev/null
  ping_sab "Firewall 5432 avait sauté → remis."
fi

log "heartbeat OK (pg=${PG_CPU:-?}% disk=${DISK_PCT:-?}% home=${HOME_CODE:-?}/${HOME_MS:-?}ms)"
