#!/usr/bin/env python3
"""Real local HTTP smoke without Docker, persistence, provider calls, or secrets."""
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import ProxyHandler, Request, build_opener

ROOT = Path(__file__).resolve().parents[1]


def run_case(configured):
    token = secrets.token_urlsafe(36) if configured else ''
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    # Port8001 is the declared private origin; ephemeral test port is reached only
    # on loopback with explicit Host. No real deployment configuration is written.
    env = {**os.environ, 'PYTHONPATH': str(ROOT / 'backend'), 'PYTHONDONTWRITEBYTECODE': '1',
           'SIGNALFOUNDRY_WORKER_URL': 'http://127.0.0.1:8001', 'SIGNALFOUNDRY_WORKER_TOKEN': token,
           'SIGNALFOUNDRY_WORKER_ALLOW_PRIVATE_HTTP': 'true', 'DECISION_ENGINE': 'rules', 'FORWARDED_ALLOW_IPS': ''}
    opener = build_opener(ProxyHandler({}))
    with tempfile.TemporaryDirectory() as tmp, tempfile.TemporaryFile() as logs:
        process = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.worker:app', '--host', '127.0.0.1',
                                    '--port', str(port), '--no-access-log', '--no-proxy-headers'],
                                   cwd=tmp, env=env, stdout=logs, stderr=logs)
        try:
            def request(path, body=None, authorized=False):
                headers = {'Host': '127.0.0.1:8001'}
                if authorized:
                    headers['Authorization'] = f'Bearer {token}'
                if body is not None:
                    headers['Content-Type'] = 'application/json'
                req = Request(f'http://127.0.0.1:{port}{path}', data=json.dumps(body).encode() if body is not None else None,
                              headers=headers)
                try:
                    response = opener.open(req, timeout=3)
                except HTTPError as exc:
                    response = exc
                with response:
                    return response.status, response.headers, json.load(response)
            deadline = time.monotonic() + 10
            while True:
                try:
                    assert request('/healthz')[0] == 200
                    break
                except URLError:
                    if process.poll() is not None or time.monotonic() >= deadline:
                        raise RuntimeError('Local worker did not start; no runtime credentials have been logged')
                    time.sleep(0.05)
            assert request('/readyz')[0] == (200 if configured else 503)
            assert request('/worker/research', {})[0] == (401 if configured else 503)
            assert request('/api/workspace')[0] == 404
            if configured:
                sys.path.insert(0, str(ROOT / 'backend'))
                from app.models import Profile
                profile = Profile(company_name='HTTP worker test', description='Disposable integration test', industries=[], company_sizes=[], geographies=[], buyer_roles=[], keywords=[], exclusions=[])
                body = {'profile': profile.model_dump(), 'campaign_id': 'integration', 'mode': 'demo', 'domains': []}
                status, headers, result = request('/worker/research', body, True)
                assert status == 422, 'Worker must reject retired fictional-data mode'
                assert len(headers['X-Request-ID']) == 32
            assert list(Path(tmp).iterdir()) == [], 'Worker unexpectedly wrote files'
        finally:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
            logs.seek(0)
            assert not token or token.encode() not in logs.read(), 'Worker leaked a runtime-only fixture token'


def run():
    run_case(False)
    run_case(True)
    print('PASS: local HTTP worker missing-token fail-closed, auth, readiness, fictional-data rejection, request ID, no demo API, no files, token redaction')
    print('Not run: Docker image, TLS reverse proxy, managed Convex reachability, live public fetch, paid Jev')


if __name__ == '__main__':
    run()
