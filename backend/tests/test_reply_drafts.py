"""Fictional reply suggestions and adversarial money/state races; no paid IO."""
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import datetime, timezone
import json
import os
import secrets
import threading
import unittest
from unittest.mock import Mock, patch

import httpx
from fastapi.testclient import TestClient

from app.cost_admission import CostDenied, CostLedger, digest, quote_call
from app.customer_drafts import DraftError
from app.local_data import erase_tenant, export_tenant, WorkspaceClosed
from app.main import create_app
from app.outreach import CorrectReply, OutreachError, PasteReply, PauseRequest, SentRequest
from app.reply_drafts import (ReplyDraftCheck, ReplyDraftRequest, ReplyDraftService,
                              generate_reply_suggestion, snapshot, validate_reply)
from app.store import Repository
from tests.cost_fixtures import CATALOG
from tests import test_outreach as outreach_fixtures


class ReplyDraftTests(unittest.TestCase):
    def setUp(self):
        self.f = outreach_fixtures.OutreachTest()
        self.f.setUp()
        self.addCleanup(self.f.doCleanups)
        self.repo = self.f.repo
        self.thread = self.f.ready()
        self.thread = self.repo.mutate_outreach(self.thread.id, 'sent', SentRequest(**self.f.fields(self.thread),
            sent_as='with_changes', actual_subject='Real reported subject', actual_body='Actual words sent externally.'))
        self.thread = self.repo.mutate_outreach(self.thread.id, 'reply', PasteReply(**self.f.fields(self.thread),
            body='Does this help with our property operations? Please explain.', reply_state='question'))
        self.ledger = CostLedger(self.repo)
        self.env = {'CLIENTROVE_DEEPSEEK_REPLIES_ENABLED': 'true', 'DEEPSEEK_API_KEY': secrets.token_urlsafe(24)}
        self.env_patch = patch.dict(os.environ, self.env)
        self.env_patch.start()
        self.addCleanup(self.env_patch.stop)
        self.calls = []
        self.app = create_app(self.f.path, testing=True)
        self.app.state.generate_reply_suggestion = self.generate
        self.client = TestClient(self.app)
        self.addCleanup(self.client.close)

    def policy(self, *, reply=True):
        catalog = deepcopy(CATALOG)
        if reply:
            catalog['deepseek:reply'] = deepcopy(catalog['deepseek:intro'])
        for operation, spec in catalog.items():
            if operation.startswith('deepseek:'):
                spec['billing_identity'] = digest(self.env['DEEPSEEK_API_KEY'])
        cutoff = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
        for scope, identity in [('global', 'all'), ('tenant', self.repo.tenant_id)]:
            self.ledger.configure_scope(scope, identity, historical=0, cutoff=cutoff,
                reference='fictional-offline-reconciled', enabled=True, catalog=catalog)

    def request(self, **changes):
        fields = dict(**self.f.fields(self.thread), context_confirmed=True, context_version='reply-context-v2')
        fields.update(changes)
        return ReplyDraftRequest(**fields)

    def current(self):
        with self.repo.connect() as db:
            return snapshot(self.repo, db, self.thread.id, self.thread.revision)

    def content(self):
        return {'body': 'Thanks for asking about property operations. The saved offering describes renovation services. Which part of the work would you like the founder to confirm?',
                'evidence_ids': ['seller:offer']}

    def respond(self, request):
        self.calls.append(request)
        return httpx.Response(200, json={'usage': {'prompt_tokens': 100, 'completion_tokens': 20, 'total_tokens': 120},
            'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps(self.content())}}]})

    def generate(self, current, *, cost):
        return generate_reply_suggestion(current, cost=cost, transport=httpx.MockTransport(self.respond))

    def service(self, generator=None):
        return ReplyDraftService(self.repo, self.ledger, generator or self.generate)

    def post(self, body=None):
        body = body or self.request()
        return self.client.post(f'/api/outreach/{self.thread.id}/reply-draft', json=body.model_dump())

    def test_explicit_suggestion_binds_actual_history_and_changes_no_thread(self):
        self.policy()
        before = self.repo.outreach_thread(self.thread.id).model_dump()
        response = self.post()
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertEqual(self.repo.outreach_thread(self.thread.id).model_dump(), before)
        self.assertEqual(result['inbound_id'], self.thread.messages[-1].id)
        self.assertIsNone(before['approval'])
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(str(self.calls[0].url), 'https://api.deepseek.com/chat/completions')
        payload = json.loads(self.calls[0].content)
        context = json.loads(payload['messages'][1]['content'])
        self.assertIn('Actual words sent externally.', str(context))
        self.assertNotIn('could we discuss', str(context))
        self.assertNotIn(self.thread.recipient, self.calls[0].content.decode())
        self.assertNotIn(self.repo.workspace().profile.mailing_address, self.calls[0].content.decode())
        self.assertEqual(payload['max_tokens'], 600)
        self.assertNotIn('tools', payload)
        with self.repo.connect() as db:
            row = db.execute('SELECT operation,status,actual FROM paid_attempts').fetchone()
            self.assertEqual(tuple(row), ('deepseek:reply', 'settled', 140))

    def test_missing_or_false_context_confirmation_never_generates(self):
        generate = Mock(side_effect=AssertionError('No generation'))
        self.app.state.generate_reply_suggestion = generate
        body = self.request().model_dump()
        for field in ['context_confirmed', 'context_version']:
            value = dict(body)
            value.pop(field)
            self.assertEqual(self.client.post(f'/api/outreach/{self.thread.id}/reply-draft', json=value).status_code, 422)
        for value in [False, 1, 'true']:
            self.assertEqual(self.client.post(f'/api/outreach/{self.thread.id}/reply-draft', json={**body, 'context_confirmed': value}).status_code, 422)
        self.assertEqual(self.client.post(f'/api/outreach/{self.thread.id}/reply-draft', json={**body, 'context_version': 'reply-context-v1'}).status_code, 422)
        self.assertEqual(self.client.post(f'/api/outreach/{self.thread.id}/reply-draft', json={}).status_code, 503)
        generate.assert_not_called()

    def test_every_disallowed_reply_state_blocks_before_generation(self):
        for state in ['awaiting_review', 'uncertain', 'not_now', 'not_interested', 'opt_out',
                      'source_question', 'auto_reply', 'bounce', 'referral']:
            with self.subTest(state=state):
                # Independent fixture resets, never remove a durable suppression.
                thread = self.thread.model_copy(deep=True)
                thread.reply_state = state
                thread.messages[-1].reply_state = state
                with self.repo.connect() as db:
                    db.execute('UPDATE outreach_threads SET data=? WHERE tenant_id=? AND id=?',
                               (thread.model_dump_json(), self.repo.tenant_id, thread.id))
                response = self.post()
                self.assertEqual(response.status_code, 409)
        self.assertEqual(self.calls, [])

    def test_unknown_history_or_absent_separate_reply_price_dispatches_nothing(self):
        with patch('app.customer_drafts.httpx.Client', side_effect=AssertionError('No HTTP client')):
            response = self.post()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()['code'], 'COST_BLOCKED')
        self.policy(reply=False)
        response = self.post()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(self.calls, [])
        with self.repo.connect() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM paid_attempts').fetchone()[0], 0)

    def test_reply_operation_rejects_flat_quote_and_unknown_model(self):
        payload = {'model': 'deepseek-flash', 'max_tokens': 600}
        for spec in [CATALOG['deepseek:search'], {**CATALOG['deepseek:intro'], 'model': 'unknown'}]:
            with self.assertRaises(CostDenied):
                quote_call('deepseek:reply', payload, spec)

    def test_cached_reopening_and_new_keys_are_free_when_feature_is_off(self):
        self.policy()
        body = self.request()
        original = self.post(body)
        self.assertEqual(original.status_code, 200, original.text)
        with patch.dict(os.environ, {'CLIENTROVE_DEEPSEEK_REPLIES_ENABLED': 'false', 'DEEPSEEK_API_KEY': ''}):
            self.assertEqual(self.post(body).json(), original.json())
            self.assertEqual(self.post().json(), original.json())
        self.assertEqual(len(self.calls), 1)
        with self.repo.connect() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM paid_attempts').fetchone()[0], 1)

    def test_context_change_rejects_old_key_and_check_even_without_revision_change(self):
        self.policy()
        body = self.request()
        original = self.post(body).json()
        profile = self.repo.workspace().profile.model_copy(update={'description': 'A different confirmed offering.'})
        self.repo.save_profile(profile)
        self.assertEqual(self.repo.outreach_thread(self.thread.id).revision, self.thread.revision)
        response = self.client.post(f'/api/outreach/{self.thread.id}/reply-draft/check', json={
            'expected_revision': self.thread.revision, 'snapshot_key': original['snapshot_key']})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.post(body).status_code, 409)
        self.assertEqual(len(self.calls), 1)

    def test_predispatch_fact_change_fails_inside_cost_admission_with_zero_http(self):
        self.policy()
        def change_then_generate(current, *, cost):
            self.repo.save_profile(self.repo.workspace().profile.model_copy(update={'description': 'Changed offering'}))
            return self.generate(current, cost=cost)
        with self.assertRaises(OutreachError):
            self.service(change_then_generate).request(self.thread.id, self.request())
        self.assertEqual(self.calls, [])
        with self.repo.connect() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM paid_attempts').fetchone()[0], 0)

    def test_inflight_new_reply_discards_result_but_settles_usage(self):
        self.policy()
        respond = self.respond
        def new_reply(request):
            self.repo.mutate_outreach(self.thread.id, 'reply', PasteReply(**self.f.fields(self.thread),
                body='Another question arrived during generation.', reply_state='question'))
            return respond(request)
        self.respond = new_reply
        response = self.post()
        self.assertEqual(response.status_code, 409, response.text)
        with self.repo.connect() as db:
            self.assertEqual(tuple(db.execute('SELECT status,actual FROM paid_attempts').fetchone()), ('settled', 140))
            self.assertEqual(tuple(db.execute('SELECT status,data FROM customer_drafts').fetchone()), ('failed', None))
        self.assertEqual(self.repo.outreach_thread(self.thread.id).body, self.thread.body)

    def test_inflight_closure_cannot_recreate_cached_payload(self):
        self.policy()
        respond = self.respond
        def close(request):
            erase_tenant(self.repo, 'ERASE AND CLOSE ' + self.repo.tenant_id)
            return respond(request)
        self.respond = close
        response = self.post()
        self.assertEqual(response.status_code, 410)
        with self.repo.connect() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM customer_drafts').fetchone()[0], 0)
            self.assertEqual(db.execute('SELECT COUNT(*) FROM customer_draft_requests').fetchone()[0], 0)
            self.assertEqual(tuple(db.execute('SELECT status,actual FROM paid_attempts').fetchone()), ('settled', 140))

    def test_inflight_offering_edit_invalidates_output_without_a_revision_change(self):
        self.policy()
        respond = self.respond
        def change(request):
            self.repo.save_profile(self.repo.workspace().profile.model_copy(update={'description': 'A new offering'}))
            self.assertEqual(self.repo.outreach_thread(self.thread.id).revision, self.thread.revision)
            return respond(request)
        self.respond = change
        response = self.post()
        self.assertEqual(response.status_code, 409)
        with self.repo.connect() as db:
            self.assertEqual(tuple(db.execute('SELECT status,data FROM customer_drafts').fetchone()), ('failed', None))
            self.assertEqual(tuple(db.execute('SELECT status,actual FROM paid_attempts').fetchone()), ('settled', 140))

    def test_inflight_pause_discards_result_and_restores_no_approval(self):
        self.policy()
        respond = self.respond
        def pause(request):
            self.repo.mutate_outreach(self.thread.id, 'pause', PauseRequest(**self.f.fields(self.thread), paused=True))
            return respond(request)
        self.respond = pause
        self.assertEqual(self.post().status_code, 409)
        current = self.repo.outreach_thread(self.thread.id)
        self.assertTrue(current.paused)
        self.assertIsNone(current.approval)

    def test_inflight_opt_out_remains_sticky_and_discards_suggestion(self):
        self.policy()
        respond = self.respond
        def stop(request):
            self.repo.mutate_outreach(self.thread.id, 'reply', PasteReply(**self.f.fields(self.thread),
                body='Unsubscribe from further contact.', reply_state='opt_out'))
            return respond(request)
        self.respond = stop
        self.assertEqual(self.post().status_code, 409)
        current = self.repo.outreach_thread(self.thread.id)
        current = self.repo.mutate_outreach(current.id, 'reply-state', CorrectReply(**self.f.fields(current), reply_state='question'))
        self.assertTrue(current.suppressed)
        self.assertIsNone(current.approval)
        self.assertEqual(len(self.calls), 1)

    def test_timeout_preserves_unknown_exposure_and_blocks_even_an_explicit_new_attempt(self):
        self.policy()
        calls = Mock(side_effect=httpx.ReadTimeout('Private provider diagnostics must not escape'))
        self.app.state.generate_reply_suggestion = lambda current, cost: generate_reply_suggestion(
            current, cost=cost, transport=httpx.MockTransport(calls))
        first = self.post()
        self.assertEqual(first.status_code, 409)
        self.assertNotIn('Private provider diagnostics', first.text)
        self.assertEqual(self.post().status_code, 503)
        self.assertEqual(calls.call_count, 1)
        with self.repo.connect() as db:
            self.assertEqual(tuple(db.execute('SELECT status,actual FROM paid_attempts').fetchone()), ('uncertain', None))

    def test_reply_does_not_get_a_new_quota_separate_from_initial_drafts(self):
        self.policy()
        for index in range(5):
            key, request = f'intro_snapshot_{index}', f'intro_request_{index}'
            self.repo.reserve_customer_draft(key, request)
            self.repo.finish_customer_draft(key, request)
        self.assertEqual(self.post().status_code, 409)
        self.assertEqual(self.calls, [])

    def test_latest_received_tail_is_present_before_any_paid_dispatch(self):
        self.policy()
        question = 'Does your offering work with unusual property workflows?'
        self.thread = self.repo.mutate_outreach(self.thread.id, 'reply', PasteReply(**self.f.fields(self.thread),
            body=('Background context. ' * 300)[:6000 - len(question)] + question, reply_state='question'))
        response = self.post()
        self.assertEqual(response.status_code, 200, response.text)
        context = json.loads(json.loads(self.calls[0].content)['messages'][1]['content'])
        self.assertIn('Does your offering work with unusual property workflows?', context['latest_received'])
        self.assertEqual(len(context['latest_received']), 6000)

    def test_oversized_legacy_reply_is_retained_and_denied_before_reservation(self):
        self.policy()
        legacy = self.thread.model_copy(deep=True)
        legacy.messages[-1].body = 'x' * 6001
        with self.repo.connect() as db:
            db.execute('UPDATE outreach_threads SET data=? WHERE tenant_id=? AND id=?',
                       (legacy.model_dump_json(), self.repo.tenant_id, legacy.id))
        self.assertEqual(self.post().status_code, 409)
        self.assertEqual(len(self.repo.outreach_thread(legacy.id).messages[-1].body), 6001)
        with self.repo.connect() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM customer_draft_requests').fetchone()[0], 0)
            self.assertEqual(db.execute('SELECT COUNT(*) FROM paid_attempts').fetchone()[0], 0)
        self.assertEqual(self.calls, [])

    def test_a_prospect_number_is_not_a_seller_price(self):
        current = self.current()
        current['facts'].append({'id': 'prospect:fictional', 'excerpt': 'This company operates 49 properties.'})
        for body in ['Our pricing is 49 per month.', 'The monthly fee is 49.', 'Our rate is 49 per year.']:
            with self.subTest(body=body), self.assertRaises(DraftError):
                validate_reply({'body': body, 'evidence_ids': ['prospect:fictional']}, current)

    def test_duplicate_requests_in_flight_dispatch_once(self):
        self.policy()
        entered, release = threading.Event(), threading.Event()
        original = self.respond
        def delayed(request):
            entered.set()
            self.assertTrue(release.wait(5))
            return original(request)
        self.respond = delayed
        body = self.request()
        with ThreadPoolExecutor(max_workers=2) as pool:
            first = pool.submit(self.service().request, self.thread.id, body)
            self.assertTrue(entered.wait(5))
            try:
                with self.assertRaises(DraftError):
                    self.service().request(self.thread.id, self.request())
            finally:
                release.set()
            self.assertEqual(first.result(timeout=5).expected_revision, self.thread.revision)
        self.assertEqual(len(self.calls), 1)

    def test_references_prices_contacts_and_numeric_claims_do_not_use_inbound_as_facts(self):
        current = self.current()
        for body in ['It is $49 per month.', 'A free trial is available.', 'Results improve 39%.',
                     'Your team has 991 people.', 'Write help@example.org.', 'Visit https://example.org/']:
            with self.subTest(body=body), self.assertRaises(DraftError):
                validate_reply({'body': body, 'evidence_ids': ['seller:offer']}, current)
        for ids in [['unknown'], ['seller:offer', 'seller:offer']]:
            with self.assertRaises(DraftError):
                validate_reply({**self.content(), 'evidence_ids': ids}, current)
        inherited = {**current, 'subject': 'Re: Actual saved subject'}
        self.assertEqual(validate_reply(self.content(), inherited).subject, inherited['subject'])

    def test_provider_invalid_output_is_settled_not_refunded_or_retried(self):
        self.policy()
        self.content = lambda: {'body': 'Our price is $999.', 'evidence_ids': ['seller:offer']}
        body = self.request()
        self.assertEqual(self.post(body).status_code, 409)
        self.assertEqual(self.post(body).status_code, 409)
        self.assertEqual(len(self.calls), 1)
        with self.repo.connect() as db:
            self.assertEqual(tuple(db.execute('SELECT status,actual FROM paid_attempts').fetchone()), ('settled', 140))

    def test_recipient_change_cannot_reuse_another_persons_reply(self):
        edited = self.f.edit(self.thread, recipient='other@business.com')
        self.thread = self.f.basis(edited)
        self.assertEqual(self.post().status_code, 409)
        self.assertEqual(self.calls, [])

    def test_preview_and_off_switch_deny_reply_and_check_routes(self):
        with patch.dict(os.environ, {'CLIENTROVE_LOCAL_OUTREACH_ENABLED': 'false'}):
            app = create_app(self.f.path, testing=True)
        app.state.generate_reply_suggestion = Mock(side_effect=AssertionError('No generation'))
        with TestClient(app) as client:
            self.assertEqual(client.post(f'/api/outreach/{self.thread.id}/reply-draft', json=self.request().model_dump()).status_code, 403)
            self.assertEqual(client.post(f'/api/outreach/{self.thread.id}/reply-draft/check', json={
                'expected_revision': self.thread.revision, 'snapshot_key': self.current()['key']}).status_code, 403)

    def test_failure_exception_is_safe_and_export_contains_only_tenant_suggestion(self):
        secret = secrets.token_urlsafe(32)
        self.app.state.generate_reply_suggestion = Mock(side_effect=RuntimeError(secret))
        response = self.post()
        self.assertEqual(response.status_code, 409)
        self.assertNotIn(secret, response.text)
        self.app.state.generate_reply_suggestion = self.generate
        self.policy()
        self.assertEqual(self.post().status_code, 200)
        exported = export_tenant(self.repo)
        self.assertIn('customer_drafts', exported['records'])
        other = Repository(self.f.path, 'other-tenant')
        with self.assertRaises(OutreachError):
            ReplyDraftService(other, self.ledger).check(self.thread.id,
                ReplyDraftCheck(expected_revision=self.thread.revision, snapshot_key=self.current()['key']))
