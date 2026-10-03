"""Offline worker auth, isolation, contract, concurrency, and redaction tests."""
import asyncio
import concurrent.futures
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.fixtures import DEMO_PROFILE
from app.safety import DNS_CAPACITY, FetchError, Page, fetch_public_page
from app.worker import WorkerBoundary, create_worker
from app.worker_config import WorkerSettings, worker_origin

PAGE = Page('https://company.com/', 'Company', 'B2B SaaS sales workflow automation',
            'B2B SaaS sales workflow automation and developer tools for VP Sales. Hiring now.')


class WorkerTest(unittest.TestCase):
    def setUp(self):
        self.token = secrets.token_urlsafe(36)
        self.env = {'SIGNALFOUNDRY_WORKER_TOKEN': self.token,
                    'SIGNALFOUNDRY_WORKER_URL': 'https://worker.company.com',
                    'SIGNALFOUNDRY_WORKER_ALLOW_PRIVATE_HTTP': 'false',
                    'DECISION_ENGINE': 'rules', 'FORWARDED_ALLOW_IPS': ''}
        self.auth = {'Authorization': f'Bearer {self.token}'}
        with patch.dict(os.environ, self.env):
            self.app = create_worker()
        self.app.state.fetch_page = lambda url: PAGE
        self.client = TestClient(self.app, base_url=self.env['SIGNALFOUNDRY_WORKER_URL'])
        self.addCleanup(self.client.close)

    def body(self, mode='manual', domains=None):
        return {'profile': DEMO_PROFILE.model_dump(), 'campaign_id': 'convex_campaign_123',
                'mode': mode, 'domains': ['https://company.com/'] if domains is None else domains}

    def post(self, body=None, headers=None, path='/worker/research'):
        return self.client.post(path, json=self.body() if body is None else body,
                                headers=self.auth if headers is None else headers)

    def test_trusted_exclusions_block_page_fetch_and_decision_calls_before_work(self):
        body = {**self.body(domains=['https://www.company.com/']), 'excluded_domains': ['company.com']}
        with patch.object(self.app.state, 'fetch_page', side_effect=AssertionError('Suppressed page was fetched')) as fetch:
            with patch.object(self.app.state.decision_provider, 'evaluate', side_effect=AssertionError('Suppressed company was evaluated')) as evaluate:
                response = self.post(body)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'accounts': [], 'errors': []})
        fetch.assert_not_called()
        evaluate.assert_not_called()
        for excluded in [['company.com'] * 101, ['https://company.com/'], ['bad..com']]:
            self.assertEqual(self.post({**self.body(), 'excluded_domains': excluded}).status_code, 422)

    def test_reject_demo_research_without_creating_fictional_accounts(self):
        self.assertEqual(self.post(self.body('demo', [])).status_code, 422)

    def test_authentication_rejects_missing_wrong_duplicate_and_nonbearer(self):
        for headers in ({}, {'Authorization': 'Bearer ' + secrets.token_urlsafe(36)},
                        {'Authorization': 'Basic ' + secrets.token_urlsafe(36)},
                        [('Authorization', self.auth['Authorization']), ('Authorization', self.auth['Authorization'])]):
            with self.subTest(kind=type(headers).__name__):
                self.assertEqual(self.post(headers=headers).status_code, 401)
        with patch('app.worker.hmac.compare_digest', wraps=__import__('hmac').compare_digest) as compare:
            self.assertEqual(self.post().status_code, 200)
            self.assertEqual(compare.call_count, 1)
            self.assertEqual(len(compare.call_args.args[0]), 32)
            self.assertEqual(len(compare.call_args.args[1]), 32)

    def test_missing_configuration_fails_closed_while_liveness_remains(self):
        for missing in ('SIGNALFOUNDRY_WORKER_TOKEN', 'SIGNALFOUNDRY_WORKER_URL'):
            with patch.dict(os.environ, {**self.env, missing: ''}):
                with TestClient(create_worker(), base_url=self.env['SIGNALFOUNDRY_WORKER_URL']) as client:
                    self.assertEqual(client.get('/healthz').json(), {'status': 'ok'})
                    self.assertEqual(client.get('/readyz').status_code, 503)
                    self.assertEqual(client.post('/worker/research', json=self.body(), headers=self.auth).status_code, 503)

    def test_manual_contract_and_no_persistence_or_local_routes(self):
        self.assertFalse(hasattr(self.app.state, 'repository'))
        with patch('sqlite3.connect', side_effect=AssertionError('Worker must never use SQLite')):
            response = self.post()
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        self.assertEqual(set(data), {'accounts', 'errors'})
        self.assertEqual(len(data['accounts']), 1)
        self.assertTrue(all(not a['is_demo'] and a['decision_engine'] == 'rules' and a['campaign_id'] == 'convex_campaign_123' for a in data['accounts']))
        for path in ('/api/workspace', '/api/campaigns', '/api/demo/reset', '/docs', '/redoc', '/openapi.json'):
            self.assertEqual(self.client.get(path).status_code, 404)
        self.assertEqual(self.client.get('/readyz').status_code, 200)
        again = self.post().json()
        self.assertNotEqual(data['accounts'][0]['id'], again['accounts'][0]['id'])

    def test_worker_import_never_imports_demo_or_sqlite(self):
        backend = str(Path(__file__).resolve().parents[1])
        with tempfile.TemporaryDirectory() as tmp:
            code = "import sys; import app.worker; assert 'app.main' not in sys.modules; assert 'app.store' not in sys.modules; assert 'sqlite3' not in sys.modules"
            result = subprocess.run([sys.executable, '-B', '-c', code], cwd=tmp,
                                    env={**os.environ, **self.env, 'PYTHONPATH': backend}, capture_output=True, timeout=10)
            self.assertEqual(result.returncode, 0, result.stderr.decode())
            self.assertEqual(list(Path(tmp).iterdir()), [])

    def test_transport_host_browser_origin_and_content_type_guards(self):
        cases = [({'Host': 'attacker.company.com'}, 400), ({'Origin': 'https://worker.company.com'}, 403),
                 ({'Content-Type': 'text/plain'}, 415), ({'Content-Encoding': 'gzip'}, 415)]
        for headers, status in cases:
            self.assertEqual(self.post(headers={**self.auth, **headers}).status_code, status)
        with TestClient(self.app, base_url='http://worker.company.com') as insecure:
            response = insecure.post('/worker/research', json=self.body(), headers={**self.auth, 'X-Forwarded-Proto': 'https'})
            self.assertEqual(response.status_code, 426)  # app does not trust arbitrary headers
        self.assertEqual(self.client.get('/worker/research', headers=self.auth).status_code, 405)

    def test_strict_contract_bounds_and_validation_do_not_echo_input(self):
        bad = [dict(self.body(), tenant_id='other-tenant'), dict(self.body(), mode='demo'),
               self.body('manual', []), self.body('manual', ['company.com'] * 11),
               dict(self.body(), campaign_id='has spaces'), dict(self.body(), campaign_id='x' * 129),
               dict(self.body(), profile={**DEMO_PROFILE.model_dump(), 'private_secret': self.token}),
               dict(self.body(), mode='automatic')]
        for body in bad:
            response = self.post(body)
            self.assertEqual(response.status_code, 422, response.text)
            self.assertNotIn(self.token, response.text)
        response = self.client.post('/worker/research', content='{' + self.token,
                                    headers={**self.auth, 'Content-Type': 'application/json'})
        self.assertEqual(response.status_code, 422)
        self.assertNotIn(self.token, response.text)

    def test_body_limits_and_auth_before_body(self):
        headers = {**self.auth, 'Content-Type': 'application/json'}
        self.assertEqual(self.client.post('/worker/research', content='x' * 65_537, headers=headers).status_code, 413)
        self.assertEqual(self.client.post('/worker/research', content='x' * 65_537, headers={}).status_code, 401)
        # Raw ASGI proves limit also applies without Content-Length.
        statuses = []
        async def exercise():
            async def receive():
                return {'type': 'http.request', 'body': b'x' * 65_537, 'more_body': False}
            async def send(message):
                if message['type'] == 'http.response.start':
                    statuses.append(message['status'])
            scope = {'type': 'http', 'asgi': {'version': '3.0'}, 'http_version': '1.1',
                     'scheme': 'https', 'method': 'POST', 'path': '/worker/research', 'query_string': b'',
                     'headers': [(b'host', b'worker.company.com'), (b'authorization', self.auth['Authorization'].encode()),
                                 (b'content-type', b'application/json')]}
            await self.app(scope, receive, send)
        asyncio.run(exercise())
        self.assertEqual(statuses, [413])

    def test_slow_body_deadline_and_false_length_are_bounded(self):
        statuses = []
        async def exercise():
            async def receive():
                await asyncio.sleep(0.02)
                return {'type': 'http.request', 'body': b'', 'more_body': True}
            async def send(message):
                if message['type'] == 'http.response.start':
                    statuses.append(message['status'])
            scope = {'type': 'http', 'asgi': {'version': '3.0'}, 'http_version': '1.1',
                     'scheme': 'https', 'method': 'POST', 'path': '/worker/research', 'query_string': b'',
                     'headers': [(b'host', b'worker.company.com'), (b'authorization', self.auth['Authorization'].encode()),
                                 (b'content-type', b'application/json')]}
            with patch('app.worker.MAX_BODY_SECONDS', 0.005):
                await self.app(scope, receive, send)
        asyncio.run(exercise())
        self.assertEqual(statuses, [408])
        result = self.client.post('/worker/research', content='{}', headers={**self.auth,
                                  'Content-Type': 'application/json', 'Content-Length': '1'})
        self.assertEqual(result.status_code, 400)
        # A rejected/timed-out request must release capacity.
        self.assertEqual(self.post().status_code, 200)

    def test_research_budget_stops_new_domains_without_network(self):
        with patch('app.worker.RESEARCH_DEADLINE_SECONDS', 0), \
             patch.object(self.app.state, 'fetch_page', side_effect=AssertionError('No late network calls')) as fetch:
            response = self.post(self.body('manual', ['company.com']))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['accounts'], [])
        self.assertIn('deadline', response.json()['errors'][0])
        fetch.assert_not_called()

    def test_analyze_contract_without_writes(self):
        self.app.state.fetch_page = lambda url: PAGE
        result = self.post({'website': 'company.com'}, path='/worker/analyze')
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(set(result.json()), {'profile', 'website'})
        self.assertEqual(result.json()['website'], PAGE.url)
        self.assertEqual(result.json()['profile']['company_name'], 'Company')

    def test_research_partial_errors_dedup_and_no_retries(self):
        calls = []
        def fetch(url):
            calls.append(url)
            if 'failure.com' in url:
                raise FetchError('The website hostname could not be resolved')
            return PAGE
        self.app.state.fetch_page = fetch
        result = self.post(self.body('manual', ['company.com', 'failure.com', 'company.com', 'http://127.0.0.1/']))
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(len(result.json()['accounts']), 1)
        self.assertEqual(len(result.json()['errors']), 2)
        self.assertEqual(sorted(calls), ['https://company.com/', 'https://failure.com/'])
        self.assertTrue(all(not a['is_demo'] for a in result.json()['accounts']))

    def test_fetch_security_is_used_by_worker_routes(self):
        self.app.state.fetch_page = fetch_public_page
        with patch('app.safety.socket.getaddrinfo', return_value=[(2, 1, 6, '', ('169.254.169.254', 443))]), \
             patch('app.safety.socket.create_connection') as connect:
            response = self.post({'website': 'metadata.company.com'}, path='/worker/analyze')
        self.assertEqual(response.status_code, 422)
        connect.assert_not_called()
        self.assertNotIn('169.254', response.text)

    def test_logs_and_failures_redact_credentials_urls_and_exception_details(self):
        secret = secrets.token_urlsafe(36)
        def failed(_):
            raise RuntimeError(f'private URL password {secret}')
        self.app.state.fetch_page = failed
        with self.assertLogs('signalfoundry.worker', level='INFO') as logs:
            response = self.post({'website': 'company.com/?sensitive=' + secret}, path='/worker/analyze',
                                 headers={**self.auth, 'X-Request-ID': secret})
        self.assertEqual(response.status_code, 503)
        self.assertRegex(response.headers['X-Request-ID'], '^[0-9a-f]{32}$')
        self.assertNotEqual(response.headers['X-Request-ID'], secret)
        text = '\n'.join(logs.output) + response.text
        for private in (self.token, secret, 'company.com', 'RuntimeError'):
            self.assertNotIn(private, text)
        self.assertIn('operation=analyze', text)
        self.assertIn('status=503', text)

    def test_two_active_requests_third_rejected_and_capacity_recovers(self):
        entered = threading.Barrier(3)
        release = threading.Event()
        def blocked(_):
            entered.wait(timeout=5)
            release.wait(timeout=5)
            return PAGE
        self.app.state.fetch_page = blocked
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            first = pool.submit(self.post, {'website': 'company.com'}, None, '/worker/analyze')
            second = pool.submit(self.post, {'website': 'company.com'}, None, '/worker/analyze')
            entered.wait(timeout=5)
            try:
                response = self.post()
                self.assertEqual(response.status_code, 429)
                self.assertEqual(response.headers['Retry-After'], '5')
            finally:
                release.set()
            self.assertEqual(first.result(timeout=5).status_code, 200)
            self.assertEqual(second.result(timeout=5).status_code, 200)
        self.assertEqual(self.post().status_code, 200)

    def test_four_domain_lanes_are_bounded(self):
        active = 0
        peak = 0
        lock = threading.Lock()
        def fetch(url):
            nonlocal active, peak
            with lock:
                active += 1
                peak = max(peak, active)
            time.sleep(0.025)
            with lock:
                active -= 1
            return Page(url, PAGE.title, PAGE.description, PAGE.text)
        self.app.state.fetch_page = fetch
        response = self.post(self.body('manual', [f'company{i}.com' for i in range(10)]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()['accounts']), 10)
        self.assertLessEqual(peak, 4)
        self.assertGreater(peak, 1)

    def test_two_jobs_slow_dns_fit_eight_bounded_lanes(self):
        from test_security import FakeConnection, FakeResponse
        self.app.state.fetch_page = fetch_public_page
        simultaneous = threading.Barrier(8)
        lock = threading.Lock()
        active = 0
        peak = 0
        def slow_dns(host, port, **kwargs):
            nonlocal active, peak
            with lock:
                active += 1
                peak = max(peak, active)
            try:
                # All admitted domain lanes must reach DNS without false busy
                # errors. The barrier also proves the resolver pool can run 8.
                simultaneous.wait(timeout=1.5)
                time.sleep(0.01)
                return [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('8.8.8.8', port))]
            finally:
                with lock:
                    active -= 1
        with patch('app.safety.socket.getaddrinfo', side_effect=slow_dns), \
             patch('app.safety.PinnedHTTPSConnection', side_effect=lambda *args: FakeConnection(FakeResponse())), \
             concurrent.futures.ThreadPoolExecutor(max_workers=2) as jobs:
            futures = [jobs.submit(self.post, self.body('manual', [f'company{job}{domain}.com' for domain in range(4)]))
                       for job in range(2)]
            results = [future.result(timeout=5) for future in futures]
        self.assertEqual(peak, 8)
        self.assertLessEqual(peak, DNS_CAPACITY)
        for response in results:
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()['errors'], [])
            self.assertEqual(len(response.json()['accounts']), 4)

    def test_rules_default_even_with_provider_credentials(self):
        with patch.dict(os.environ, {**self.env, 'JEV_API_KEY': secrets.token_urlsafe(36)}):
            self.assertEqual(create_worker().state.decision_provider.name, 'rules')
        with patch.dict(os.environ, {**self.env, 'DECISION_ENGINE': 'jev', 'JEV_API_KEY': ''}):
            self.assertEqual(create_worker().state.decision_provider.name, 'rules')
        with patch.dict(os.environ, {**self.env, 'DECISION_ENGINE': 'jev', 'JEV_API_KEY': secrets.token_urlsafe(36)}):
            opted_in = create_worker()
            self.assertEqual(opted_in.state.decision_provider.name, 'jev')
            with TestClient(opted_in, base_url=self.env['SIGNALFOUNDRY_WORKER_URL']) as client, \
                 patch('app.jev.JevDecisionProvider._request', side_effect=AssertionError('No provider for demo')):
                result = client.post('/worker/research', json=self.body(), headers=self.auth)
                self.assertEqual(result.status_code, 200)
                self.assertTrue(all(a['decision_engine'] == 'rules' for a in result.json()['accounts']))


