#!/usr/bin/env python3
"""Run the demo HTTP workflow through the production Next.js frontend.

Requires npm build output and installed Python dependencies. Uses a temporary
SQLite database and no live data-provider requests. Local ports 8000 and 3001
must be free; the production default rewrite target is 127.0.0.1:8000.
"""
import os
from html.parser import HTMLParser
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


class LandingMarkup(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = set()
        self.website_input = False
        self.website_form = False
        self.text = []
        self.hidden_depth = 0

    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        if tag in ('script', 'style'):
            self.hidden_depth += 1
        if tag == 'a':
            self.links.add(attributes.get('href'))
        if tag == 'input' and attributes.get('id') == 'business-website':
            self.website_input = attributes.get('inputmode') == 'url'
        if tag == 'form' and attributes.get('aria-label') == 'Start with your business website':
            self.website_form = True

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.hidden_depth = max(0, self.hidden_depth - 1)

    def handle_data(self, value):
        if not self.hidden_depth:
            self.text.append(value)


def assert_landing_page(body):
    page = LandingMarkup()
    page.feed(body.decode('utf-8'))
    assert 'Clientrove' in ''.join(page.text), 'The rendered page must show the current Clientrove brand'
    assert page.website_form and page.website_input, 'The website-first entry form must render with its URL input'
    assert '/sign-up?redirect_url=/workspace/setup' in page.links, 'Sign up must lead to business setup'
    assert '/sign-in?redirect_url=/workspace' in page.links, 'Sign in must return to the workspace'


def main():
    next_bin = ROOT / 'frontend/node_modules/next/dist/bin/next'
    node = shutil.which('node')
    if not node or not (ROOT / 'frontend/.next/BUILD_ID').is_file():
        raise SystemExit('Run npm ci and npm run build in frontend first')
    children = []
    env = {**os.environ, 'DECISION_ENGINE': 'rules', 'NEXT_TELEMETRY_DISABLED': '1', 'SIGNALFOUNDRY_MODE': 'local-demo', 'NEXT_PUBLIC_SIGNALFOUNDRY_MODE': 'local-demo'}
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
                    assert_landing_page(response.read())
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
