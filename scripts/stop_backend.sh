#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
PID_FILE="$BACKEND_DIR/.uvicorn.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "No PID file found. Backend may not be running."
  exit 0
fi

PID="$(cat "$PID_FILE")"
if kill -0 "$PID" >/dev/null 2>&1; then
  kill "$PID"
  echo "Stopping backend PID=$PID ..."

  for _ in {1..10}; do
    if kill -0 "$PID" >/dev/null 2>&1; then
      sleep 1
    else
      break
    fi
  done

  if kill -0 "$PID" >/dev/null 2>&1; then
    kill -9 "$PID" || true
    echo "Force killed PID=$PID"
  fi
else
  echo "Process $PID not running."
fi

rm -f "$PID_FILE"
echo "Backend stopped."
