"""Latest tenant-scoped review decisions and reversible, exact-domain suppression."""
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient
from app.fixtures import DEMO_PROFILE
from app.main import create_app
from app.research import demo_accounts
from app.store import Repository
from app.safety import Page
from unittest.mock import Mock


class FeedbackTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'feedback.sqlite3'
        self.repo = Repository(self.path)
        self.repo.save_profile(DEMO_PROFILE)
        self.campaign = self.repo.create_campaign('Review', 'demo', [])
        self.repo.save_research(self.campaign.id, demo_accounts(DEMO_PROFILE, self.campaign.id), [])
        self.account = self.repo.accounts(self.campaign.id)[0]
        self.client = TestClient(create_app(self.path, testing=True))

    def tearDown(self):
        self.client.close()
        self.temp.cleanup()

    def review(self, **body):
        return self.client.patch(f'/api/accounts/{self.account.id}', json=body)

    def test_reason_timestamp_context_and_latest_feedback_survive_restart_and_rerun(self):
        first = self.review(status='dismissed', reason='wrong_size').json()
        self.assertEqual(first['review_reason'], 'wrong_size')
        self.assertTrue(first['reviewed_at'].endswith('Z'))
        self.assertFalse(first['suppress_workspace'])
        self.repo = Repository(self.path)
        self.repo.save_research(self.campaign.id, demo_accounts(DEMO_PROFILE, self.campaign.id), [])
        stored = self.repo.account(self.account.id)
        self.assertEqual((stored.status, stored.review_reason, stored.reviewed_at),
                         ('dismissed', 'wrong_size', first['reviewed_at']))
        updated = self.review(status='dismissed', reason='competitor').json()
        self.assertEqual(updated['review_reason'], 'competitor')
        with self.repo.connect() as db:
            rows = db.execute('SELECT * FROM account_feedback').fetchall()
        self.assertEqual(len(rows), 1)
        self.assertEqual((rows[0]['tenant_id'], rows[0]['campaign_id'], rows[0]['account_id']),
                         ('local-demo', self.campaign.id, self.account.id))
        self.assertNotIn('contacts', rows[0].keys())

    def test_campaign_pass_does_not_infer_workspace_or_category_exclusion(self):
        self.review(status='dismissed', reason='wrong_industry')
        another = self.repo.create_campaign('Another search', 'demo', [])
        self.repo.save_research(another.id, demo_accounts(DEMO_PROFILE, another.id), [])
        matching = next(a for a in self.repo.accounts(another.id) if a.domain == self.account.domain)
        self.assertEqual(matching.status, 'new')
        self.assertEqual(len(self.repo.accounts(another.id)), 8)
        self.assertEqual(self.repo.workspace().profile, DEMO_PROFILE)

    def test_explicit_suppression_is_workspace_scoped_and_undo_restores_future_results(self):
        result = self.review(status='dismissed', reason='existing_customer', suppress_workspace=True)
        self.assertEqual(result.status_code, 200)
        self.assertTrue(result.json()['suppress_workspace'])
        second = self.repo.create_campaign('Second', 'demo', [])
        self.repo.save_research(second.id, demo_accounts(DEMO_PROFILE, second.id), [])
        self.assertEqual(len(self.repo.accounts(second.id)), 7)
        self.assertNotIn(self.account.domain, [a.domain for a in self.repo.accounts(second.id)])
        # Existing reviewed results remain accessible for immediate Undo.
        self.repo.save_research(self.campaign.id, demo_accounts(DEMO_PROFILE, self.campaign.id), [])
        self.assertEqual(self.repo.account(self.account.id).status, 'dismissed')
        foreign = Repository(self.path, 'other-tenant')
        foreign.save_profile(DEMO_PROFILE)
        third = foreign.create_campaign('Other tenant', 'demo', [])
        foreign.save_research(third.id, demo_accounts(DEMO_PROFILE, third.id), [])
        self.assertEqual(len(foreign.accounts(third.id)), 8)
        self.assertIsNone(foreign.set_account_status(self.account.id, 'dismissed', suppress_workspace=True))
        foreign.restore_workspace_domain(self.account.domain)
        self.assertTrue(self.repo.is_workspace_suppressed(self.account.domain))
        # Review status is separate from workspace scope: only explicit restore clears it.
        kept_scope = self.review(status='new').json()
        self.assertTrue(kept_scope['suppress_workspace'])
        restored = self.review(status='new', suppress_workspace=False).json()
        self.assertFalse(restored['suppress_workspace'])
        self.assertIsNone(restored['review_reason'])
        self.repo.save_research(second.id, demo_accounts(DEMO_PROFILE, second.id), [])
        self.assertEqual(len(self.repo.accounts(second.id)), 8)
        self.assertEqual(self.repo.account(self.account.id).status, 'new')

    def test_decision_survives_account_replacement_and_suppression_can_restore_after_deletion(self):
        self.review(status='dismissed', reason='not_relevant')
        with self.repo.connect() as db:
            db.execute('DELETE FROM accounts WHERE tenant_id=? AND id=?', ('local-demo', self.account.id))
        self.repo.save_research(self.campaign.id, demo_accounts(DEMO_PROFILE, self.campaign.id), [])
        self.assertNotIn(self.account.domain, [a.domain for a in self.repo.accounts(self.campaign.id)])
        with self.repo.connect() as db:
            feedback = db.execute('SELECT status,reason FROM account_feedback WHERE tenant_id=? AND campaign_id=? AND domain=?',
                ('local-demo', self.campaign.id, self.account.domain)).fetchone()
        self.assertEqual((feedback['status'], feedback['reason']), ('dismissed', 'not_relevant'))
        self.account = self.repo.accounts(self.campaign.id)[0]
        self.repo.set_account_status(self.account.id, 'dismissed', suppress_workspace=True)
        with self.repo.connect() as db:
            db.execute('DELETE FROM accounts WHERE tenant_id=? AND id=?', ('local-demo', self.account.id))
        response = self.client.get('/api/workspace/suppressions?limit=1')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['items'][0]['domain'], self.account.domain)
        self.assertEqual(self.client.post('/api/workspace/suppressions/restore', json={'domain': self.account.domain}).status_code, 200)
        self.assertFalse(self.repo.is_workspace_suppressed(self.account.domain))

    def test_research_output_cannot_invent_user_review_feedback(self):
        campaign = self.repo.create_campaign('Unreviewed', 'demo', [])
        supplied = demo_accounts(DEMO_PROFILE, campaign.id)[0].model_copy(update={
            'status': 'dismissed', 'review_reason': 'other', 'reviewed_at': '2020-01-01T00:00:00Z',
            'suppress_workspace': True})
        self.repo.save_research(campaign.id, [supplied], [])
        saved = self.repo.accounts(campaign.id)[0]
        self.assertEqual(saved.status, 'new')
        self.assertIsNone(saved.review_reason)
        self.assertIsNone(saved.reviewed_at)
        self.assertFalse(saved.suppress_workspace)

    def test_manual_pass_and_workspace_suppression_prevent_fetch_and_refresh(self):
        app = self.client.app
        fetch = Mock(return_value=Page('https://company.com/', 'Company', 'Sales workflow',
            'B2B SaaS workflow automation for VP Sales'))
        app.state.fetch_page = fetch
        campaign = self.repo.create_campaign('Manual', 'manual', ['https://company.com/'])
        self.client.post(f'/api/campaigns/{campaign.id}/research', json={})
        account = self.repo.accounts(campaign.id)[0]
        self.repo.set_account_status(account.id, 'dismissed', reason='wrong_size')
        before = self.repo.account(account.id)
        fetch.reset_mock()
        self.client.post(f'/api/campaigns/{campaign.id}/research', json={})
        fetch.assert_not_called()
        self.assertEqual(self.repo.account(account.id), before)
        self.repo.set_account_status(account.id, 'dismissed', suppress_workspace=True)
        other = self.repo.create_campaign('Future', 'manual', ['https://www.company.com/'])
        self.client.post(f'/api/campaigns/{other.id}/research', json={})
        fetch.assert_not_called()
        self.assertEqual(self.repo.accounts(other.id), [])
        # Current live suppression also blocks the direct draft endpoint.
        self.assertEqual(self.client.post(f'/api/accounts/{account.id}/draft', json={}).status_code, 409)
        self.repo.restore_workspace_domain(account.domain)
        self.assertEqual(self.client.post(f'/api/accounts/{account.id}/draft', json={}).status_code, 200)

    def test_suppression_added_during_fetch_discards_late_refresh(self):
        campaign = self.repo.create_campaign('Manual race', 'manual', ['https://company.com/'])
        page = Page('https://company.com/', 'Company', 'Sales workflow', 'B2B SaaS workflow for VP Sales')
        self.client.app.state.fetch_page = lambda _: page
        self.client.post(f'/api/campaigns/{campaign.id}/research', json={})
        account = self.repo.accounts(campaign.id)[0]
        before = account.researched_at
        def suppress_then_return(_):
            self.repo.set_account_status(account.id, 'dismissed', suppress_workspace=True)
            return page
        self.client.app.state.fetch_page = suppress_then_return
        self.client.post(f'/api/campaigns/{campaign.id}/research', json={})
        self.assertEqual(self.repo.account(account.id).researched_at, before)
        self.assertTrue(self.repo.account(account.id).suppress_workspace)

    def test_status_only_changes_and_undo_preserve_another_campaign_exclusion(self):
        second = self.repo.create_campaign('Existing second campaign', 'demo', [])
        self.repo.save_research(second.id, demo_accounts(DEMO_PROFILE, second.id), [])
        other = next(a for a in self.repo.accounts(second.id) if a.domain == self.account.domain)
        self.repo.set_account_status(self.account.id, 'dismissed', suppress_workspace=True)
        for status in ['new', 'shortlisted', 'dismissed', 'new']:
            response = self.client.patch(f'/api/accounts/{other.id}', json={'status': status})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['status'], status)
            self.assertTrue(response.json()['suppress_workspace'])
            self.assertTrue(self.repo.is_workspace_suppressed(other.domain))
        foreign = Repository(self.path, 'foreign-tenant')
        foreign.save_profile(DEMO_PROFILE)
        third = foreign.create_campaign('Foreign campaign', 'demo', [])
        foreign.save_research(third.id, demo_accounts(DEMO_PROFILE, third.id), [])
        foreign_account = next(a for a in foreign.accounts(third.id) if a.domain == other.domain)
        self.assertFalse(foreign.set_account_status(foreign_account.id, 'shortlisted', suppress_workspace=False).suppress_workspace)
        self.assertTrue(self.repo.is_workspace_suppressed(other.domain))
        restored = self.client.patch(f'/api/accounts/{other.id}', json={'status': 'shortlisted', 'suppress_workspace': False})
        self.assertEqual(restored.status_code, 200)
        self.assertFalse(restored.json()['suppress_workspace'])
        self.assertFalse(self.repo.is_workspace_suppressed(other.domain))
        # Status changes cannot create scope either, after an explicit restoration.
        self.assertFalse(self.client.patch(f'/api/accounts/{other.id}', json={'status': 'new'}).json()['suppress_workspace'])

    def test_undo_can_preserve_an_existing_workspace_suppression_without_creating_one(self):
        second = self.repo.create_campaign('Pre-existing campaign', 'demo', [])
        self.repo.save_research(second.id, demo_accounts(DEMO_PROFILE, second.id), [])
        other = next(a for a in self.repo.accounts(second.id) if a.domain == self.account.domain)
        self.repo.set_account_status(self.account.id, 'dismissed', suppress_workspace=True)
        self.repo.set_account_status(other.id, 'dismissed', suppress_workspace=True)
        restored = self.client.patch(f'/api/accounts/{other.id}', json={
            'status': 'new', 'reason': None, 'preserve_workspace_suppression': True})
        self.assertEqual(restored.status_code, 200)
        self.assertEqual(restored.json()['status'], 'new')
        self.assertTrue(restored.json()['suppress_workspace'])
        self.assertTrue(self.repo.is_workspace_suppressed(other.domain))
        for extra in [{'suppress_workspace': True}, {'suppress_workspace': False}, {'reason': 'other'}, {'status': 'dismissed'}]:
            self.assertEqual(self.client.patch(f'/api/accounts/{other.id}', json={
                'status': 'new', 'preserve_workspace_suppression': True, **extra}).status_code, 422)
        self.repo.restore_workspace_domain(other.domain)
        restored = self.client.patch(f'/api/accounts/{other.id}', json={
            'status': 'shortlisted', 'preserve_workspace_suppression': True})
        self.assertEqual(restored.status_code, 200)
        self.assertFalse(restored.json()['suppress_workspace'])

    def test_legacy_pass_cannot_refresh_through_www_alias_at_save(self):
        legacy = self.account.model_copy(update={'status': 'dismissed'})
        with self.repo.connect() as db:
            db.execute('UPDATE accounts SET data=? WHERE tenant_id=? AND id=?',
                (legacy.model_dump_json(), 'local-demo', legacy.id))
        incoming = legacy.model_copy(update={'id': 'new_alias', 'domain': 'www.' + legacy.domain, 'status': 'new'})
        self.repo.save_research(self.campaign.id, [incoming], [])
        self.assertNotIn(incoming.domain, [a.domain for a in self.repo.accounts(self.campaign.id)])
        self.assertEqual(self.repo.account(legacy.id).status, 'dismissed')

    def test_validation_and_bounded_listing(self):
        for reason in ['unknown', '', 42, {'wrong_industry': True}]:
            self.assertEqual(self.review(status='dismissed', reason=reason).status_code, 422)
        for status in ['new', 'shortlisted']:
            self.assertEqual(self.review(status=status, reason='other').status_code, 422)
            self.assertEqual(self.review(status=status, suppress_workspace=True).status_code, 422)
        for value in ['true', 1, None]:
            self.assertEqual(self.review(status='dismissed', suppress_workspace=value).status_code, 422)
        for limit in [0, 101, -1]:
            self.assertEqual(self.client.get(f'/api/workspace/suppressions?limit={limit}').status_code, 422)
        self.assertEqual(self.client.post('/api/workspace/suppressions/restore', json={'domain': 'https://evil.com/path'}).status_code, 422)
        self.assertEqual(self.review(status='dismissed', reason=None).status_code, 200)
