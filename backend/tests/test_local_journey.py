"""Fictional SQLite/API controls for the manual day-two journey; no providers."""
import unittest
from fastapi.testclient import TestClient
from tests import test_outreach as fixtures
from app.main import create_app
from app.outreach import PasteReply, CorrectReply


class LocalJourneyTest(unittest.TestCase):
    setUp = fixtures.OutreachTest.setUp
    key = fixtures.OutreachTest.key
    start = fixtures.OutreachTest.start
    fields = fixtures.OutreachTest.fields
    edit = fixtures.OutreachTest.edit
    ready = fixtures.OutreachTest.ready
    basis = fixtures.OutreachTest.basis
    sender = fixtures.OutreachTest.sender
    sibling = fixtures.OutreachTest.sibling

    def referral_parent(self):
        thread = self.ready()
        return self.repo.mutate_outreach(thread.id, 'reply', PasteReply(
            **self.fields(thread), body='Please contact Jordan in our operations team.', reply_state='referral'))

    def referral_body(self, parent):
        return dict(**self.fields(parent), recipient='jordan@business.com', contact_name='Jordan Fixture',
                    referrer_name='Original Contact Fixture', referrer_message_id=parent.messages[-1].id)

    def test_referral_is_fresh_contact_with_credit_basis_and_idempotency(self):
        parent = self.referral_parent()
        original_message = parent.messages[-1].model_dump()
        body = self.referral_body(parent)
        with TestClient(create_app(self.path, testing=True)) as client:
            response = client.post(f'/api/outreach/{parent.id}/referrals', json=body)
            self.assertEqual(response.status_code, 200, response.text)
            child = response.json()
            self.assertNotEqual(child['id'], parent.id)
            self.assertEqual(child['referrer_thread_id'], parent.id)
            self.assertEqual(child['referrer_message_id'], original_message['id'])
            self.assertEqual(child['referrer_name'], body['referrer_name'])
            self.assertEqual(child['recipient'], body['recipient'])
            self.assertEqual(child['recipient_status'], 'user_entered')
            self.assertIsNone(child['contact_basis'])
            self.assertIsNone(child['approval'])
            self.assertFalse(child['ready_for_manual_action'])
            self.assertEqual(client.post(f'/api/outreach/{parent.id}/referrals', json=body).json()['id'], child['id'])
            listed = client.get('/api/outreach', params={'search_id': parent.search_id}).json()['threads']
            self.assertEqual({t['id'] for t in listed}, {parent.id, child['id']})
        saved_parent = self.repo.outreach_thread(parent.id)
        self.assertEqual(saved_parent.messages[-1].model_dump(), original_message)
        self.assertNotEqual(saved_parent.recipient, child['recipient'])

    def test_referral_requires_current_referral_and_rejects_original_address(self):
        parent = self.referral_parent()
        body = self.referral_body(parent)
        with TestClient(create_app(self.path, testing=True)) as client:
            bad = {**body, 'recipient': parent.recipient}
            self.assertEqual(client.post(f'/api/outreach/{parent.id}/referrals', json=bad).status_code, 409)
            bad = {**body, 'referrer_message_id': 'unrelated_message'}
            self.assertEqual(client.post(f'/api/outreach/{parent.id}/referrals', json=bad).status_code, 409)
            parent = self.repo.mutate_outreach(parent.id, 'reply-state', CorrectReply(**self.fields(parent), reply_state='opt_out'))
            bad = {**self.referral_body(parent)}
            self.assertEqual(client.post(f'/api/outreach/{parent.id}/referrals', json=bad).status_code, 409)
        self.assertEqual(len(self.repo.outreach_threads(parent.search_id)['threads']), 1)

    def test_duplicate_referral_address_never_creates_duplicate_contact(self):
        parent = self.referral_parent()
        with TestClient(create_app(self.path, testing=True)) as client:
            body = self.referral_body(parent)
            first = client.post(f'/api/outreach/{parent.id}/referrals', json=body)
            self.assertEqual(first.status_code, 200, first.text)
            parent = self.repo.outreach_thread(parent.id)
            duplicate = client.post(f'/api/outreach/{parent.id}/referrals', json=self.referral_body(parent))
            self.assertEqual(duplicate.status_code, 409)
        self.assertEqual(len(self.repo.outreach_threads(parent.search_id)['threads']), 2)


if __name__ == '__main__':
    unittest.main()
