"""Offline AI draft contracts. Mock transport only: never spends provider credit."""
import json
import os
import secrets
import tempfile
import unittest
from tests.cost_fixtures import cost_context
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import Mock, patch

import httpx
from fastapi.testclient import TestClient

from app.customer_drafts import (CustomerDraft, DraftError, DraftInput, draft_cache_key,
                                 draft_facts, draft_status, generate_customer_draft, validate_content)
from app.customers import qualify_customer
from app.fixtures import DEMO_PROFILE
from app.main import create_app
from app.models import ScoreComponent
from app.safety import Page
from app.store import Repository
from app.worker import create_worker


def qualified():
    return qualify_customer(DEMO_PROFILE, Page('https://business.com/', 'Business Property Management',
        'Property management for commercial buildings.', 'Business provides property management for commercial buildings.'),
        target='property management companies', geography='', search_id='search_test')


def content(account=None):
    account = account or qualified()
    return {'subject': 'A question for your team',
            'body': 'Hello, I noticed your property management services. Our product could help your team. Would a short conversation be useful?',
            'evidence_ids': [account.evidence[0].id]}


def draft(account=None):
    return CustomerDraft(**content(account), warnings=['Review before using. Nothing has been sent.'], created_at='2026-10-19T00:00:00Z')


class DraftProviderTests(unittest.TestCase):
    def setUp(self):
        self.account = qualified()
        self.body = DraftInput(profile=DEMO_PROFILE, account=self.account)
        self.env = {'CLIENTROVE_DEEPSEEK_DRAFTS_ENABLED': 'true', 'DEEPSEEK_API_KEY': secrets.token_urlsafe(24)}

    def test_explicit_flag_required_even_with_key(self):
        with patch.dict(os.environ, {**self.env, 'CLIENTROVE_DEEPSEEK_DRAFTS_ENABLED': ''}):
            self.assertEqual(draft_status()['status'], 'unconfigured')
            with self.assertRaises(DraftError), patch('httpx.Client', side_effect=AssertionError('No provider call')):
                generate_customer_draft(self.body)

    def test_single_fixed_host_json_call_grounded_and_cited(self):
        calls = []
        def respond(request):
            calls.append(request)
            payload = json.loads(request.content)
            self.assertEqual(payload['model'], 'deepseek-flash')
            self.assertEqual(payload['thinking'], {'type': 'disabled'})
            self.assertEqual(payload['max_tokens'], 600)
            self.assertEqual(payload['response_format'], {'type': 'json_object'})
            facts = json.loads(payload['messages'][1]['content'])
            self.assertNotIn('contacts', facts)
            self.assertNotIn('url', facts['evidence'][0])
            self.assertNotIn(self.env['DEEPSEEK_API_KEY'], request.content.decode())
            return httpx.Response(200, json={'usage': {'prompt_tokens': 100, 'completion_tokens': 20, 'total_tokens': 120}, 'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps(content(self.account))}}]})
        with patch.dict(os.environ, self.env):
            result = generate_customer_draft(self.body, transport=httpx.MockTransport(respond), cost=cost_context(self, keys=self.env))
        self.assertEqual(len(calls), 1)
        self.assertEqual(str(calls[0].url), 'https://api.deepseek.com/chat/completions')
        self.assertEqual(result.generation_engine, 'deepseek')
        self.assertIn('No verified email', result.warnings[-1])

    def test_invalid_truncated_redirect_provider_error_and_oversize_never_retry(self):
        responses = [httpx.Response(302, headers={'location': 'https://attacker.com/'}),
                     httpx.Response(429, json={'error': self.env['DEEPSEEK_API_KEY']}),
                     httpx.Response(200, content=b'X' * 33_000, headers={'content-type': 'application/json'}),
                     httpx.Response(200, json={'choices': [{'finish_reason': 'length', 'message': {'content': '{}'}}]}),
                     httpx.Response(200, json={'choices': [{'finish_reason': 'stop', 'message': {'content': ''}}]})]
        for response in responses:
            call = Mock(return_value=response)
            with self.subTest(status=response.status_code), patch.dict(os.environ, self.env):
                with self.assertRaises(DraftError) as raised:
                    generate_customer_draft(self.body, transport=httpx.MockTransport(call), cost=cost_context(self, keys=self.env))
                self.assertNotIn(self.env['DEEPSEEK_API_KEY'], str(raised.exception))
                self.assertEqual(call.call_count, 1)

    def test_model_output_rejects_fabricated_sources_destinations_and_numbers(self):
        facts = draft_facts(DEMO_PROFILE, self.account)
        bad = [dict(content(self.account), evidence_ids=['unknown']),
               dict(content(self.account), extra='not allowed'),
               dict(content(self.account), subject='Subject\nInjected header')]
        for value in ('Visit example.dev', 'Call tel:+14165551234', 'Call +1 (416) 555-1234',
                      'Reply info@business.com', 'Visit https://business.com', 'Results improve 77%'):
            bad.append(dict(content(self.account), body=value))
        for data in bad:
            with self.subTest(data=data), self.assertRaises(DraftError):
                validate_content(data, facts)

    def test_provenance_and_verification_changes_invalidate_cache(self):
        original = draft_cache_key(DEMO_PROFILE, self.account)
        revised = self.account.model_copy(deep=True)
        revised.evidence[0].url = 'https://business.com/about'
        self.assertNotEqual(original, draft_cache_key(DEMO_PROFILE, revised))
        revised = self.account.model_copy(deep=True)
        revised.evidence[0].retrieved_at = '2026-10-20T00:00:00Z'
        self.assertNotEqual(original, draft_cache_key(DEMO_PROFILE, revised))
        revised = self.account.model_copy(deep=True)
        revised.unknowns.append('Contact verification changed')
        self.assertNotEqual(original, draft_cache_key(DEMO_PROFILE, revised))

    def test_location_cannot_compensate_for_weak_type_or_exclusion(self):
        for parts in ([ScoreComponent(label='Customer-type language', points=30, max_points=60, reason='Body only'),
                       ScoreComponent(label='Location language', points=40, max_points=40, reason='Location')],
                      self.account.score_breakdown + [ScoreComponent(label='Exclusion penalty', points=0, max_points=0, reason='Excluded')]):
            weak = self.account.model_copy(update={'score_breakdown': parts})
            with self.assertRaises(DraftError):
                draft_facts(DEMO_PROFILE, weak)


class DraftPersistenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'drafts.sqlite3'

    def test_reservation_is_atomic_cached_and_tenant_scoped(self):
        repo = Repository(self.path)
        def reserve(_):
            try:
                return repo.reserve_customer_draft('snapshot', 'request_123') is None
            except DraftError:
                return False
        with ThreadPoolExecutor(max_workers=3) as pool:
            self.assertEqual(sum(pool.map(reserve, range(3))), 1)
        result = draft()
        repo.finish_customer_draft('snapshot', 'request_123', result)
        self.assertEqual(repo.reserve_customer_draft('snapshot', 'new_request'), result)
        with self.assertRaises(DraftError):
            repo.reserve_customer_draft('changed_snapshot', 'request_123')
        with self.assertRaises(DraftError):
            repo.reserve_customer_draft('changed_snapshot', 'new_request')
        other = Repository(self.path, tenant_id='other')
        self.assertIsNone(other.reserve_customer_draft('snapshot', 'request_123'))

    def test_failures_consume_quota_and_same_snapshot_never_retries(self):
        repo = Repository(self.path)
        for index in range(5):
            self.assertIsNone(repo.reserve_customer_draft(f'snapshot{index}', f'request_{index}'))
            repo.finish_customer_draft(f'snapshot{index}', f'request_{index}')
        with self.assertRaises(DraftError):
            repo.reserve_customer_draft('snapshot0', 'new_key')
        with self.assertRaisesRegex(DraftError, 'allowance'):
            repo.reserve_customer_draft('snapshot5', 'new_key5')

    def test_failed_key_replay_is_free_but_explicit_new_key_retries(self):
        repo = Repository(self.path)
        self.assertIsNone(repo.reserve_customer_draft('snapshot', 'first_request'))
        repo.finish_customer_draft('snapshot', 'first_request')
        with self.assertRaises(DraftError):
            repo.reserve_customer_draft('snapshot', 'first_request')
        self.assertIsNone(repo.reserve_customer_draft('snapshot', 'explicit_retry'))
        with self.assertRaises(DraftError):
            repo.reserve_customer_draft('snapshot', 'pending_duplicate')
        result = draft()
        repo.finish_customer_draft('snapshot', 'explicit_retry', result)
        self.assertEqual(repo.reserve_customer_draft('snapshot', 'cached_new_key'), result)
        with repo.connect() as db:
            rows = db.execute('SELECT charged,status FROM customer_draft_requests WHERE tenant_id=?', (repo.tenant_id,)).fetchall()
        self.assertEqual(sum(row['charged'] for row in rows), 2)

    def test_cached_alias_rows_are_bounded_while_existing_requests_stay_reusable(self):
        repo = Repository(self.path)
        repo.reserve_customer_draft('snapshot', 'original_key')
        result = draft()
        repo.finish_customer_draft('snapshot', 'original_key', result)
        for index in range(100):
            self.assertEqual(repo.reserve_customer_draft('snapshot', f'cached_alias_{index}'), result)
        with self.assertRaisesRegex(DraftError, 'request allowance'):
            repo.reserve_customer_draft('snapshot', 'alias_over_limit')
        self.assertEqual(repo.reserve_customer_draft('snapshot', 'original_key'), result)

    def test_pending_recovery_commits_and_stale_finish_cannot_overwrite_retry(self):
        repo = Repository(self.path)
        repo.reserve_customer_draft('snapshot', 'interrupted_key')
        with repo.connect() as db:
            for table in ('customer_drafts', 'customer_draft_requests'):
                db.execute(f'UPDATE {table} SET created_at=? WHERE tenant_id=?', ('2026-01-01T00:00:00Z', repo.tenant_id))
        with self.assertRaisesRegex(DraftError, 'interrupted'):
            repo.reserve_customer_draft('snapshot', 'interrupted_key')
        with repo.connect() as db:
            self.assertEqual(db.execute('SELECT status FROM customer_drafts WHERE tenant_id=?', (repo.tenant_id,)).fetchone()['status'], 'failed')
        self.assertIsNone(repo.reserve_customer_draft('snapshot', 'explicit_new_key'))
        self.assertFalse(repo.finish_customer_draft('snapshot', 'interrupted_key', draft()))
        result = draft()
        self.assertTrue(repo.finish_customer_draft('snapshot', 'explicit_new_key', result))
        self.assertEqual(repo.reserve_customer_draft('snapshot', 'cached_result'), result)

    def test_cache_alias_allowance_recovers_next_window(self):
        repo = Repository(self.path)
        repo.reserve_customer_draft('snapshot', 'original_key')
        result = draft()
        repo.finish_customer_draft('snapshot', 'original_key', result)
        for index in range(100):
            repo.reserve_customer_draft('snapshot', f'cached_alias_{index}')
        with repo.connect() as db:
            db.execute('UPDATE customer_draft_requests SET created_at=? WHERE charged=0', ('2026-01-01T00:00:00Z',))
        self.assertEqual(repo.reserve_customer_draft('snapshot', 'new_window_alias'), result)

    def test_api_checks_search_account_scope_and_replays_without_charge(self):
        app = create_app(self.path, testing=True)
        repo = app.state.repository
        repo.save_profile(DEMO_PROFILE)
        search, _ = repo.create_customer_search('search_request', 'property management')
        account = qualified()
        search.accounts, search.status = [account], 'complete'
        repo.save_customer_search(search)
        generator = Mock(return_value=draft(account))
        app.state.generate_customer_draft = generator
        endpoint = f'/api/customers/searches/{search.id}/accounts/{account.id}/draft'
        with patch.dict(os.environ, {'CLIENTROVE_DEEPSEEK_DRAFTS_ENABLED': 'true', 'DEEPSEEK_API_KEY': secrets.token_urlsafe(24)}), TestClient(app) as client:
            first = client.post(endpoint, json={'idempotency_key': 'draft_request'})
            self.assertEqual(first.status_code, 200, first.text)
            self.assertEqual(client.post(endpoint, json={'idempotency_key': 'new_request'}).json(), first.json())
            with patch.dict(os.environ, {'CLIENTROVE_DEEPSEEK_DRAFTS_ENABLED': '', 'DEEPSEEK_API_KEY': ''}):
                self.assertEqual(client.post(endpoint, json={'idempotency_key': 'cached_without_provider'}).json(), first.json())
            self.assertEqual(client.post(endpoint.replace(account.id, 'unknown'), json={'idempotency_key': 'draft_request'}).status_code, 404)
            self.assertEqual(client.post(endpoint, json={'idempotency_key': 'draft_request', 'profile': {}}).status_code, 422)
        self.assertEqual(generator.call_count, 1)

    def test_worker_draft_route_requires_authentication(self):
        token = secrets.token_urlsafe(36)
        with patch.dict(os.environ, {'SIGNALFOUNDRY_WORKER_TOKEN': token, 'SIGNALFOUNDRY_WORKER_URL': 'https://worker.company.com'}):
            with TestClient(create_worker(), base_url='https://worker.company.com') as client:
                response = client.post('/worker/customer-draft', json={})
                self.assertEqual(response.status_code, 401)
                with patch('app.worker.generate_customer_draft', return_value=draft()) as generate:
                    response = client.post('/worker/customer-draft', json={'profile': DEMO_PROFILE.model_dump(), 'account': qualified().model_dump()}, headers={'Authorization': f'Bearer {token}'})
                self.assertEqual(response.status_code, 200, response.text)
                self.assertEqual(generate.call_count, 1)


if __name__ == '__main__':
    unittest.main()
