#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="$ROOT/.venv/bin/python"
if [[ ! -x "$PYTHON" ]]; then PYTHON=python3; fi
export NEXT_TELEMETRY_DISABLED=1
(cd "$ROOT/backend" && "$PYTHON" -m unittest discover -s tests -v)
"$PYTHON" "$ROOT/scripts/test_packaging.py"
"$PYTHON" "$ROOT/scripts/test_deployment.py"
"$PYTHON" "$ROOT/scripts/test_launcher.py"
bash -n "$ROOT/scripts/dev.sh" "$ROOT/scripts/setup.sh" "$ROOT/scripts/package.sh" "$ROOT/deploy/start.sh"
(cd "$ROOT/frontend" && npm run typecheck && npm run lint && npm test && npm run build)
"$PYTHON" "$ROOT/scripts/test_proxy_integration.py"
"$PYTHON" "$ROOT/scripts/test_full_stack.py"

"$PYTHON" "$ROOT/scripts/test_preview_stack.py"
