#!/bin/sh
# Warmup script — hits key pages after server start to pre-populate ISR cache
# This runs in the background so the server is available immediately

echo "[warmup] Waiting for server to be ready..."
sleep 5

# Wait until server responds
for i in 1 2 3 4 5 6 7 8 9 10; do
  if wget -qO /dev/null --timeout=5 http://localhost:3000/ 2>/dev/null; then
    echo "[warmup] Server is ready, warming up cache..."
    break
  fi
  echo "[warmup] Server not ready yet, retrying in 5s..."
  sleep 5
done

# Hit the most important pages to pre-populate ISR cache
echo "[warmup] Warming homepage..."
wget -qO /dev/null --timeout=30 http://localhost:3000/ 2>/dev/null

echo "[warmup] Warming /trending..."
wget -qO /dev/null --timeout=30 http://localhost:3000/trending 2>/dev/null

echo "[warmup] Warming /new..."
wget -qO /dev/null --timeout=30 http://localhost:3000/new 2>/dev/null

echo "[warmup] Warming /explore..."
wget -qO /dev/null --timeout=30 http://localhost:3000/explore 2>/dev/null

echo "[warmup] Warming /tags..."
wget -qO /dev/null --timeout=30 http://localhost:3000/tags 2>/dev/null

echo "[warmup] Warming /character..."
wget -qO /dev/null --timeout=30 http://localhost:3000/character 2>/dev/null

echo "[warmup] Warming /series..."
wget -qO /dev/null --timeout=30 http://localhost:3000/series 2>/dev/null

echo "[warmup] Cache warmup complete!"
