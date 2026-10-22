"""Fictional publication attestations, never independent verification."""
import json
import unittest
from tests import test_outreach as fixtures
from fastapi.testclient import TestClient
from app.main import create_app
from app.outreach import ContactBasis, ContactBasisRequest, RevisionRequest, OutreachError, PasteReply


class ContactBasisTest(unittest.TestCase):
    setUp = fixtures.OutreachTest.setUp
    key = fixtures.OutreachTest.key
    start = fixtures.OutreachTest.start
    fields = fixtures.OutreachTest.fields
    edit = fixtures.OutreachTest.edit
    sender = fixtures.OutreachTest.sender
    basis = fixtures.OutreachTest.basis
    ready = fixtures.OutreachTest.ready

    def unreviewed(self):
        self.sender()
        thread = self.edit(self.start(), recipient='hello@business.com', subject='Hello', body='Relevant question')
        return self.edit(thread, body=thread.body + thread.sender_footer)

    def test_legacy_without_basis_denies_approval(self):
        thread = self.unreviewed()
        with self.assertRaisesRegex(OutreachError, 'basis'):
            self.repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**self.fields(thread)))

    def test_publication_http_mutation_admits_matching_reviewed_evidence(self):
        thread = self.basis(self.unreviewed())
        payload = {**self.fields(thread), 'contact_basis': thread.contact_basis.model_dump()}
        with TestClient(create_app(self.path, testing=True)) as client:
            response = client.put(f'/api/outreach/{thread.id}/contact-basis', json=payload)
            self.assertEqual(response.status_code, 200, response.text)
        current = self.repo.outreach_thread(thread.id)
        approved = self.repo.mutate_outreach(current.id, 'approve', RevisionRequest(**self.fields(current)))
        self.assertTrue(approved.ready_for_manual_action)
        self.assertEqual(approved.recipient_status, 'user_entered')

    def test_each_unreviewed_or_contradictory_field_denies(self):
        for change in ({'published_email': 'other@business.com'}, {'source_url': ''}, {'captured_at': ''},
                       {'publisher_attribution': 'third_party'}, {'publisher_attribution': 'unknown'},
                       {'notice_status': 'prohibits'}, {'notice_status': 'unknown'}, {'recipient_role': ''},
                       {'message_relevance': ''}, {'recipient_country': 'unknown'}, {'recipient_country': 'other'}):
            with self.subTest(change=change):
                thread = self.basis(self.unreviewed(), **change)
                with self.assertRaisesRegex(OutreachError, 'basis'):
                    self.repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**self.fields(thread)))
                self.assertFalse(self.repo.outreach_thread(thread.id).ready_for_manual_action)
        for country in ('US', 'CA'):
            thread = self.basis(self.unreviewed(), recipient_country=country, publisher_attribution='caused_by_recipient')
            self.assertTrue(self.repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**self.fields(thread))).ready_for_manual_action)

    def test_invalid_source_dates_and_timezone_rejected(self):
        valid = self.basis(self.unreviewed()).contact_basis.model_dump()
        for change in ({'source_url': 'https://user:pass@business.com'}, {'source_url': 'http://127.0.0.1/'},
                       {'source_url': 'javascript:alert(1)'}, {'captured_at': '2026-01-01T12:00:00'},
                       {'captured_at': '2999-01-01T12:00:00Z'}, {'recipient_timezone': 'Not/AZone'}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                ContactBasis.model_validate({**valid, **change})

    def test_edit_invalidation_hash_binding_and_immutable_sent_history(self):
        approved = self.ready()
        old_hash = approved.approval.content_hash
        edited = self.basis(approved, message_relevance='New message-specific operations question')
        self.assertIsNone(edited.approval)
        approved = self.repo.mutate_outreach(edited.id, 'approve', RevisionRequest(**self.fields(edited)))
        self.assertNotEqual(approved.approval.content_hash, old_hash)
        sent = self.repo.mutate_outreach(approved.id, 'sent', RevisionRequest(**self.fields(approved)))
        snapshot = sent.messages[-1].model_dump()
        changed = self.edit(sent, recipient='other@business.com')
        self.assertIsNone(changed.contact_basis)
        self.assertFalse(changed.ready_for_manual_action)
        self.assertEqual(changed.messages[-1].model_dump(), snapshot)

    def test_old_hash_and_absent_basis_fail_closed_without_rewriting_history(self):
        thread = self.ready()
        with self.repo.connect() as db:
            data = thread.model_dump()
            data.pop('contact_basis')
            data['approval']['content_hash'] = 'historical-v0-hash'
            db.execute('UPDATE outreach_threads SET data=? WHERE id=?', (json.dumps(data), thread.id))
        current = self.repo.outreach_thread(thread.id)
        self.assertIsNone(current.approval)
        self.assertFalse(current.ready_for_manual_action)
        with self.repo.connect() as db:
            stored = json.loads(db.execute('SELECT data FROM outreach_threads WHERE id=?', (thread.id,)).fetchone()['data'])
        self.assertEqual(stored['approval']['content_hash'], 'historical-v0-hash')

    def test_replay_bound_to_payload_returns_current_suppression_and_recipient_state(self):
        thread = self.basis(self.unreviewed())
        body = ContactBasisRequest(**self.fields(thread), contact_basis=thread.contact_basis)
        saved = self.repo.mutate_outreach(thread.id, 'contact-basis', body)
        changed = self.edit(saved, recipient='other@business.com')
        replay = self.repo.mutate_outreach(thread.id, 'contact-basis', body)
        self.assertEqual(replay.revision, changed.revision)
        self.assertIsNone(replay.contact_basis)
        suppressed = self.repo.mutate_outreach(changed.id, 'reply', PasteReply(**self.fields(changed), body='Unsubscribe', reply_state='opt_out'))
        self.assertTrue(self.repo.mutate_outreach(thread.id, 'contact-basis', body).suppressed)
        with self.assertRaises(OutreachError):
            self.repo.mutate_outreach(thread.id, 'contact-basis', body.model_copy(update={'contact_basis': None}))
        with self.assertRaises(OutreachError):
            self.repo.mutate_outreach(thread.id, 'contact-basis', ContactBasisRequest(**self.fields(saved), contact_basis=None))
        from app.store import Repository
        other = Repository(self.path, tenant_id='foreign_fixture')
        with self.assertRaises(OutreachError):
            other.mutate_outreach(suppressed.id, 'contact-basis', body)
