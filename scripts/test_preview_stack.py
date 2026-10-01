#!/usr/bin/env python3
"""Runtime preview-origin regression against built Next standalone and private API.

No nginx, Docker, credentials, or public deployment are used. Run after npm build.
The auth gateway itself must still be verified on the final Docker deployment.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, ProxyHandler, build_opener
from dev import stop

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://preview.company.com'


def main():
    if not (ROOT / 'frontend/.next/standalone/server.js').is_file():
        raise SystemExit('Run npm run build in frontend first')
    children = []
    opener = build_opener(ProxyHandler({}))
    with tempfile.TemporaryDirectory(prefix='signalfoundry-preview-stack-') as tmp:
        tmp = Path(tmp)
        standalone = tmp / 'frontend'
        shutil.copytree(ROOT / 'frontend/.next/standalone', standalone)
        shutil.copytree(ROOT / 'frontend/.next/static', standalone / '.next/static')
        env = {**os.environ, 'SIGNALFOUNDRY_PREVIEW_ORIGIN': ORIGIN,
               'SIGNALFOUNDRY_DB_PATH': str(tmp / 'workspace.sqlite3'),
               'DECISION_ENGINE': 'rules', 'NEXT_TELEMETRY_DISABLED': '1',
               'HOSTNAME': '127.0.0.1', 'PORT': '3001'}
        log_path = tmp / 'stack.log'
        def request(path, *, headers=None, data=None):
            actual = {'Host': 'preview.company.com', 'X-Forwarded-Host': 'preview.company.com',
                      'X-Forwarded-Proto': 'https', 'Origin': ORIGIN}
            actual.update(headers or {})
            if data is not None:
                actual['Content-Type'] = 'application/json'
            req = Request('http://127.0.0.1:3001' + path, headers=actual,
                          data=json.dumps(data).encode() if data is not None else None)
            try:
                with opener.open(req, timeout=5) as response:
                    return response.status, response.read()
            except HTTPError as error:
                return error.code, error.read()
        with log_path.open('w') as log:
            try:
                children.append(subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.main:app',
                    '--host', '127.0.0.1', '--port', '8000', '--no-proxy-headers', '--no-access-log'],
                    cwd=ROOT / 'backend', env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True))
                children.append(subprocess.Popen([shutil.which('node'), 'server.js'],
                    cwd=standalone, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True))
                for _ in range(100):
                    if any(child.poll() is not None for child in children):
                        raise RuntimeError('Preview stack exited before startup; ports 8000 and 3001 must be free')
                    try:
                        if request('/api/health')[0] == 200:
                            break
                    except (URLError, TimeoutError):
                        pass
                    time.sleep(.1)
                else:
                    raise RuntimeError('Preview stack did not become ready')
                assert request('/')[0] == 200
                status, body = request('/api/health')
                assert status == 200 and json.loads(body)['mode'] == 'protected-preview'
                for bad in ({'Host': 'evil.com'}, {'X-Forwarded-Host': 'evil.com'},
                            {'Origin': 'https://evil.com'}, {'Origin': 'null'},
                            {'X-Forwarded-Proto': 'http'}, {'Forwarded': 'host=preview.company.com'}):
                    assert request('/api/workspace', headers=bad)[0] in (400, 403), bad
                assert request('/api/demo/reset', data={})[0] == 200
                status, body = request('/api/campaigns', data={'name': 'Protected preview regression', 'mode': 'demo', 'domains': []})
                assert status == 201
                campaign_id = json.loads(body)['id']
                status, body = request(f'/api/campaigns/{campaign_id}/research', data={})
                assert status == 200 and json.loads(body)['status'] == 'complete'
                status, body = request(f'/api/campaigns/{campaign_id}/accounts')
                assert status == 200 and len(json.loads(body)) == 8
                status, body = request(f'/api/campaigns/{campaign_id}/export.csv')
                assert status == 200 and b'is_demo' in body
                print('Preview standalone runtime: exact HTTPS origin + UI + demo/research/export passed; six hostile-header cases rejected')
            except BaseException:
                log.flush()
                print(log_path.read_text()[-10000:])
                raise
            finally:
                for child in reversed(children):
                    stop(child)


if __name__ == '__main__':
    main()
