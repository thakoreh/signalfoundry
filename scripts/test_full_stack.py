#!/usr/bin/env python3
"""Run the demo HTTP workflow through the production Next.js frontend.

Requires npm build output and installed Python dependencies. Uses a temporary
SQLite database and no live data-provider requests. Local ports 8000 and 3001
must be free; the production default rewrite target is 127.0.0.1:8000.
"""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
from urllib.error import URLError
from urllib.request import urlopen
from dev import stop

ROOT = Path(__file__).resolve().parents[1]


def main():
    next_bin = ROOT / 'frontend/node_modules/next/dist/bin/next'
    node = shutil.which('node')
    if not node or not (ROOT / 'frontend/.next/BUILD_ID').is_file():
        raise SystemExit('Run npm ci and npm run build in frontend first')
    children = []
    env = {**os.environ, 'DECISION_ENGINE': 'rules', 'NEXT_TELEMETRY_DISABLED': '1'}
    with tempfile.TemporaryDirectory(prefix='signalfoundry-full-stack-') as tmp:
        db = str(Path(tmp) / 'smoke.sqlite3')
        log_path = Path(tmp) / 'servers.log'
        with log_path.open('w') as log:
            try:
                children.append(subprocess.Popen([sys.executable, '-c',
                    'import uvicorn; from app.main import create_app; '
                    f'uvicorn.run(create_app({db!r}, testing=True), host="127.0.0.1", port=8000)'],
                    cwd=ROOT / 'backend', env=env, stdout=log, stderr=subprocess.STDOUT,
                    start_new_session=(os.name == 'posix')))
                children.append(subprocess.Popen([node, str(next_bin), 'start', '--hostname', '127.0.0.1', '--port', '3001'],
                    cwd=ROOT / 'frontend', env=env, stdout=log, stderr=subprocess.STDOUT,
                    start_new_session=(os.name == 'posix')))
                for _ in range(100):
                    if any(child.poll() is not None for child in children):
                        raise RuntimeError('A server exited before startup; ports 8000 and 3001 must be free')
                    try:
                        with urlopen('http://127.0.0.1:3001/api/health', timeout=1) as response:
                            if response.status == 200:
                                break
                    except (URLError, TimeoutError):
                        pass
                    time.sleep(.1)
                else:
                    raise RuntimeError('Production frontend did not become ready')
                with urlopen('http://127.0.0.1:3001/', timeout=10) as response:
                    assert response.status == 200
                    assert b'SignalFoundry' in response.read()
                subprocess.run([sys.executable, str(ROOT / 'scripts/smoke.py'), '--base-url', 'http://127.0.0.1:3001'], check=True, env=env)
                print('Production frontend page rendered and all API smoke checks passed through Next.js')
            except BaseException:
                log.flush()
                print(log_path.read_text()[-10000:])
                raise
            finally:
                for child in reversed(children):
                    stop(child)


if __name__ == '__main__':
    main()
