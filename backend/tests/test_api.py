import csv
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from app.fixtures import DEMO_PROFILE
from app.main import create_app, csv_safe
from app.models import Profile
from app.safety import FetchError, Page
from app.store import Repository


PAGE = Page('https://public-company.com/', 'Public Company | Workflow',
            'Public Company makes sales workflow automation software.',
            'Public Company makes B2B SaaS sales workflow automation and pipeline software for VP Sales and Revenue Operations. We are hiring developers.')


class APITest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'database.sqlite3'
        self.app = create_app(self.path, testing=True)
        self.client = TestClient(self.app)

    def tearDown(self):
        self.client.close()
        self.temp.cleanup()

    def demo(self):
        response = self.client.post('/api/demo/reset', json={})
        self.assertEqual(response.status_code, 200)
        campaign = self.client.post('/api/campaigns', json={'name': 'Test', 'mode': 'demo', 'domains': []})
        self.assertEqual(campaign.status_code, 201)
        return campaign.json()['id']

    def research_demo(self):
        campaign_id = self.demo()
        self.assertEqual(self.client.post(f'/api/campaigns/{campaign_id}/research', json={}).json()['status'], 'complete')
        return campaign_id, self.client.get(f'/api/campaigns/{campaign_id}/accounts').json()

    def test_health_is_honest_and_empty_workspace(self):
        health = self.client.get('/api/health').json()
        self.assertEqual(health['mode'], 'local-demo')
        self.assertEqual(health['decision_engine'], 'rules')
        self.assertEqual(health['providers']['contacts'], 'not_configured')
        self.assertIsNone(self.client.get('/api/workspace').json()['profile'])

    def test_complete_demo_flow(self):
        campaign_id, accounts = self.research_demo()
        self.assertEqual(len(accounts), 8)
        self.assertEqual([a['score'] for a in accounts], sorted([a['score'] for a in accounts], reverse=True))
        self.assertGreater(accounts[0]['score'], accounts[-1]['score'])
        for account in accounts:
            self.assertTrue(account['is_demo'])
            self.assertTrue(account['domain'].endswith('.example'))
            self.assertTrue(account['evidence'])
            self.assertTrue(all(e['is_demo'] and e['published_at'] is None for e in account['evidence']))
            self.assertTrue(all(c['email'] is None and c['verification_status'] == 'not_available' for c in account['contacts']))
            self.assertEqual(account['score'], max(0, min(100, sum(x['points'] for x in account['score_breakdown']))))
        draft = self.client.post(f"/api/accounts/{accounts[0]['id']}/draft", json={}).json()
        self.assertEqual(draft['engine'], 'grounded_template')
        self.assertIn('FICTIONAL DEMO', draft['warning'])
        self.assertTrue(draft['basis'])
        self.assertIn('Your website includes this description:', draft['body'])
        self.assertNotIn('I was looking', draft['body'])
        self.assertIn('nothing is sent', draft['warning'])

    def test_rerun_preserves_ids_statuses_no_duplicates(self):
        campaign_id, accounts = self.research_demo()
        first = accounts[0]
        self.client.patch(f"/api/accounts/{first['id']}", json={'status': 'shortlisted'})
        self.client.post(f'/api/campaigns/{campaign_id}/research', json={})
        again = self.client.get(f'/api/campaigns/{campaign_id}/accounts').json()
        self.assertEqual({a['id'] for a in accounts}, {a['id'] for a in again})
        self.assertEqual(self.client.get(f"/api/accounts/{first['id']}").json()['status'], 'shortlisted')

    def test_profile_and_accounts_persist_after_restart(self):
        campaign_id, accounts = self.research_demo()
        new = TestClient(create_app(self.path, testing=True))
        self.assertIsNotNone(new.get('/api/workspace').json()['profile'])
        self.assertEqual(new.get(f'/api/campaigns/{campaign_id}/accounts').json(), accounts)
        new.close()

    def test_demo_reset_preserves_campaigns(self):
        campaign_id, accounts = self.research_demo()
        self.client.post('/api/demo/reset', json={})
        self.assertEqual(self.client.get(f'/api/campaigns/{campaign_id}/accounts').json(), accounts)

    def test_profile_can_be_edited_without_rescoring_snapshots(self):
        campaign_id, accounts = self.research_demo()
        profile = DEMO_PROFILE.model_dump()
        profile.update(company_name='Edited Company', keywords=['industrial'])
        response = self.client.put('/api/workspace/profile', json=profile)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['name'], 'Edited Company')
        self.assertEqual(self.client.get(f'/api/campaigns/{campaign_id}/accounts').json(), accounts)

    def test_analyze_page_and_keep_unknown_firmographics(self):
        self.app.state.fetch_page = lambda _: PAGE
        result = self.client.post('/api/workspace/analyze', json={'website': 'public-company.com'})
        self.assertEqual(result.status_code, 200)
        profile = result.json()['profile']
        self.assertIn('Draft ICP', profile['description'])
        self.assertIn('workflow', profile['keywords'])
        self.assertEqual(profile['geographies'], [])
        self.assertEqual(profile['company_sizes'], [])

    def test_failed_analysis_does_not_wipe_profile(self):
        self.demo()
        before = self.client.get('/api/workspace').json()
        def fail(_):
            raise FetchError('Website unavailable')
        self.app.state.fetch_page = fail
        self.assertEqual(self.client.post('/api/workspace/analyze', json={'website': 'public-company.com'}).status_code, 422)
        self.assertEqual(self.client.get('/api/workspace').json(), before)

    def test_manual_research_unknowns_and_citations(self):
        self.demo()
        self.app.state.fetch_page = lambda _: PAGE
        campaign = self.client.post('/api/campaigns', json={'name': 'Manual', 'mode': 'manual', 'domains': ['public-company.com']}).json()
        self.assertEqual(self.client.post(f"/api/campaigns/{campaign['id']}/research", json={}).json()['status'], 'complete')
        account = self.client.get(f"/api/campaigns/{campaign['id']}/accounts").json()[0]
        self.assertFalse(account['is_demo'])
        self.assertEqual(account['employee_range'], 'Unknown')
        self.assertEqual(account['location'], 'Unknown')
        self.assertTrue(all(e['url'] == PAGE.url and e['retrieved_at'] and e['published_at'] is None for e in account['evidence']))
        self.assertTrue(all('unverified' in signal for signal in account['why_now']))

    def test_partial_and_failed_retries_retain_prior_results(self):
        self.demo()
        campaign = self.client.post('/api/campaigns', json={'name': 'Manual', 'mode': 'manual', 'domains': ['public-company.com', 'other-company.com']}).json()
        def fetch(url):
            if 'other-company' in url:
                raise FetchError('Website unavailable')
            return PAGE
        self.app.state.fetch_page = fetch
        response = self.client.post(f"/api/campaigns/{campaign['id']}/research", json={}).json()
        self.assertEqual(response['status'], 'partial')
        previous = self.client.get(f"/api/campaigns/{campaign['id']}/accounts").json()
        def fail(_):
            raise FetchError('Website unavailable')
        self.app.state.fetch_page = fail
        response = self.client.post(f"/api/campaigns/{campaign['id']}/research", json={}).json()
        self.assertEqual(response['status'], 'failed')
        self.assertEqual(response['account_count'], 1)
        self.assertEqual(self.client.get(f"/api/campaigns/{campaign['id']}/accounts").json(), previous)

    def test_concurrent_research_returns_conflict(self):
        campaign_id = self.demo()
        self.app.state.research_lock.acquire()
        try:
            self.assertEqual(self.client.post(f'/api/campaigns/{campaign_id}/research', json={}).status_code, 409)
        finally:
            self.app.state.research_lock.release()

    def test_research_requires_profile(self):
        campaign = self.client.post('/api/campaigns', json={'name': 'Test', 'mode': 'demo', 'domains': []}).json()
        self.assertEqual(self.client.post(f"/api/campaigns/{campaign['id']}/research", json={}).status_code, 422)

    def test_strict_inputs_and_bounded_values(self):
        invalid = [
            {'name': 'x', 'mode': 'manual', 'domains': []},
            {'name': 'x', 'mode': 'demo', 'domains': ['company.com']},
            {'name': 'x', 'mode': 'demo', 'domains': [], 'tenant_id': 'other'},
            {'name': 'x' * 201, 'mode': 'demo', 'domains': []},
            {'name': 99, 'mode': 'demo', 'domains': []},
            {'name': '', 'mode': 'demo', 'domains': []},
            {'name': 'x', 'mode': 'manual', 'domains': ['company.com'] * 11},
            {'name': 'x', 'mode': 'manual', 'domains': ['http://127.0.0.1']},
            {'name': 'x', 'mode': 'weird', 'domains': []},
        ]
        for value in invalid:
            with self.subTest(value=value):
                response = self.client.post('/api/campaigns', json=value)
                self.assertEqual(response.status_code, 422)
                self.assertIsInstance(response.json()['detail'], str)

    def test_input_deduplication_and_allowed_maximum(self):
        response = self.client.post('/api/campaigns', json={'name': 'x' * 200, 'mode': 'manual', 'domains': ['Company.com', 'https://company.com/']})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['domains'], ['https://company.com/'])

    def test_invalid_status_missing_records_and_no_send(self):
        campaign_id, accounts = self.research_demo()
        response = self.client.patch(f"/api/accounts/{accounts[0]['id']}", json={'status': 'verified'})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.client.get('/api/accounts/missing').status_code, 404)
        self.assertEqual(self.client.get('/api/campaigns/missing/accounts').status_code, 404)
        self.assertEqual(self.client.get('/api/campaigns/missing/export.csv').status_code, 404)
        self.assertEqual(self.client.post('/api/send', json={}).status_code, 404)

    def test_cross_tenant_isolation(self):
        campaign_id, accounts = self.research_demo()
        foreign = Repository(self.path, 'another-tenant')
        self.assertEqual(foreign.campaigns(), [])
        self.assertEqual(foreign.accounts(campaign_id), [])
        self.assertIsNone(foreign.account(accounts[0]['id']))
        self.assertIsNone(foreign.campaign(campaign_id))
        self.assertIsNone(foreign.set_account_status(accounts[0]['id'], 'dismissed'))
        self.assertIsNone(foreign.workspace().profile)

    def test_atomic_rollback_on_bad_research_account(self):
        campaign_id, accounts = self.research_demo()
        repo = self.app.state.repository
        valid = repo.accounts(campaign_id)[0].model_copy(update={'description': 'Modified'})
        invalid = valid.model_copy(update={'campaign_id': 'wrong-campaign'})
        with self.assertRaises(ValueError):
            repo.save_research(campaign_id, [valid, invalid], [])
        self.assertEqual(self.client.get(f'/api/campaigns/{campaign_id}/accounts').json(), accounts)

    def test_csv_escaping_and_export(self):
        for value in ['=cmd()', '+cmd', '-cmd', '@SUM(A1)', '\t=cmd', '\r=cmd', '\ncmd', '   =cmd']:
            self.assertTrue(csv_safe(value).startswith("'"))
        self.assertEqual(csv_safe('ordinary'), 'ordinary')
        campaign_id, accounts = self.research_demo()
        repo = self.app.state.repository
        account = repo.accounts(campaign_id)[0].model_copy(update={'name': '=HYPERLINK("bad")'})
        repo.save_research(campaign_id, [account], [])
        response = self.client.get(f'/api/campaigns/{campaign_id}/export.csv')
        self.assertIn('attachment;', response.headers['content-disposition'])
        rows = list(csv.DictReader(io.StringIO(response.text)))
        self.assertEqual(len(rows), 8)
        self.assertTrue(next(r for r in rows if r['domain'] == account.domain)['name'].startswith("'="))

    def test_origin_host_and_content_type_restrictions(self):
        self.assertEqual(self.client.post('/api/demo/reset', json={}, headers={'Origin': 'https://evil.com'}).status_code, 403)
        self.assertEqual(self.client.get('/api/workspace', headers={'Host': 'evil.com'}).status_code, 400)
        self.assertEqual(self.client.post('/api/demo/reset', content='{}', headers={'Content-Type': 'text/plain'}).status_code, 415)
        response = self.client.post('/api/demo/reset', json={}, headers={'Origin': 'http://localhost:3000'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['access-control-allow-origin'], 'http://localhost:3000')
        self.assertEqual(response.headers['cache-control'], 'no-store')

    def test_body_limit_and_json_shape(self):
        self.assertEqual(self.client.post('/api/demo/reset', content='x' * 65537, headers={'Content-Type': 'application/json'}).status_code, 413)
        self.assertEqual(self.client.post('/api/demo/reset', content='{', headers={'Content-Type': 'application/json'}).status_code, 422)
        self.assertEqual(self.client.post('/api/demo/reset', json={'surprise': True}).status_code, 422)

    def test_unexpected_fetch_error_preserves_data(self):
        campaign_id, accounts = self.research_demo()
        self.assertEqual(self.client.get(f'/api/campaigns/{campaign_id}/accounts').json(), accounts)
        self.demo()
        campaign = self.client.post('/api/campaigns', json={'name': 'Bad provider', 'mode': 'manual', 'domains': ['public-company.com']}).json()
        def crash(_):
            raise RuntimeError('Sensitive internal detail')
        self.app.state.fetch_page = crash
        with self.assertLogs('app.main', level='ERROR'):
            result = self.client.post(f"/api/campaigns/{campaign['id']}/research", json={}).json()
        self.assertEqual(result['status'], 'failed')
        self.assertNotIn('Sensitive', str(result))


if __name__ == '__main__':
    unittest.main()
