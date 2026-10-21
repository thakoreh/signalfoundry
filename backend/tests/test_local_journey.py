"""Fictional SQLite/API controls for the manual day-two journey; no providers."""
import unittest
from datetime import datetime, timezone
from unittest.mock import patch
from fastapi.testclient import TestClient
from tests import test_outreach as fixtures
from app.main import create_app
from app.outreach import PasteReply, CorrectReply, RevisionRequest, SentRequest, OutreachError, OutcomesRequest


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
        self.assertTrue(parent.source_facts, 'Real saved public excerpts travel with the company context')
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
            self.assertEqual(child['source_facts'], [fact.model_dump() for fact in parent.source_facts])
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

    def test_claim_context_does_not_project_private_or_demo_source_links(self):
        valid = self.account.evidence[0]
        self.account.evidence += [valid.model_copy(update={'id': 'private_fact', 'url': 'http://127.0.0.1/admin'}),
                                  valid.model_copy(update={'id': 'example_fact', 'is_demo': True})]
        self.search.accounts = [self.account]
        self.repo.save_customer_search(self.search)
        thread = self.start()
        self.assertTrue(thread.source_facts)
        self.assertNotIn('private_fact', [fact.id for fact in thread.source_facts])
        self.assertNotIn('example_fact', [fact.id for fact in thread.source_facts])

    def report_initial(self):
        thread = self.ready()
        with patch('app.outreach.now', return_value='2026-10-19T14:00:00+00:00'):
            return self.repo.mutate_outreach(thread.id, 'sent', SentRequest(**self.fields(thread)))

    def test_followup_needs_confirmed_business_day_spacing_due_review_and_is_bounded(self):
        thread = self.report_initial()
        with patch('app.outreach.datetime', wraps=datetime) as clock, TestClient(create_app(self.path, testing=True)) as client:
            clock.now.return_value = datetime(2026, 10, 19, 14, tzinfo=timezone.utc)
            body = dict(**self.fields(thread), scheduled_at='2026-10-20T10:00:00-04:00', scheduled_timezone='America/Toronto',
                        subject='Re: A relevant introduction', body='A brief reminder' + thread.sender_footer)
            self.assertEqual(client.post(f'/api/outreach/{thread.id}/followups', json=body).status_code, 409)
            body['scheduled_at'] = '2026-10-22T10:00:00-04:00'
            response = client.post(f'/api/outreach/{thread.id}/followups', json=body)
            self.assertEqual(response.status_code, 200, response.text)
            thread = self.repo.outreach_thread(thread.id)
            self.assertIsNone(thread.approval)
            self.assertFalse(thread.ready_for_manual_action)
            with self.assertRaises(OutreachError):
                self.repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**self.fields(thread)))
            clock.now.return_value = datetime(2026, 10, 22, 14, tzinfo=timezone.utc)
            thread = self.repo.outreach_thread(thread.id)
            self.assertFalse(thread.ready_for_manual_action, 'Time passing does not approve a message')
            thread = self.repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**self.fields(thread)))
            self.assertTrue(thread.ready_for_manual_action)
            report = SentRequest(**self.fields(thread))
            with patch('app.outreach.now', return_value=clock.now.return_value.isoformat()):
                thread = self.repo.mutate_outreach(thread.id, 'sent', report)
                thread = self.repo.mutate_outreach(thread.id, 'sent', report)
            self.assertEqual(len(thread.messages), 2)
            self.assertEqual(thread.followups_sent, 1)
            body = dict(**self.fields(thread), scheduled_at='2026-10-27T10:00:00-04:00', scheduled_timezone='America/Toronto',
                        subject='Re: A relevant introduction', body='One last reminder' + thread.sender_footer)
            response = client.post(f'/api/outreach/{thread.id}/followups', json=body)
            self.assertEqual(response.status_code, 200, response.text)
            clock.now.return_value = datetime(2026, 10, 27, 14, tzinfo=timezone.utc)
            thread = self.repo.outreach_thread(thread.id)
            thread = self.repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**self.fields(thread)))
            thread = self.repo.mutate_outreach(thread.id, 'sent', SentRequest(**self.fields(thread)))
            self.assertEqual(thread.followups_sent, 2)
            body = {**body, **self.fields(thread), 'scheduled_at': '2026-10-30T10:00:00-04:00'}
            self.assertEqual(client.post(f'/api/outreach/{thread.id}/followups', json=body).status_code, 409)

            thread = self.edit(thread, body='A third unscheduled reminder' + thread.sender_footer)
            thread = self.repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**self.fields(thread)))
            self.assertFalse(thread.ready_for_manual_action)
            self.assertEqual(client.post(f'/api/outreach/{thread.id}/sent', json=self.fields(thread)).status_code, 409)

    def test_timed_booking_confirmation_and_after_time_outcomes_preserve_manual_truth(self):
        thread = self.ready()
        with patch('app.outreach.datetime', wraps=datetime) as clock, TestClient(create_app(self.path, testing=True)) as client:
            clock.now.return_value = datetime(2026, 10, 19, 14, tzinfo=timezone.utc)
            payload = dict(**self.fields(thread), meeting_at='2026-10-22T10:00:00-04:00', meeting_timezone='America/Toronto')
            malformed = {**payload, 'meeting_at': '2026-10-22T10:00:00-05:00'}
            self.assertEqual(client.post(f'/api/outreach/{thread.id}/meeting', json=malformed).status_code, 422)
            response = client.post(f'/api/outreach/{thread.id}/meeting', json=payload)
            self.assertEqual(response.status_code, 200, response.text)
            thread = self.repo.outreach_thread(thread.id)
            self.assertIsNone(thread.approval)
            self.assertEqual(thread.meeting_at, '2026-10-22T14:00:00+00:00')
            self.assertEqual(thread.sale_state, 'not_recorded')
            self.assertNotIn('report_meeting', [item['action'] for item in self.repo.outreach_next_up()['items']])
            outcome = dict(**self.fields(thread), meeting_state='attended_reported', sale_state='not_recorded')
            self.assertEqual(client.patch(f'/api/outreach/{thread.id}/outcomes', json=outcome).status_code, 409)
            confirmation = dict(**self.fields(thread), subject='Our meeting', body='Confirming the time you agreed.' + thread.sender_footer)
            response = client.post(f'/api/outreach/{thread.id}/meeting-confirmation', json=confirmation)
            self.assertEqual(response.status_code, 200, response.text)
            thread = self.repo.outreach_thread(thread.id)
            self.assertFalse(thread.ready_for_manual_action)
            thread = self.repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**self.fields(thread)))
            thread = self.repo.mutate_outreach(thread.id, 'sent', SentRequest(**self.fields(thread)))
            snapshot = thread.messages[-1].model_dump()
            self.assertEqual(snapshot['outbound_purpose'], 'meeting_confirmation')
            self.assertIsNotNone(snapshot['contact_basis_snapshot'])
            # Saving the same instant with a new request key is not a new booking.
            same_booking = {**payload, **self.fields(thread)}
            response = client.post(f'/api/outreach/{thread.id}/meeting', json=same_booking)
            self.assertEqual(response.status_code, 200, response.text)
            thread = self.repo.outreach_thread(thread.id)
            self.assertEqual(thread.meeting_version, snapshot['meeting_version'])
            # A second confirmation of the same reported booking cannot become actionable.
            confirmation.update(self.fields(thread))
            client.post(f'/api/outreach/{thread.id}/meeting-confirmation', json=confirmation)
            thread = self.repo.outreach_thread(thread.id)
            with self.assertRaises(OutreachError):
                self.repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**self.fields(thread)))
            clock.now.return_value = datetime(2026, 10, 22, 15, tzinfo=timezone.utc)
            self.assertEqual(self.repo.outreach_next_up()['items'][0]['action'], 'report_meeting')
            outcome.update(self.fields(thread))
            response = client.patch(f'/api/outreach/{thread.id}/outcomes', json=outcome)
            self.assertEqual(response.status_code, 200, response.text)
            thread = self.repo.outreach_thread(thread.id)
            self.assertEqual(thread.sale_state, 'not_recorded', 'Attendance is not a sale')
            thread = self.repo.mutate_outreach(thread.id, 'outcomes', OutcomesRequest(**self.fields(thread),
                meeting_state='attended_reported', sale_state='won_reported'))
            self.assertEqual(thread.messages[-1].model_dump(), snapshot)
            self.assertEqual(thread.sale_state, 'won_reported')

    def test_booking_cannot_move_to_an_edited_recipient_with_fresh_contact_basis(self):
        thread = self.ready()
        with patch('app.outreach.datetime', wraps=datetime) as clock, TestClient(create_app(self.path, testing=True)) as client:
            clock.now.return_value = datetime(2026, 10, 19, 14, tzinfo=timezone.utc)
            booking = dict(**self.fields(thread), meeting_at='2026-10-22T10:00:00-04:00', meeting_timezone='America/Toronto')
            self.assertEqual(client.post(f'/api/outreach/{thread.id}/meeting', json=booking).status_code, 200)
            thread = self.edit(self.repo.outreach_thread(thread.id), recipient='different@business.com')
            thread = self.basis(thread)
            confirmation = dict(**self.fields(thread), subject='Meeting confirmation', body='Confirming.' + thread.sender_footer)
            self.assertEqual(client.post(f'/api/outreach/{thread.id}/meeting-confirmation', json=confirmation).status_code, 409)
            self.assertEqual(self.repo.outreach_thread(thread.id).meeting_recipient, 'hello@business.com')

    def test_company_funnel_deduplicates_and_preserves_unknown_outcomes_and_tenant_boundary(self):
        from app.store import Repository
        thread = self.ready()
        self.assertEqual(self.repo.outreach_insights()['funnel']['contacted'], 0, 'Approval is not contact')
        thread = self.repo.mutate_outreach(thread.id, 'sent', SentRequest(**self.fields(thread)))
        other = self.sibling('funnel_duplicate')
        before = self.repo.outreach_insights()
        self.assertEqual(before['funnel']['companies'], 1)
        self.assertEqual(before['funnel']['contacted'], 1)
        self.assertEqual(before['funnel']['customers'], 0)
        self.assertEqual(len(before['company_flags']), 1)
        self.assertTrue(before['company_flags'][0]['contacted'])
        thread = self.repo.mutate_outreach(thread.id, 'reply', PasteReply(**self.fields(thread), body='Automatic reply', reply_state='auto_reply'))
        self.assertEqual(self.repo.outreach_insights()['funnel']['replied'], 0)
        thread = self.repo.mutate_outreach(thread.id, 'reply-state', CorrectReply(**self.fields(thread), reply_state='interested'))
        result = self.repo.outreach_insights()
        self.assertEqual(result['funnel']['replied'], 1)
        self.assertEqual(result['funnel']['interested'], 1)
        thread = self.repo.mutate_outreach(thread.id, 'reply-state', CorrectReply(**self.fields(thread), reply_state='opt_out'))
        result = self.repo.outreach_insights()
        self.assertEqual(result['funnel']['interested'], 0)
        self.assertTrue(result['company_flags'][0]['suppressed'])
        self.assertEqual(Repository(self.path, 'different_tenant').outreach_insights()['funnel']['companies'], 0)
        self.assertEqual(self.repo.outreach_thread(other.id).meeting_state, 'not_recorded')

    def test_departure_future_dates_are_read_only_and_example_sources_are_excluded(self):
        thread = self.report_initial()
        with patch('app.outreach.datetime', wraps=datetime) as clock, patch('app.outreach.now', return_value='2026-10-19T14:00:00Z'), TestClient(create_app(self.path, testing=True)) as client:
            clock.now.return_value = datetime(2026, 10, 19, 14, tzinfo=timezone.utc)
            body = dict(**self.fields(thread), scheduled_at='2026-10-22T10:00:00-04:00', scheduled_timezone='America/Toronto', subject='Re: Introduction', body='Reminder' + thread.sender_footer)
            self.assertEqual(client.post(f'/api/outreach/{thread.id}/followups', json=body).status_code, 200)
            snapshot = self.repo.outreach_thread(thread.id).model_dump()
            response = client.get('/api/outreach/insights')
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()['departure']['upcoming'][0]['at'], '2026-10-22T14:00:00+00:00')
            self.assertEqual(self.repo.outreach_thread(thread.id).model_dump(), snapshot)
            search = self.repo.customer_search(self.search.id)
            search.accounts[0].is_demo = True
            self.repo.save_customer_search(search)
            result = self.repo.outreach_insights()
            self.assertEqual(result['funnel']['companies'], 0)
            self.assertEqual(result['excluded_example_companies'], 1)

    def test_pending_approval_returns_but_terminal_reply_work_does_not_repeat_forever(self):
        thread = self.ready()
        thread = self.edit(thread, body='A newly saved introduction.' + thread.sender_footer)
        self.assertEqual(self.repo.outreach_next_up()['items'][0]['action'], 'review_message')
        for state in ('not_interested', 'bounce', 'source_question', 'opt_out'):
            thread = self.repo.mutate_outreach(thread.id, 'reply', PasteReply(**self.fields(thread), body='A manually classified terminal reply.', reply_state=state))
            self.assertEqual(self.repo.outreach_next_up()['items'], [])

    def test_prepared_contact_prefers_individual_address_and_offer_edits_invalidate_approval(self):
        from app.models import Contact
        self.account.contacts = [Contact(name=None, role='Team', email='info@business.com', verification_status='verified', source_url='https://business.com/contact', note='Fictional provider fixture'),
                                 Contact(name='Alex Fixture', role='Operations', email='alex@business.com', verification_status='unverified', source_url='https://business.com/team', note='Fictional published fixture')]
        self.search.accounts = [self.account]
        self.repo.save_customer_search(self.search)
        thread = self.start()
        self.assertEqual(thread.recipient, 'alex@business.com')
        self.assertEqual(thread.recipient_status, 'published_unverified')
        self.assertEqual(thread.recipient_name, 'Alex Fixture')
        thread = self.ready()
        before = thread.revision
        profile = self.repo.workspace().profile.model_copy(update={'description': 'A changed fictional offering'})
        self.repo.save_profile(profile)
        self.assertIsNone(self.repo.outreach_thread(thread.id).approval)
        self.assertGreater(self.repo.outreach_thread(thread.id).revision, before)

    def test_due_followup_queue_is_read_only_and_changed_recipient_cannot_inherit_sequence(self):
        thread = self.report_initial()
        with patch('app.outreach.datetime', wraps=datetime) as clock, TestClient(create_app(self.path, testing=True)) as client:
            clock.now.return_value = datetime(2026, 10, 19, 14, tzinfo=timezone.utc)
            body = dict(**self.fields(thread), scheduled_at='2026-10-22T10:00:00-04:00', scheduled_timezone='America/Toronto',
                        subject='Re: Introduction', body='A reminder' + thread.sender_footer)
            self.assertEqual(client.post(f'/api/outreach/{thread.id}/followups', json=body).status_code, 200)
            self.assertEqual(self.repo.outreach_next_up()['items'], [])
            clock.now.return_value = datetime(2026, 10, 22, 14, tzinfo=timezone.utc)
            before = self.repo.outreach_thread(thread.id)
            self.assertEqual(self.repo.outreach_next_up()['items'][0]['action'], 'review_followup')
            self.assertEqual(self.repo.outreach_thread(thread.id).model_dump(), before.model_dump())
            thread = self.edit(before, recipient='another@business.com')
            self.assertIsNone(thread.next_followup_at)
            body.update(self.fields(thread))
            body['scheduled_at'] = '2026-10-27T10:00:00-04:00'
            self.assertEqual(client.post(f'/api/outreach/{thread.id}/followups', json=body).status_code, 409)

    def test_any_inbound_cancels_planned_followup_and_correction_does_not_restore_it(self):
        thread = self.report_initial()
        with patch('app.outreach.datetime', wraps=datetime) as clock, TestClient(create_app(self.path, testing=True)) as client:
            clock.now.return_value = datetime(2026, 10, 19, 14, tzinfo=timezone.utc)
            body = dict(**self.fields(thread), scheduled_at='2026-10-22T10:00:00-04:00', scheduled_timezone='America/Toronto',
                        subject='Re: Introduction', body='A brief reminder' + thread.sender_footer)
            planned = client.post(f'/api/outreach/{thread.id}/followups', json=body)
            self.assertEqual(planned.status_code, 200, planned.text)
            thread = self.repo.outreach_thread(thread.id)
            thread = self.repo.mutate_outreach(thread.id, 'reply', PasteReply(**self.fields(thread), body='Automatic reply', reply_state='auto_reply'))
            self.assertIsNone(thread.next_followup_at)
            thread = self.repo.mutate_outreach(thread.id, 'reply-state', CorrectReply(**self.fields(thread), reply_state='interested'))
            replay = client.post(f'/api/outreach/{thread.id}/followups', json=body).json()
            self.assertIsNone(replay['next_followup_at'])
            body = {**body, **self.fields(thread)}
            self.assertEqual(client.post(f'/api/outreach/{thread.id}/followups', json=body).status_code, 409)


if __name__ == '__main__':
    unittest.main()
