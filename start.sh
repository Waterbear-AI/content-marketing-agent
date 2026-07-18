#!/bin/bash
# Starts server.js in the background with auto-reload (node --watch restarts it whenever
# server.js changes — content-calendar.html/calendar-data.js are already read fresh
# per-request, no restart needed for those). PID + logs are local runtime state
# (server.pid / server.log), gitignored.
set -e
cd "$(dirname "$0")"

if [ -f server.pid ] && kill -0 "$(cat server.pid)" 2>/dev/null; then
  echo "Already running (pid $(cat server.pid)). Run 'npm stop' first to restart clean."
  exit 0
fi

nohup node --watch server.js > server.log 2>&1 &
echo $! > server.pid
sleep 0.4

if kill -0 "$(cat server.pid)" 2>/dev/null; then
  echo "Started in background (pid $(cat server.pid)) — auto-reloads on server.js changes."
  echo "Logs: npm run logs   Stop: npm stop"
  tail -n 5 server.log
else
  echo "Failed to start — server.log:"
  cat server.log
  rm -f server.pid
  exit 1
fi
