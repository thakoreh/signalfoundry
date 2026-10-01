#!/usr/bin/env bash
# Run an installed, pinned scanner; never print a discovered secret.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GITLEAKS="${GITLEAKS_BIN:-gitleaks}"
"$GITLEAKS" version
cd "$ROOT"
"$GITLEAKS" git --redact .
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
python3 - "$ROOT" "$STAGE" <<'PY'
import pathlib,shutil,subprocess,sys
root,target=map(pathlib.Path,sys.argv[1:])
files=subprocess.check_output(['git','ls-files','-co','--exclude-standard','-z'],cwd=root).decode().split('\0')
for name in files:
    if not name: continue
    source=root/name
    if source.is_file() and not source.is_symlink():
        dest=target/name
        dest.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(source,dest)
PY
"$GITLEAKS" dir --redact "$STAGE"
echo 'Gitleaks checks passed; this does not resolve incidents raised by other scanners.'
