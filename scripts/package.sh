#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${1:-$ROOT/artifacts/signalfoundry-mvp-source.zip}"
python3 - "$ROOT" "$DEST" <<'PY'
import pathlib, sys, zipfile
root, output = map(pathlib.Path, sys.argv[1:])
excluded = {'.git', '.next', 'node_modules', '.venv', '__pycache__', '.pytest_cache', '.ruff_cache', 'artifacts', '.runtime', '.convex', 'secrets', 'test-results', 'playwright-report', 'coverage'}
output.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for p in sorted(root.rglob('*')):
        relative = p.relative_to(root)
        if relative.parts[:2] == ('backend', 'data'):
            continue
        if not p.is_file() or any(part in excluded for part in relative.parts):
            continue
        if p.name.startswith('.env') and p.name != '.env.example':
            continue
        if p.suffix in {'.db', '.sqlite', '.sqlite3', '.pyc', '.htpasswd', '.pem', '.key'} or p.name == '.htpasswd' or any(marker in p.name for marker in ('.db-', '.sqlite-', '.sqlite3-')) or p.name.endswith('.tsbuildinfo'):
            continue
        archive.write(p, pathlib.Path('signalfoundry-mvp') / p.relative_to(root))
print(output)
PY
