#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.lock.txt
(cd frontend && npm ci)
printf '\nReady. Run ./scripts/dev.sh and open http://localhost:3000\n'
