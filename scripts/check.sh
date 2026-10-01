#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="$ROOT/.venv/bin/python"
if [[ ! -x "$PYTHON" ]]; then PYTHON=python3; fi
export NEXT_TELEMETRY_DISABLED=1
export SIGNALFOUNDRY_MODE=local-demo NEXT_PUBLIC_SIGNALFOUNDRY_MODE=local-demo
(cd "$ROOT/backend" && "$PYTHON" -m unittest discover -s tests -v)
"$PYTHON" "$ROOT/scripts/test_packaging.py"
"$PYTHON" "$ROOT/scripts/test_deployment.py"
"$PYTHON" "$ROOT/scripts/test_launcher.py"
"$PYTHON" "$ROOT/scripts/production_preflight.py"
"$PYTHON" "$ROOT/scripts/production_worker_checks.py"
bash -n "$ROOT/scripts/dev.sh" "$ROOT/scripts/setup.sh" "$ROOT/scripts/package.sh" "$ROOT/deploy/start.sh"
(cd "$ROOT/frontend" && npm run typecheck && npm run lint && npm test && npm run test:convex && npm run build)
"$PYTHON" "$ROOT/scripts/test_proxy_integration.py"
"$PYTHON" "$ROOT/scripts/test_full_stack.py"

"$PYTHON" "$ROOT/scripts/test_preview_stack.py"
