#!/usr/bin/env python3
"""Exercise the real Next proxy against a local, disposable upstream fixture.

Run after `npm ci` in frontend: python3 scripts/test_proxy_integration.py
Takes about 35 seconds. No company websites, provider credentials, live provider
calls, existing database, or running development server are used. The shipped
frontend sources are copied to a temporary directory, with installed dependencies
linked in and separate Next build output, so this does not mutate frontend/.next.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener, ProxyHandler


DELAY_SECONDS = 31.25  # Must exceed Next's previous 30-second rewrite timeout.
ROOT = Path(__file__).resolve().parents[1]


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


class FixtureHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/delayed':
            time.sleep(DELAY_SECONDS)
        body = json.dumps({'fixture': True, 'path': self.path}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass  # Expected if an unfixed proxy aborts the slow fixture request.

    def log_message(self, *_):
        pass


def stop_process_group(process: subprocess.Popen) -> None:
    try:
        # A Next parent can exit while a child in its process group remains.
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    try:
        process.wait(timeout=8)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.wait(timeout=5)


def main() -> None:
    frontend = ROOT / 'frontend'
    dependencies = frontend / 'node_modules'
    if not (dependencies / 'next/dist/bin/next').is_file():
        raise SystemExit('Install frontend dependencies first: cd frontend && npm ci')
    node = shutil.which('node')
    if not node:
        raise SystemExit('Node.js is required for this integration check')

    upstream = ThreadingHTTPServer(('127.0.0.1', 0), FixtureHandler)
    upstream.daemon_threads = True
    thread = threading.Thread(target=upstream.serve_forever, daemon=True)
    thread.start()
    opener = build_opener(ProxyHandler({}))  # Never use environment HTTP proxies.
    checks: list[str] = []

    try:
        with tempfile.TemporaryDirectory(prefix='signalfoundry-proxy-test-') as temporary:
            workspace = Path(temporary) / 'frontend'
            shutil.copytree(frontend, workspace, ignore=shutil.ignore_patterns(
                'node_modules', '.next', '.git', '*.tsbuildinfo', '.env', '.env.*',
            ))
            (workspace / 'node_modules').symlink_to(dependencies, target_is_directory=True)
            port = free_port()
            base = f'http://127.0.0.1:{port}'
            environment = {**os.environ,
                'API_BASE_URL': f'http://127.0.0.1:{upstream.server_port}',
                'NEXT_TELEMETRY_DISABLED': '1',
            }
            log_path = Path(temporary) / 'next.log'

            def request(path: str, headers: dict | None = None, timeout: float = 5):
                req = Request(base + path, headers=headers or {})
                try:
                    with opener.open(req, timeout=timeout) as response:
                        return response.status, response.read()
                except HTTPError as error:
                    return error.code, error.read()

            with log_path.open('w') as log:
                process = subprocess.Popen([
                    node, str(dependencies / 'next/dist/bin/next'), 'dev', '--webpack',
                    '--hostname', '127.0.0.1', '--port', str(port),
                ], cwd=workspace, env=environment, stdout=log, stderr=subprocess.STDOUT,
                    start_new_session=True)
                try:
                    deadline = time.monotonic() + 60
                    while time.monotonic() < deadline:
                        if process.poll() is not None:
                            raise AssertionError('Next exited before becoming ready')
                        try:
                            status, _ = request('/api/health')
                            if status == 200:
                                break
                        except (URLError, TimeoutError, ConnectionError):
                            pass
                        time.sleep(0.25)
                    else:
                        raise AssertionError('Next did not become ready within 60 seconds')

                    for host in [f'localhost:{port}', f'127.0.0.1:{port}']:
                        status, body = request('/api/workspace', {'Host': host})
                        assert status == 200 and json.loads(body)['fixture'], (host, status, body)
                    checks.append('Localhost and 127.0.0.1 hosts reach the real rewrite')

                    for host in ['rebound.attacker.example', 'localhost.attacker.example',
                                 '127.0.0.1.attacker.example']:
                        status, body = request('/api/workspace', {
                            'Host': host,
                            'X-Forwarded-Host': f'localhost:{port}',
                        })
                        assert status in (400, 403), (host, status, body)
                        assert b'"fixture"' not in body, (host, body)
                    for forwarded in [
                        {'X-Forwarded-Host': 'attacker.example'},
                        {'Forwarded': 'host=attacker.example'},
                    ]:
                        status, body = request('/api/workspace', {
                            'Host': f'localhost:{port}', **forwarded,
                        })
                        assert status in (400, 403), (forwarded, status, body)
                        assert b'"fixture"' not in body, (forwarded, body)
                    checks.append('Foreign, lookalike, and spoofed forwarded hosts cannot read proxied data')

                    started = time.monotonic()
                    status, body = request('/api/delayed', timeout=45)
                    elapsed = time.monotonic() - started
                    assert status == 200 and json.loads(body)['fixture'], (status, body)
                    assert elapsed >= 30, elapsed
                    checks.append('A 31-second upstream response survives the former 30-second timeout')
                    print(json.dumps({'passed': len(checks), 'checks': checks,
                                      'delayed_response_seconds': round(elapsed, 2)}, indent=2))
                except BaseException:
                    log.flush()
                    print(log_path.read_text()[-12000:])
                    raise
                finally:
                    stop_process_group(process)
    finally:
        upstream.shutdown()
        upstream.server_close()
        thread.join(timeout=2)


if __name__ == '__main__':
    main()
