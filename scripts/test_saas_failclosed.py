#!/usr/bin/env python3
"""Build SaaS without secrets; prove no legacy API fall-through or dummy auth.

No accounts, credentials, provider network calls, or database are used. Replaces
frontend/.next with a SaaS build; rerun the local-demo build for demo stack checks.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import build_opener, ProxyHandler
from dev import stop
ROOT=Path(__file__).resolve().parents[1]


def main():
    env={k:v for k,v in os.environ.items() if not any(s in k for s in ('CLERK','CONVEX','STRIPE','API_BASE_URL','PREVIEW_ORIGIN'))}
    env.update(SIGNALFOUNDRY_MODE='saas',NEXT_PUBLIC_SIGNALFOUNDRY_MODE='saas',NEXT_TELEMETRY_DISABLED='1')
    subprocess.run(['npm','run','build'],cwd=ROOT/'frontend',env=env,check=True)
    opener=build_opener(ProxyHandler({}))
    def request(path):
        try: response=opener.open('http://127.0.0.1:3001'+path,timeout=3)
        except HTTPError as exc: response=exc
        with response: return response.status,response.read()
    with tempfile.TemporaryDirectory() as tmp:
        with (Path(tmp)/'server.log').open('w') as log:
            child=subprocess.Popen([shutil.which('node'),str(ROOT/'frontend/node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3001'],cwd=ROOT/'frontend',env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
            try:
                for _ in range(100):
                    if child.poll() is not None: raise RuntimeError('SaaS test server exited; ensure port3001 is free')
                    try:
                        if request('/readyz')[0]==503: break
                    except (URLError,TimeoutError): pass
                    time.sleep(.1)
                else: raise RuntimeError('SaaS test server did not start')
                assert request('/readyz')==(503,b'{"status":"not_configured"}')
                for path in ('/api/health','/api/workspace','/api/campaigns'):
                    status,body=request(path);assert status==503,(path,status);assert 'detail' in json.loads(body)
                status,body=request('/');assert status==200 and b'configuration' in body.lower()
                print('PASS: SaaS production build fails closed without provider configuration; no demo API fallback')
            finally: stop(child)
if __name__=='__main__': main()
