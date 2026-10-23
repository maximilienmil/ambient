#!/bin/bash
cd "$(dirname "$0")/app" || exit 1
if curl --silent --fail http://127.0.0.1:4317/api/session >/dev/null; then
  open http://127.0.0.1:4317
  exit 0
fi
node server.mjs &
ambient_pid=$!
trap 'kill "$ambient_pid" 2>/dev/null' EXIT INT TERM
for ambient_try in {1..30}; do
  if curl --silent --fail http://127.0.0.1:4317/api/session >/dev/null; then
    open http://127.0.0.1:4317
    break
  fi
  sleep 0.2
done
wait "$ambient_pid"
