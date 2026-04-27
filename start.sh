#!/bin/zsh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

WATCH_MODE=1
if [ "$1" = "--no-watch" ]; then
  WATCH_MODE=0
fi

if [ -x "/Applications/Codex.app/Contents/Resources/node" ]; then
  NODE_BIN="/Applications/Codex.app/Contents/Resources/node"
elif command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
else
  echo "Node.js was not found. Install Node.js or run this from Codex." >&2
  exit 1
fi

if [ "$WATCH_MODE" -eq 1 ]; then
  exec env PORT=5050 "$NODE_BIN" --watch server.js
fi

exec env PORT=5050 "$NODE_BIN" server.js
