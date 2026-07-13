#!/bin/bash
for u in "https://www.pornx.ai" "https://pornx.app" "https://pornxai.com" "https://pornx.com" "https://pornxai.app" "https://pornxai.io"; do
  out=$(curl -s -o /dev/null -w "HTTP %{http_code} -> %{url_effective}" -L --max-time 10 -A "Mozilla/5.0 (Windows NT 10.0) Chrome/124.0" "$u")
  echo "$u :: $out"
done
