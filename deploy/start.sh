#!/usr/bin/env bash
set -euo pipefail
umask 077
python /app/deploy/render_config.py
nginx -t -c /tmp/signalfoundry-nginx.conf
children=()
cleanup() {
  trap - TERM INT EXIT
  for pid in "${children[@]}"; do kill -TERM "$pid" 2>/dev/null || true; done
  for pid in "${children[@]}"; do wait "$pid" 2>/dev/null || true; done
}
trap cleanup TERM INT EXIT
(cd /app/backend && exec python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1 --no-proxy-headers --no-access-log --timeout-graceful-shutdown 20) &
children+=("$!")
(cd /app/frontend && exec env HOSTNAME=127.0.0.1 PORT=3000 node server.js) &
children+=("$!")
nginx -c /tmp/signalfoundry-nginx.conf -g 'daemon off;' &
children+=("$!")
# If any component exits, stop all three; Coolify can restart one coherent unit.
set +e
wait -n "${children[@]}"
status=$?
set -e
if [[ "$status" -eq 0 ]]; then status=1; fi
exit "$status"
