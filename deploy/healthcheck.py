"""Local-only readiness check; no password and no unauthenticated public route."""
import json
import os
from urllib.error import HTTPError
from urllib.request import Request, ProxyHandler, build_opener

opener = build_opener(ProxyHandler({}))
for url in ('http://127.0.0.1:8000/api/health', 'http://127.0.0.1:3000/api/health'):
    with opener.open(url, timeout=3) as response:
        assert response.status == 200 and json.load(response)['status'] == 'ok'
host = os.environ['SIGNALFOUNDRY_PREVIEW_ORIGIN'].removeprefix('https://')
try:
    opener.open(Request('http://127.0.0.1:8080/', headers={'Host': host, 'X-Forwarded-Proto': 'https'}), timeout=3)
except HTTPError as error:
    assert error.code == 401 and 'Basic' in error.headers.get('WWW-Authenticate', '')
else:
    raise SystemExit('Preview gateway is not requiring authentication')
