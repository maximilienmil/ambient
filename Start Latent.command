#!/bin/bash
cd "$(dirname "$0")/app" || exit 1
if curl --silent --fail http://127.0.0.1:4317/api/session >/dev/null; then
  open http://127.0.0.1:4317
  exit 0
fi
node server.mjs &
latent_pid=$!
trap 'kill "$latent_pid" 2>/dev/null' EXIT INT TERM
for latent_try in {1..30}; do
  if curl --silent --fail http://127.0.0.1:4317/api/session >/dev/null; then
    open http://127.0.0.1:4317
    break
  fi
  sleep 0.2
done
wait "$latent_pid"
