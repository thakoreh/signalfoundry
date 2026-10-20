"""Persistent local conversation workflow. No transport or provider calls."""
import os
from pathlib import Path
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.customers import qualify_customer
from app.fixtures import DEMO_PROFILE
from app.main import create_app
from app.outreach import (CorrectReply, EditDraft, OutreachError, OutcomesRequest, PasteReply,
                          PauseRequest, RevisionRequest, StartOutreach)
from app.safety import Page
from app.store import Repository


class OutreachTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'workspace.sqlite3'
        self.repo = Repository(self.path)
        self.repo.save_profile(DEMO_PROFILE)
        self.search, _ = self.repo.create_customer_search('search_request', 'Property management')
        self.account = qualify_customer(DEMO_PROFILE,
            Page('https://business.com/', 'Business Property Management', 'Property management services.', 'Property management services for businesses.'),
            target='property management', geography='', search_id=self.search.id)
        self.search.accounts, self.search.status = [self.account], 'complete'
        self.repo.save_customer_search(self.search)
        self.key_index = 0

    def key(self):
        self.key_index += 1
        return f'outreach_request_{self.key_index}'

    def start(self):
        return self.repo.start_outreach(StartOutreach(search_id=self.search.id, account_ids=[self.account.id], idempotency_key=self.key()))['threads'][0]

    def fields(self, thread):
        return {'expected_revision': thread.revision, 'idempotency_key': self.key()}

    def edit(self, thread, **changes):
        fields = {name: getattr(thread, name) for name in ('recipient', 'subject', 'body', 'booking_link')}
        fields.update(changes)
        return self.repo.mutate_outreach(thread.id, 'draft', EditDraft(**self.fields(thread), **fields))

    def ready(self):
        # Approval fixtures now explicitly provide a fictional saved sender.
        self.sender()
        thread = self.edit(self.start(), recipient='hello@business.com', subject='A relevant introduction', body='Hello, could we discuss a possible fit?')
        thread = self.edit(thread, body=thread.body + thread.sender_footer)
        if thread.messages and thread.reply_state not in ('interested', 'question'):
            thread = self.repo.mutate_outreach(thread.id, 'reply-state', CorrectReply(**self.fields(thread), reply_state='interested'))
        thread = self.basis(thread)
        return self.repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**self.fields(thread)))

    def basis(self, thread, **changes):
        from app.outreach import ContactBasis, ContactBasisRequest
        evidence = dict(version=1, published_email=thread.recipient, source_url='https://business.com/contact',
                        captured_at='2026-01-01T12:00:00Z', publisher_attribution='recipient', notice_status='clear',
                        recipient_role='Operations team', message_relevance='Question about their property operations',
                        recipient_country='CA', basis_type='conspicuous_publication')
        evidence.update(changes)
        return self.repo.mutate_outreach(thread.id, 'contact-basis', ContactBasisRequest(
            **self.fields(thread), contact_basis=ContactBasis(**evidence)))

    def sender(self):
        profile = DEMO_PROFILE.model_copy(update={'sender_name': 'Alex Fixture',
            'mailing_address': '100 Example Street, Toronto ON M5V 1A1', 'sender_contact': 'alex@example.com'})
        self.repo.save_profile(profile)
        return profile

    def test_footer_is_exact_and_sender_change_invalidates_without_rewriting_history(self):
        profile = self.sender()
        footer = '\n\n--\nAlex Fixture | ' + profile.company_name + '\n100 Example Street, Toronto ON M5V 1A1\nContact: alex@example.com\nTo opt out, reply "unsubscribe".'
        thread = self.edit(self.start(), recipient='hello@business.com', subject='Hello', body='Can we talk?')
        self.assertEqual(thread.sender_footer, footer)
        with self.assertRaisesRegex(OutreachError, 'footer'):
            self.repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**self.fields(thread)))
        thread = self.edit(thread, body='Can we talk?' + footer)
        thread = self.basis(thread)
        approved = self.repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**self.fields(thread)))
        self.assertTrue(approved.ready_for_manual_action)
        tampered = self.edit(approved, body=approved.body.replace('unsubscribe', 'subscribe'))
        with self.assertRaisesRegex(OutreachError, 'footer'):
            self.repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**self.fields(tampered)))
        thread = self.edit(tampered, body=approved.body)
        thread = self.repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**self.fields(thread)))
        sent = self.repo.mutate_outreach(thread.id, 'sent', RevisionRequest(**self.fields(thread)))
        snapshot = sent.messages[0].model_dump()
        pending = self.edit(sent, body='Another message' + footer)
        pending = self.repo.mutate_outreach(pending.id, 'approve', RevisionRequest(**self.fields(pending)))
        self.repo.save_profile(profile.model_copy(update={'sender_name': 'Another Fixture'}))
        current = self.repo.outreach_thread(pending.id)
        self.assertFalse(current.ready_for_manual_action)
        self.assertIsNone(current.approval)
        self.assertEqual(current.messages[0].model_dump(), snapshot)
        with self.assertRaises(OutreachError):
            self.repo.mutate_outreach(current.id, 'sent', RevisionRequest(**self.fields(current)))

    def test_missing_address_and_unreachable_contact_block_approval(self):
        for change in ({'mailing_address': ''}, {'sender_contact': 'not reachable'}):
            profile = self.sender().model_copy(update=change)
            self.repo.save_profile(profile)
            thread = self.edit(self.start(), recipient='hello@business.com', subject='Hello', body='Can we talk?')
            thread = self.edit(thread, body=thread.body + thread.sender_footer)
            with self.assertRaisesRegex(OutreachError, 'sender|contact'):
                self.repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**self.fields(thread)))

    def test_sender_contact_rejects_malformed_email_domains(self):
        for contact in ('alex@-example.com', 'alex@example..com', 'alex@exa_mple.com', '.alex@example.com', 'alex..fixture@example.com'):
            with self.subTest(contact=contact):
                self.repo.save_profile(self.sender().model_copy(update={'sender_contact': contact}))
                self.assertEqual(self.start().sender_footer, '')

    def test_cold_calendar_urls_without_slash_are_denied_in_subject_or_body(self):
        for field, value in (('body', 'See https://calendly.com'), ('subject', 'Meet https://cal.com?user=fixture')):
            with self.subTest(field=field):
                thread = self.ready()
                changes = {field: value + (thread.sender_footer if field == 'body' else '')}
                thread = self.edit(thread, **changes)
                with self.assertRaisesRegex(OutreachError, 'booking'):
                    self.repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**self.fields(thread)))

    def test_cold_booking_link_is_denied_but_interested_reply_can_include_it(self):
        thread = self.ready()
        thread = self.edit(thread, booking_link='https://calendar.business.com/book')
        with self.assertRaisesRegex(OutreachError, 'booking'):
            self.repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**self.fields(thread)))
        thread = self.repo.mutate_outreach(thread.id, 'reply', PasteReply(**self.fields(thread), body='Interested', reply_state='interested'))
        thread = self.edit(thread, body='Here is the requested link.' + thread.sender_footer)
        thread = self.repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**self.fields(thread)))
        self.assertTrue(thread.ready_for_manual_action)

    def test_missing_sender_blocks_approval_without_hiding_old_thread(self):
        thread = self.edit(self.start(), recipient='hello@business.com', subject='Hello', body='Can we talk?')
        self.assertEqual(self.repo.outreach_thread(thread.id).body, 'Can we talk?')
        with self.assertRaisesRegex(OutreachError, 'sender'):
            self.repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**self.fields(thread)))

    def test_sent_with_changes_preserves_approved_and_actual_snapshots(self):
        thread = self.ready()
        approved_body = thread.body
        approved_hash = thread.approval.content_hash
        with TestClient(create_app(self.path, testing=True)) as client:
            response = client.post(f'/api/outreach/{thread.id}/sent', json={
                **self.fields(thread), 'sent_as': 'with_changes', 'actual_subject': 'Actually sent subject',
                'actual_body': 'Actually sent text'})
        self.assertEqual(response.status_code, 200, response.text)
        thread = self.repo.outreach_thread(thread.id)
        message = thread.messages[-1]
        self.assertEqual(message.body, 'Actually sent text')
        self.assertEqual(message.subject, 'Actually sent subject')
        self.assertEqual(message.approved_body, approved_body)
        self.assertEqual(message.approved_content_hash, approved_hash)
        self.assertEqual(message.sent_as, 'with_changes')
        self.assertIsNone(thread.approval)
        self.assertEqual(Repository(self.path).outreach_thread(thread.id).messages[-1], message)

    def test_changed_sent_http_retry_binds_mode_and_actual_text(self):
        thread = self.ready()
        payload = {**self.fields(thread), 'sent_as': 'with_changes',
                   'actual_subject': 'Actual subject', 'actual_body': 'Actual body'}
        with TestClient(create_app(self.path, testing=True)) as client:
            url = f'/api/outreach/{thread.id}/sent'
            first = client.post(url, json=payload)
            self.assertEqual(first.status_code, 200, first.text)
            replay = client.post(url, json=payload)
            self.assertEqual(replay.status_code, 200, replay.text)
            self.assertEqual(replay.json(), first.json())
            for changes in ({'actual_subject': 'Other subject'}, {'actual_body': 'Other body'},
                            {'sent_as': 'approved', 'actual_subject': '', 'actual_body': ''}):
                conflict = client.post(url, json={**payload, **changes})
                self.assertEqual(conflict.status_code, 409, conflict.text)
            self.assertEqual(len(self.repo.outreach_thread(thread.id).messages), 1)

    def test_legacy_sent_http_retry_returns_current_state_without_duplicate_events(self):
        thread = self.ready()
        legacy = RevisionRequest(**self.fields(thread))
        sent = self.repo.mutate_outreach(thread.id, 'sent', legacy)
        with TestClient(create_app(self.path, testing=True)) as client:
            url = f'/api/outreach/{thread.id}/sent'
            for payload in (legacy.model_dump(), {**legacy.model_dump(), 'sent_as': 'approved'}):
                response = client.post(url, json=payload)
                self.assertEqual(response.status_code, 200, response.text)
                self.assertEqual(response.json(), sent.model_dump())
            for changes in ({'sent_as': 'with_changes', 'actual_subject': 'Changed', 'actual_body': 'Changed'},
                            {'actual_subject': 'Changed'}, {'actual_body': 'Changed'},
                            {'expected_revision': legacy.expected_revision + 1}):
                response = client.post(url, json={**legacy.model_dump(), **changes})
                self.assertEqual(response.status_code, 409, response.text)
            self.assertEqual(len(self.repo.outreach_thread(thread.id).messages), 1)
            suppressed = self.repo.mutate_outreach(sent.id, 'reply', PasteReply(
                **self.fields(sent), body='Unsubscribe me', reply_state='opt_out'))
            replay = client.post(url, json=legacy.model_dump())
            self.assertEqual(replay.status_code, 200, replay.text)
            self.assertEqual(replay.json(), suppressed.model_dump())
            self.assertTrue(replay.json()['suppressed'])
            self.assertFalse(replay.json()['ready_for_manual_action'])
            self.assertEqual(len(replay.json()['messages']), 2)

    def test_create_reopens_same_eligible_customers_and_survives_repository_restart(self):
        first = self.start()
        self.assertEqual(first.id, self.start().id)
        self.assertFalse(first.ready_for_manual_action)
        reloaded = Repository(self.path).outreach_threads(self.search.id)['threads']
        self.assertEqual([t.id for t in reloaded], [first.id])
        self.assertEqual(Repository(self.path).outreach_thread(first.id), first)

    def test_create_rejects_weak_or_foreign_selection_atomically_and_binds_request_key(self):
        with self.assertRaises(OutreachError):
            self.repo.start_outreach(StartOutreach(search_id=self.search.id, account_ids=[self.account.id, 'unknown_account'], idempotency_key=self.key()))
        self.assertEqual(self.repo.outreach_threads()['threads'], [])
        self.search.accounts[0].score_breakdown = []
        self.repo.save_customer_search(self.search)
        with self.assertRaises(OutreachError):
            self.start()
        self.assertEqual(self.repo.outreach_threads()['threads'], [])

    def test_idempotency_key_cannot_be_reused_for_another_edit(self):
        thread = self.start()
        key = self.key()
        first = EditDraft(expected_revision=thread.revision, idempotency_key=key, recipient='hello@business.com', subject='Subject', body='First content')
        self.repo.mutate_outreach(thread.id, 'draft', first)
        with self.assertRaisesRegex(OutreachError, 'different changes'):
            self.repo.mutate_outreach(thread.id, 'draft', first.model_copy(update={'body': 'Other content'}))

    def test_approval_is_exact_and_each_content_field_invalidates_it(self):
        for changes in ({'recipient': 'other@business.com'}, {'subject': 'Changed subject'}, {'body': 'Changed message'}, {'booking_link': 'https://calendar.business.com/book'}):
            thread = self.ready()
            self.assertTrue(thread.ready_for_manual_action)
            updated = self.edit(thread, **changes)
            self.assertIsNone(updated.approval)
            self.assertFalse(updated.ready_for_manual_action)
            with self.assertRaises(OutreachError):
                self.repo.mutate_outreach(updated.id, 'sent', RevisionRequest(**self.fields(updated)))

    def test_idempotency_replay_does_not_repeat_events_and_returns_current_suppressed_state(self):
        thread = self.ready()
        body = RevisionRequest(**self.fields(thread))
        sent = self.repo.mutate_outreach(thread.id, 'sent', body)
        self.assertEqual(len(sent.messages), 1)
        self.assertEqual(sent.messages[0].source, 'user_reported')
        self.assertEqual(sent.messages[0].body, thread.body)
        self.assertEqual(sent.body, '')
        self.assertEqual(self.repo.mutate_outreach(thread.id, 'sent', body), sent)
        reply = self.repo.mutate_outreach(sent.id, 'reply', PasteReply(**self.fields(sent), body='Unsubscribe me', reply_state='interested'))
        self.assertEqual(reply.reply_state, 'opt_out')
        replay = self.repo.mutate_outreach(thread.id, 'sent', body)
        self.assertTrue(replay.suppressed)
        self.assertFalse(replay.ready_for_manual_action)
        self.assertEqual(len(replay.messages), 2)
        with self.assertRaises(OutreachError):
            self.repo.mutate_outreach(thread.id, 'approve', body)

    def test_stale_revision_prevents_overwriting_or_approving_unseen_changes(self):
        thread = self.ready()
        self.edit(thread, body='A newer version')
        with self.assertRaisesRegex(OutreachError, 'changed'):
            self.repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**self.fields(thread)))

    def test_pause_and_negative_or_uncertain_reply_states_block_approval(self):
        for state in ('awaiting_review', 'not_now', 'not_interested', 'uncertain'):
            thread = self.ready()
            thread = self.repo.mutate_outreach(thread.id, 'reply', PasteReply(**self.fields(thread), body='A pasted response', reply_state=state))
            thread = self.edit(thread, body='Human-written response')
            with self.assertRaises(OutreachError):
                self.repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**self.fields(thread)))
        thread = self.ready()
        thread = self.repo.mutate_outreach(thread.id, 'pause', PauseRequest(**self.fields(thread), paused=True))
        self.assertIsNone(thread.approval)
        with self.assertRaises(OutreachError):
            self.repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**self.fields(thread)))

    def test_classification_correction_allows_manual_response_but_opt_out_is_sticky(self):
        thread = self.ready()
        thread = self.repo.mutate_outreach(thread.id, 'reply', PasteReply(**self.fields(thread), body='Can you explain more?', reply_state='uncertain'))
        self.assertEqual(thread.body, '')
        thread = self.repo.mutate_outreach(thread.id, 'reply-state', CorrectReply(**self.fields(thread), reply_state='question'))
        self.assertEqual(thread.messages[-1].reply_state, 'question')
        thread = self.edit(thread, body='An answer written by the user')
        thread = self.edit(thread, body=thread.body + thread.sender_footer)
        thread = self.repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**self.fields(thread)))
        self.assertTrue(thread.ready_for_manual_action)
        thread = self.repo.mutate_outreach(thread.id, 'reply', PasteReply(**self.fields(thread), body='Please remove me', reply_state='opt_out'))
        thread = self.repo.mutate_outreach(thread.id, 'reply-state', CorrectReply(**self.fields(thread), reply_state='interested'))
        thread = self.edit(thread, recipient='another@business.com', body='Another response')
        self.assertTrue(thread.suppressed)
        with self.assertRaises(OutreachError):
            self.repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**self.fields(thread)))

    def test_opt_out_suppression_survives_new_search_and_is_tenant_scoped(self):
        thread = self.ready()
        self.repo.mutate_outreach(thread.id, 'reply', PasteReply(**self.fields(thread), body='Stop emailing us', reply_state='opt_out'))
        search = self.search.model_copy(deep=True)
        search.id = 'another_saved_search'
        with self.repo.connect() as db:
            db.execute('INSERT INTO customer_searches VALUES (?,?,?,?,?)', (self.repo.tenant_id, search.id, 'second_search', search.created_at, search.model_dump_json()))
        reopened = self.repo.start_outreach(StartOutreach(search_id=search.id, account_ids=[self.account.id], idempotency_key=self.key()))['threads'][0]
        self.assertTrue(reopened.suppressed)
        other = Repository(self.path, tenant_id='other')
        with self.assertRaises(OutreachError):
            other.outreach_thread(thread.id)
        self.assertEqual(other.outreach_threads()['threads'], [])
        with self.assertRaises(OutreachError):
            other.start_outreach(StartOutreach(search_id=self.search.id, account_ids=[self.account.id], idempotency_key=self.key()))
        with self.assertRaises(OutreachError):
            other.mutate_outreach(thread.id, 'approve', RevisionRequest(expected_revision=thread.revision, idempotency_key=self.key()))

    def test_booking_link_alone_is_not_a_booking_or_attendance_or_sale(self):
        thread = self.edit(self.start(), booking_link='https://cal.business.com/intro')
        self.assertEqual(thread.meeting_state, 'not_recorded')
        self.assertEqual(thread.sale_state, 'not_recorded')
        with self.assertRaises(OutreachError):
            self.repo.mutate_outreach(thread.id, 'outcomes', OutcomesRequest(**self.fields(thread), meeting_state='attended_reported', sale_state='not_recorded'))
        thread = self.repo.mutate_outreach(thread.id, 'outcomes', OutcomesRequest(**self.fields(thread), meeting_state='booked_reported', sale_state='not_recorded'))
        thread = self.repo.mutate_outreach(thread.id, 'outcomes', OutcomesRequest(**self.fields(thread), meeting_state='attended_reported', sale_state='won_reported'))
        self.assertEqual(thread.meeting_state, 'attended_reported')
        self.assertEqual(thread.sale_state, 'won_reported')

    def test_sent_snapshot_preserves_exact_approved_link_after_later_edits(self):
        self.sender()
        # Booking invitations require an explicitly reported interested reply.
        thread = self.start()
        self.repo.mutate_outreach(thread.id, 'reply', PasteReply(**self.fields(thread), body='Interested, can we meet?', reply_state='interested'))
        thread = self.edit(self.start(), recipient='hello@business.com', subject='Meeting', body='Would a meeting help?', booking_link='https://cal.business.com/intro')
        thread = self.edit(thread, body=thread.body + thread.sender_footer)
        thread = self.basis(thread)
        thread = self.repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**self.fields(thread)))
        sent = self.repo.mutate_outreach(thread.id, 'sent', RevisionRequest(**self.fields(thread)))
        changed = self.edit(sent, booking_link='https://cal.business.com/different')
        self.assertEqual(changed.messages[-1].booking_link, 'https://cal.business.com/intro')
        self.assertEqual(changed.messages[-1].body, 'Would a meeting help?' + thread.sender_footer + '\n\nBooking link: https://cal.business.com/intro')
        self.assertIsNotNone(changed.messages[-1].approved_content_hash)

    def test_opt_out_classification_suppresses_original_inbound_recipient_after_edit(self):
        thread = self.ready()
        thread = self.repo.mutate_outreach(thread.id, 'reply', PasteReply(**self.fields(thread), body='No more messages', reply_state='awaiting_review'))
        thread = self.edit(thread, recipient='changed@business.com')
        self.repo.mutate_outreach(thread.id, 'reply-state', CorrectReply(**self.fields(thread), reply_state='opt_out'))
        with self.repo.connect() as db:
            targets = [row['target'] for row in db.execute('SELECT target FROM outreach_suppressions WHERE tenant_id=?', (self.repo.tenant_id,)).fetchall()]
        self.assertIn('email:hello@business.com', targets)
        self.assertIn('email:changed@business.com', targets)

    def test_concurrent_approval_and_edit_are_serialized_by_revision(self):
        self.sender()
        thread = self.edit(self.start(), recipient='hello@business.com', subject='Subject', body='Body')
        thread = self.edit(thread, body=thread.body + thread.sender_footer)
        def change(which):
            try:
                if which == 'approve':
                    self.repo.mutate_outreach(thread.id, which, RevisionRequest(expected_revision=thread.revision, idempotency_key='concurrent_approve'))
                else:
                    self.repo.mutate_outreach(thread.id, 'draft', EditDraft(expected_revision=thread.revision, idempotency_key='concurrent_edit', recipient=thread.recipient, subject=thread.subject, body='Changed', booking_link=''))
                return True
            except OutreachError:
                return False
        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(sum(pool.map(change, ['approve', 'edit'])), 1)

    def test_api_is_closed_and_public_preview_blocks_reads_and_writes(self):
        app = create_app(self.path, testing=True)
        with TestClient(app) as client, patch('app.customer_drafts.generate_customer_draft', side_effect=AssertionError('No provider calls')):
            response = client.post('/api/outreach', json={'search_id': self.search.id, 'account_ids': [self.account.id], 'idempotency_key': 'api_create_123'})
            self.assertEqual(response.status_code, 200, response.text)
            thread = response.json()['threads'][0]
            self.assertEqual(client.get('/api/outreach', params={'search_id': self.search.id}).json()['threads'][0]['id'], thread['id'])
            self.assertEqual(client.post(f"/api/outreach/{thread['id']}/reply-draft", json={}).status_code, 503)
            self.assertEqual(client.post('/api/outreach', json={'search_id': self.search.id, 'account_ids': [self.account.id], 'idempotency_key': self.key(), 'tenant_id': 'other'}).status_code, 422)
            self.assertEqual(client.put(f"/api/outreach/{thread['id']}/draft", json={'expected_revision': 1, 'idempotency_key': 'bad_address_123', 'recipient': 'bad\nBcc:another@business.com', 'subject': '', 'body': ''}).status_code, 422)
        with patch.dict(os.environ, {'SIGNALFOUNDRY_PUBLIC_ACCESS': 'true'}), TestClient(create_app(self.path, testing=True)) as client:
            self.assertEqual(client.get('/api/outreach').status_code, 403)
            self.assertEqual(client.get(f"/api/outreach/{thread['id']}").status_code, 403)
            self.assertEqual(client.post('/api/outreach', json={'search_id': self.search.id, 'account_ids': [self.account.id], 'idempotency_key': 'public_start_123'}).status_code, 403)


if __name__ == '__main__':
    unittest.main()
