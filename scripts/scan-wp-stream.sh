#!/usr/bin/env bash
# scan-wp-stream.sh — test /api/video-stream from inside Hetzner network
# against a sample of WP videos. Writes results to /tmp/wp-stream-results.csv.
# Run via: ssh root@204.168.233.29 'bash -s' < scripts/scan-wp-stream.sh

set -u
CONTAINER=hjta50cv9nfem56atjtwmlx1-120112320549
IP=$(docker inspect "$CONTAINER" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' | awk '{print $1}')
OUT=/tmp/wp-stream-results.csv
echo "prefix,slug,code" > "$OUT"

while IFS='|' read -r slug url; do
  prefix=$(echo "$slug" | cut -d'-' -f1)
  encoded=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1],safe=''))" "$url")
  code=$(curl -s -o /dev/null --max-time 30 -w '%{http_code}' -H "Host: iku.gg" \
    "http://$IP:3000/api/video-stream?url=$encoded")
  echo "$prefix,$slug,$code" >> "$OUT"
  printf "."
done < /tmp/wp-sample.txt
echo ""
echo "--- summary ---"
awk -F, 'NR>1 {total[$1]++; if ($3==200 || $3==206) ok[$1]++} END {for (p in total) printf "%s: %d/%d alive (%.0f%%)\n", p, ok[p]+0, total[p], (ok[p]+0)*100.0/total[p]}' "$OUT" | sort
