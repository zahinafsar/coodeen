#!/bin/sh

cleanup() {
  echo "\nShutting down..."
  kill $NEXT_PID $EDITOR_PID 2>/dev/null
  wait $NEXT_PID $EDITOR_PID 2>/dev/null
  exit 0
}

trap cleanup INT TERM

npm run dev &
NEXT_PID=$!

node packages/nocodevibe/cli.mjs &
EDITOR_PID=$!

wait
