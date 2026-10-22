#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${1:-$ROOT/artifacts/signalfoundry-mvp-source.zip}"
"${PYTHON:-python3}" "$ROOT/scripts/package_source.py" "$DEST"
