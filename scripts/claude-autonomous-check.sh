#!/bin/bash
# claude-autonomous-check.sh — runs 3x/day on Hetzner.
# Claude reads the site state, logs, metrics, and either fixes what it can
# or pings Telegram with a clear, non-technical summary for Sab.

set -u

LOG=/var/log/iku-claude-check.log
STATE=/var/lib/iku-claude-check
mkdir -p "$STATE"

: "${TELEGRAM_BOT_TOKEN:=}"
: "${TELEGRAM_CHAT_ID:=5617056258}"
: "${ANTHROPIC_API_KEY:=}"

log() { echo "[$(date -Is)] $*" >> "$LOG"; }

if [ -z "$ANTHROPIC_API_KEY" ]; then
  log "ANTHROPIC_API_KEY missing — aborting."
  exit 0
fi

RUN_ID=$(date +%Y%m%d-%H%M)
WORKDIR=/tmp/iku-claude-$RUN_ID
mkdir -p "$WORKDIR"
cd "$WORKDIR"

# Collect snapshot — Claude reads these files to diagnose.
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' > docker-stats.txt 2>&1
docker ps --format 'table {{.Names}}\t{{.Status}}' > docker-ps.txt 2>&1
df -h / > disk.txt 2>&1
free -h > memory.txt 2>&1
uptime > uptime.txt 2>&1
tail -200 /var/log/iku-auto-heal.log > auto-heal-tail.txt 2>&1
docker logs --tail 100 iku-postgres 2>&1 | tail -50 > pg-logs.txt
APP_CNT=$(docker ps --filter name=hjta50cv9nfem56atjtwmlx1 -q | head -1)
if [ -n "$APP_CNT" ]; then
  docker logs --tail 100 "$APP_CNT" 2>&1 | tail -60 > app-logs.txt
fi

# Measure key routes from inside the server (bypass CF cache to see true origin perf).
{
  for route in / /trending /new /explore /hentai /feed; do
    ms=$(curl -sS -o /dev/null --max-time 15 -w '%{time_starttransfer}' \
      -H 'Cache-Control: no-cache' "https://iku.gg$route" 2>/dev/null \
      | awk '{print int($1*1000)}')
    echo "$route ${ms:-TIMEOUT}ms"
  done
} > route-perf.txt 2>&1

cat > PROMPT.md <<'EOF'
Tu es l'agent d'auto-maintenance d'iku.gg. Sab dort ou bosse ailleurs — il ne veut PAS être réveillé sauf urgence.

Context: iku.gg tourne sur un Hetzner CX33 (Docker + Coolify + PostgreSQL). Un cron `auto-heal.sh` tourne déjà toutes les 15 min et gère les cas simples (PG saturé, disque plein, container down, firewall drift). TOI tu interviens 3× par jour pour détecter ce que auto-heal ne peut pas : bugs subtils, dégradations progressives, erreurs applicatives répétées.

Files dans ce répertoire (cwd) :
- docker-stats.txt — CPU/RAM par container
- docker-ps.txt — containers running
- disk.txt — df -h
- memory.txt — free -h
- uptime.txt — load average
- auto-heal-tail.txt — dernières 200 lignes du log auto-heal
- pg-logs.txt — 50 dernières lignes de PostgreSQL
- app-logs.txt — 60 dernières lignes du container Next.js
- route-perf.txt — TTFB par route principale (mesuré depuis le serveur, no-cache)

Ta mission :
1. Lire les fichiers ci-dessus.
2. Identifier si quelque chose cloche. Seuils attendus :
   - Routes cached HIT < 200ms, route cold < 3s
   - PG CPU stable < 40% en régime normal
   - Disque < 80%
   - Zero erreurs répétées (>5×) dans app-logs
3. Si tout va bien → répondre exactement "OK" sur une seule ligne. Rien d'autre.
4. Si problème non-critique → répondre "INFO: <1 phrase non-technique en français>". Sab le verra au prochain réveil.
5. Si problème critique (site down, PG crash loop, erreur qui bloque le revenue) → répondre "URGENT: <1 phrase en français>". Sab sera pingé immédiatement.

Règles absolues :
- Pas de jargon technique. Sab est débutant, parle-lui comme à un ado.
- Pas de suggestion "attendre" ou "surveiller". Soit c'est OK, soit faut agir.
- Si tu vois un fix évident que auto-heal n'a pas fait (ex: container en restart loop), mentionne-le dans le INFO/URGENT pour qu'on le scripte au prochain passage.
- Réponse MAX 200 caractères.

Lis tous les fichiers puis donne ton verdict.
EOF

# Call Claude headless. No interactive, no tools, just file reads + reasoning.
VERDICT=$(claude -p "$(cat PROMPT.md)" \
  --model claude-haiku-4-5-20251001 \
  --permission-mode acceptEdits \
  --output-format text \
  --allowedTools Read \
  2>> "$LOG" | tail -c 500)

log "verdict: $VERDICT"
echo "$VERDICT" > "$STATE/last_verdict.txt"

# Decide what to do with the verdict.
if [ -z "$VERDICT" ] || [ "${VERDICT:0:2}" = "OK" ]; then
  # Silent heartbeat.
  log "OK — no ping"
elif [ "${VERDICT:0:6}" = "URGENT" ]; then
  # Ping immediately.
  if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
    curl -sS -m 8 -X POST \
      "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
      --data-urlencode "text=🚨 iku.gg — ${VERDICT}" > /dev/null || true
  fi
elif [ "${VERDICT:0:4}" = "INFO" ]; then
  # Queue for batching — but since we only run 3×/day, just send it.
  if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
    curl -sS -m 8 -X POST \
      "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
      --data-urlencode "text=ℹ️ iku.gg — ${VERDICT}" > /dev/null || true
  fi
else
  # Unknown shape — log but don't ping (avoid noise).
  log "unknown verdict shape, not pinging"
fi

# Cleanup workdir, keep state.
rm -rf "$WORKDIR"
