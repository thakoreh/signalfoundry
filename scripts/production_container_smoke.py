#!/usr/bin/env python3
"""Smoke an already-built worker image. Requires Docker; no skip-as-success.

Runtime-only random fixtures are written to a 0600 temporary env file, passed
via --env-file, never logged, and removed. Containers have no external network.
"""
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import tempfile
import time

IMAGE = 'signalfoundry-worker:ci'


def docker(*args):
    result = subprocess.run(['docker', *args], capture_output=True, text=True, timeout=30)
    if result.returncode:
        # Docker stderr can contain config; do not echo it or command arguments.
        raise RuntimeError('Docker operation failed: ' + args[0] + ' (details intentionally redacted)')
    return result.stdout.strip()


CHECK = r'''
import json, os
from urllib.request import Request, build_opener, ProxyHandler
from urllib.error import HTTPError
opener = build_opener(ProxyHandler({}))
def request(path, body=None, auth=False):
    headers = {'Content-Type': 'application/json'}
    if auth: headers['Authorization'] = 'Bearer ' + os.environ['SIGNALFOUNDRY_WORKER_TOKEN']
    req = Request('http://127.0.0.1:8001' + path, data=json.dumps(body).encode() if body is not None else None, headers=headers)
    try: response = opener.open(req, timeout=3)
    except HTTPError as exc: response = exc
    with response: return response.status, response.headers, json.load(response)
assert os.getuid() == 10001
assert not os.path.exists('/app/app/main.py')
assert not os.path.exists('/app/app/store.py')
assert request('/healthz')[0] == 200
configured = bool(os.environ.get('SIGNALFOUNDRY_WORKER_TOKEN'))
assert request('/readyz')[0] == (200 if configured else 503)
assert request('/worker/research', {})[0] == (401 if configured else 503)
assert request('/api/workspace')[0] == 404
if configured:
    from app.fixtures import DEMO_PROFILE
    body = {'profile': DEMO_PROFILE.model_dump(), 'campaign_id': 'container_smoke', 'mode': 'demo', 'domains': []}
    status, headers, data = request('/worker/research', body, True)
    assert status == 200 and len(data['accounts']) == 8 and data['errors'] == []
    assert len(headers['X-Request-ID']) == 32
    assert all(a['is_demo'] and a['decision_engine'] == 'rules' for a in data['accounts'])
print(json.dumps({'configured': configured, 'passed': True}))
'''


def run():
    if not shutil.which('docker'):
        raise SystemExit('Docker is unavailable: container build/runtime proof was NOT RUN')
    docker('image', 'inspect', IMAGE)
    for configured in (False, True):
        name = 'signalfoundry-worker-smoke-' + secrets.token_hex(6)
        token = secrets.token_urlsafe(36) if configured else ''
        with tempfile.TemporaryDirectory() as tmp:
            envfile = Path(tmp) / 'worker.env'
            descriptor = os.open(envfile, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(descriptor, 'w') as file:
                file.write('DECISION_ENGINE=rules\nSIGNALFOUNDRY_WORKER_ALLOW_PRIVATE_HTTP=true\n')
                file.write('SIGNALFOUNDRY_WORKER_URL=http://127.0.0.1:8001\n')
                file.write('SIGNALFOUNDRY_WORKER_TOKEN=' + token + '\n')
            try:
                docker('run', '--detach', '--rm', '--name', name, '--network', 'none', '--read-only',
                       '--user', '10001:10001', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
                       '--pids-limit', '64', '--memory', '256m', '--tmpfs', '/tmp:rw,noexec,nosuid,size=16m',
                       '--env-file', str(envfile), IMAGE)
                deadline = time.monotonic() + 15
                while True:
                    probe = subprocess.run(['docker', 'exec', name, 'python', '-c', CHECK], capture_output=True, timeout=5)
                    if probe.returncode == 0:
                        assert json.loads(probe.stdout) == {'configured': configured, 'passed': True}
                        break
                    if time.monotonic() >= deadline:
                        raise RuntimeError('Worker container smoke failed (credentials and raw logs redacted)')
                    time.sleep(0.25)
                logs = docker('logs', name)
                assert not token or token not in logs
                print('PASS: worker container ' + ('configured auth, demo response, non-root isolation' if configured else 'missing-token fail-closed readiness/work'))
            finally:
                subprocess.run(['docker', 'rm', '--force', name], capture_output=True, timeout=15)
    print('Container smoke passed; external TLS, real credentials, cloud Convex, and paid providers remain unverified')


if __name__ == '__main__':
    run()
