#!/bin/bash
# Stops the background server started by start.sh. Sends SIGTERM first (the same signal
# node --watch uses on its own reloads) so server.js's shutdown handler can flush any
# pending overlay auto-commit before exiting; falls back to SIGKILL if it won't die.
cd "$(dirname "$0")"

if [ ! -f server.pid ]; then
  echo "Not running (no server.pid)."
  exit 0
fi

PID="$(cat server.pid)"
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  for i in 1 2 3 4 5; do
    kill -0 "$PID" 2>/dev/null || break
    sleep 0.3
  done
  if kill -0 "$PID" 2>/dev/null; then
    echo "Still running after SIGTERM — forcing."
    kill -9 "$PID" 2>/dev/null || true
  fi
  echo "Stopped (was pid $PID)."
else
  echo "Not running (stale pid $PID)."
fi
rm -f server.pid
