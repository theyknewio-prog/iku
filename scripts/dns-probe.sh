#!/bin/bash
for d in pornx.ai pornx.com pornx.app pornx.gg pornx.io porn-x.ai pornx.net pornx.cc; do
  ip=$(getent hosts "$d" 2>/dev/null | awk '{print $1}' | head -1)
  if [ -z "$ip" ]; then ip="NXDOMAIN"; fi
  echo "$d -> $ip"
done
