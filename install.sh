#!/bin/sh
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if ! command -v node >/dev/null 2>&1; then
  echo 'Node.js 22.18+ ve npm gerekli. Node LTS kurup tekrar deneyin.' >&2
  exit 1
fi
exec node "$SCRIPT_DIR/scripts/install.mjs" "$@"