class WorkerConfigTest(unittest.TestCase):
    def test_https_or_explicit_local_container_origin_only(self):
        self.assertEqual(worker_origin('https://worker.company.com/'), 'https://worker.company.com')
        self.assertEqual(worker_origin('http://research-worker:8001', True), 'http://research-worker:8001')
        bad = ['http://worker.company.com', 'http://research-worker:8001', 'https://user:pass@worker.company.com',
               'https://worker.company.com/path', 'https://worker.company.com?token=anything',
               'https://worker.company.com#fragment', 'https://127.0.0.1', 'https://worker.local',
               'https://worker.company.com:443', 'https://worker.company.com:8001', 'ftp://worker.company.com',
               'https://worker.company.com\n']
        for origin in bad:
            with self.subTest(origin=origin), self.assertRaises(ValueError):
                worker_origin(origin)
        for origin in ('http://worker.company.com:8001', 'http://10.0.0.1:8001', 'http://research-worker:8002'):
            with self.assertRaises(ValueError):
                worker_origin(origin, True)

    def test_programmatic_concurrency_cannot_exceed_dns_capacity(self):
        for jobs, lanes in ((3, 4), (2, 5), (0, 4), (2, 0), (True, 4)):
            with self.subTest(jobs=jobs, lanes=lanes), self.assertRaises(ValueError):
                WorkerSettings(token='', origin='', max_jobs=jobs, parallel_domains=lanes)
        self.assertEqual(WorkerSettings(token='', origin='').max_jobs *
                         WorkerSettings(token='', origin='').parallel_domains, DNS_CAPACITY)

    def test_invalid_tokens_settings_and_secret_repr(self):
        for token in ('short', 'placeholder_' + 'x' * 32, 'x' * 257, 'x' * 31 + ' '):
            with patch.dict(os.environ, {'SIGNALFOUNDRY_WORKER_TOKEN': token}), self.assertRaises(ValueError):
                WorkerSettings.from_environment()
        token = secrets.token_urlsafe(36)
        self.assertNotIn(token, repr(WorkerSettings(token=token, origin='https://worker.company.com')))
        for key, value in (('SIGNALFOUNDRY_WORKER_ALLOW_PRIVATE_HTTP', 'yes'), ('DECISION_ENGINE', 'automatic'),
                           ('FORWARDED_ALLOW_IPS', '*'), ('FORWARDED_ALLOW_IPS', '0.0.0.0/0'),
                           ('FORWARDED_ALLOW_IPS', 'malformed-host')):
            with patch.dict(os.environ, {'SIGNALFOUNDRY_WORKER_TOKEN': '', key: value}), self.assertRaises(ValueError):
                WorkerSettings.from_environment()


if __name__ == '__main__':
    unittest.main()
