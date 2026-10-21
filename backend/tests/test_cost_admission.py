"""Offline adversarial monetary admission tests; no provider prices or paid I/O."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
import httpx
from app.cost_admission import CostContext, CostDenied, CostLedger, paid_call, quote_call
from app.store import Repository
from app.customers import ProviderError, provider_json, enrich_contact
from app.customer_drafts import DraftError, DraftInput, generate_customer_draft
from app.fixtures import DEMO_PROFILE
from app.jev import JevDecisionProvider
from app.safety import Page
from tests.cost_fixtures import cost_context, CATALOG
from tests.test_customer_drafts import qualified


class CostAdmissionTests(unittest.TestCase):
    def test_upgrade_locks_legacy_uncertainty_and_operator_receipts_without_rewriting_amounts(self):
        with tempfile.TemporaryDirectory() as temp:
            repo = Repository(Path(temp) / 'legacy-fixture.sqlite3')
            with repo.connect() as db:
                db.execute('CREATE TABLE paid_attempts (tenant TEXT,attempt TEXT,operation TEXT,fingerprint TEXT,period TEXT,reserved INTEGER,actual INTEGER,status TEXT,quote TEXT,usage TEXT,created_at TEXT,finished_at TEXT,PRIMARY KEY(tenant,attempt))')
                for attempt, actual, state, usage in [('overbound', 5354, 'uncertain', {'operator_reference': 'fictional-billing-receipt'}),
                                                       ('resolved', 20, 'settled', {'operator_reference': 'fictional-resolved-receipt'}),
                                                       ('unknown_legacy', None, 'uncertain', None)]:
                    db.execute('INSERT INTO paid_attempts VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
                               ('fixture', attempt, 'deepseek:intro', 'fixture-fingerprint', '2026-10', 5000, actual, state,
                                json.dumps(quote_call('deepseek:intro', {'model': 'deepseek-flash', 'max_tokens': 600}, CATALOG['deepseek:intro'])),
                                json.dumps(usage) if usage else None, '2026-10-01T12:00:00+00:00', None))
            ledger = CostLedger(repo)
            for attempt in ('overbound', 'resolved', 'unknown_legacy'):
                with self.assertRaisesRegex(CostDenied, 'operator reconciliation'):
                    ledger.settle('fixture', attempt, {'usage': {'prompt_tokens': 10, 'completion_tokens': 5}})
            with repo.connect() as db:
                self.assertEqual(db.execute("SELECT actual,status,resolution_lock FROM paid_attempts WHERE attempt='overbound'").fetchone()[:], (5354, 'uncertain', 1))

    def test_default_unknown_history_missing_context_and_legacy_live_transport_dispatch_nothing(self):
        with tempfile.TemporaryDirectory() as temp:
            ledger = CostLedger(Repository(Path(temp) / 'fictional.sqlite3'))
            context = CostContext(ledger, 'local-demo', 'request')
            dispatch = Mock(side_effect=AssertionError('No paid I/O'))
            for value in (None, context):
                with self.assertRaises(CostDenied):
                    paid_call(value, 'deepseek:search', {'query': 'fixture'}, dispatch)
            self.assertFalse(ledger.status('local-demo')['historical_usage_known'])
            dispatch.assert_not_called()
        with patch.dict(os.environ, {'DEEPSEEK_API_KEY': 'fictional-only', 'HUNTER_API_KEY': 'fictional-only', 'CLIENTROVE_DEEPSEEK_DRAFTS_ENABLED': 'true'}), patch('httpx.Client', side_effect=AssertionError('Must not construct transport')):
            for provider, endpoint, body in [('deepseek', 'search', {'query': 'fixture', 'count': 1, 'need_content': False}),
                                             ('hunter', 'domain-search', {'domain': 'fictional.example'}),
                                             ('hunter', 'email-verifier', {'email': 'hello@fictional.example'})]:
                with self.assertRaises(ProviderError):
                    provider_json(provider, endpoint, body)
            with self.assertRaises(DraftError):
                generate_customer_draft(DraftInput(profile=DEMO_PROFILE, account=qualified()))
        with patch('app.jev.resolve_public', side_effect=AssertionError('No DNS')):
            provider = JevDecisionProvider('fictional-only')
            with self.assertRaises(CostDenied):
                provider._request({'model': 'fixture'})

    def test_global_last_allowance_is_atomic_across_tenants_and_connections(self):
        context = cost_context(self, cap=100)
        ledger = context.ledger
        cutoff = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
        ledger.configure_scope('tenant', 'second', historical=0, cutoff=cutoff, reference='fictional-reconciled-fixture', cap=100, enabled=True)
        separate = CostLedger(Repository(ledger.repo.db_path, 'second'))
        def reserve(args):
            tenant, store = args
            try:
                store.reserve(tenant, 'one', 'deepseek:search', {'query': tenant})
                return True
            except CostDenied:
                return False
        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(reserve, [(context.tenant, ledger), ('second', separate)]))
        self.assertEqual(sum(outcomes), 1)
        with ledger.repo.connect() as db:
            self.assertEqual(db.execute('SELECT SUM(reserved) FROM paid_attempts').fetchone()[0], 100)

    def test_attempt_replay_and_changed_input_never_dispatch_twice(self):
        context = cost_context(self)
        dispatch = Mock(return_value={'results': []})
        context.run('deepseek:search', {'query': 'first'}, dispatch)
        for payload in ({'query': 'first'}, {'query': 'changed'}):
            with self.assertRaises(CostDenied):
                context.run('deepseek:search', payload, dispatch)
        self.assertEqual(dispatch.call_count, 1)
        self.assertEqual(context.ledger.status(context.tenant)['tenant_ledger_exposure_micro_usd'], 100)

    def test_historical_spend_and_independent_tenant_cap_are_included(self):
        context = cost_context(self, cap=100, historical=1)
        dispatch = Mock()
        with self.assertRaisesRegex(CostDenied, 'allowance'):
            context.run('deepseek:search', {'query': 'fixture'}, dispatch)
        context = cost_context(self, cap=1000)
        cutoff = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
        context.ledger.configure_scope('tenant', 'small', historical=0, cutoff=cutoff, reference='fictional-billing-fixture', cap=50, enabled=True)
        with self.assertRaisesRegex(CostDenied, 'allowance'):
            CostContext(context.ledger, 'small', 'small-attempt').run('deepseek:search', {'query': 'fixture'}, dispatch)
        dispatch.assert_not_called()
        context.run('deepseek:search', {'query': 'fixture'}, lambda: {'results': []})

    def test_rotated_or_unbound_provider_key_does_not_inherit_reconciled_history(self):
        context = cost_context(self, keys={'DEEPSEEK_API_KEY': 'fictional-original'})
        with patch.dict(os.environ, {'DEEPSEEK_API_KEY': 'fictional-replacement'}), patch('httpx.Client', side_effect=AssertionError('No transport')):
            with self.assertRaisesRegex(ProviderError, 'credential'):
                provider_json('deepseek', 'search', {'query': 'fixture', 'count': 1, 'need_content': False}, cost=context)
        with context.ledger.repo.connect() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM paid_attempts').fetchone()[0], 0)

    def test_late_receipt_settles_original_period_once_and_conflict_stops_every_tenant(self):
        context = cost_context(self)
        payload = {'model': 'deepseek-flash', 'max_tokens': 600, 'messages': []}
        context.ledger.reserve(context.tenant, 'late', 'deepseek:intro', payload)
        context.ledger.recover_inflight()
        receipt = {'usage': {'prompt_tokens': 20, 'completion_tokens': 10}}
        with patch('app.cost_admission.utc_now', return_value='2026-12-01T00:00:00+00:00'):
            context.ledger.settle(context.tenant, 'late', receipt)
            context.ledger.settle(context.tenant, 'late', receipt)
        with context.ledger.repo.connect() as db:
            row = db.execute('SELECT period,status,actual FROM paid_attempts').fetchone()
            self.assertEqual(row['period'], datetime.now(timezone.utc).strftime('%Y-%m'))
            self.assertEqual((row['status'], row['actual']), ('settled', 40))
        with self.assertRaises(CostDenied):
            context.ledger.settle(context.tenant, 'late', {'usage': {'prompt_tokens': 30, 'completion_tokens': 10}})
        with self.assertRaisesRegex(CostDenied, 'operator reconciliation'):
            context.ledger.settle(context.tenant, 'late', receipt)
        with self.assertRaisesRegex(CostDenied, 'Uncertain'):
            context.child('next').run('deepseek:search', {}, Mock())

    def test_unknown_timeout_exposure_survives_restart_and_month_rollover(self):
        context = cost_context(self)
        with self.assertRaises(TimeoutError):
            context.run('deepseek:search', {'query': 'fixture'}, Mock(side_effect=TimeoutError()))
        for store in (context.ledger, CostLedger(Repository(context.ledger.repo.db_path))):
            with self.assertRaisesRegex(CostDenied, 'Uncertain'):
                store.reserve(context.tenant, 'new', 'deepseek:search', {'query': 'fixture'})
            with patch('app.cost_admission.utc_now', return_value='2026-12-01T00:00:00+00:00'):
                with self.assertRaisesRegex(CostDenied, 'Uncertain'):
                    store.reserve(context.tenant, 'rollover', 'deepseek:search', {'query': 'fixture'})
        self.assertEqual(context.ledger.status(context.tenant)['tenant_ledger_exposure_micro_usd'], 100)

    def test_recovery_and_kill_preserve_holds_and_never_refund_an_interrupted_attempt(self):
        context = cost_context(self)
        context.ledger.reserve(context.tenant, 'abandoned', 'deepseek:search', {'query': 'fixture'})
        context.ledger.recover_inflight()
        context.ledger.kill()
        dispatch = Mock()
        with self.assertRaises(CostDenied):
            context.child('fresh').run('deepseek:search', {'query': 'fixture'}, dispatch)
        dispatch.assert_not_called()
        with context.ledger.repo.connect() as db:
            row = db.execute('SELECT status,reserved,actual FROM paid_attempts').fetchone()
            self.assertEqual(tuple(row), ('uncertain', 100, None))

    def test_failed_settlement_and_failed_uncertainty_write_still_block_another_process(self):
        context = cost_context(self)
        with patch.object(context.ledger, 'settle', side_effect=OSError('fixture database interruption')), patch.object(context.ledger, 'uncertain', side_effect=OSError('fixture persistence interruption')):
            with self.assertRaises(OSError):
                context.run('deepseek:search', {'query': 'fixture'}, lambda: {'results': []})
        second = CostLedger(Repository(context.ledger.repo.db_path))
        dispatch = Mock()
        with self.assertRaisesRegex(CostDenied, 'pending'):
            CostContext(second, context.tenant, 'different').run('deepseek:search', {'query': 'second'}, dispatch)
        dispatch.assert_not_called()

    def test_accepted_usage_settles_before_model_content_failure_and_is_not_refunded(self):
        context = cost_context(self, keys={'DEEPSEEK_API_KEY': 'fictional-only'})
        raw = {'usage': {'prompt_tokens': 100, 'completion_tokens': 20, 'total_tokens': 120},
               'choices': [{'finish_reason': 'stop', 'message': {'content': '{"fabricated":"invalid"}'}}]}
        transport = httpx.MockTransport(lambda request: httpx.Response(200, json=raw))
        with patch.dict(os.environ, {'CLIENTROVE_DEEPSEEK_DRAFTS_ENABLED': 'true', 'DEEPSEEK_API_KEY': 'fictional-only'}):
            with self.assertRaises(DraftError):
                generate_customer_draft(DraftInput(profile=DEMO_PROFILE, account=qualified()), transport=transport, cost=context)
        with context.ledger.repo.connect() as db:
            row = db.execute('SELECT status,actual,usage FROM paid_attempts').fetchone()
            self.assertEqual(row['status'], 'settled')
            self.assertEqual(row['actual'], 140)
            self.assertEqual(json.loads(row['usage'])['prompt_tokens'], 100)

    def test_missing_or_overbound_usage_holds_exposure_and_denies_the_next_call(self):
        for raw in ({}, {'usage': {'prompt_tokens': 10, 'completion_tokens': 601}}):
            context = cost_context(self)
            with self.assertRaises(CostDenied):
                context.run('deepseek:intro', {'model': 'deepseek-flash', 'max_tokens': 600, 'messages': []}, lambda: raw)
            with self.assertRaisesRegex(CostDenied, 'Uncertain'):
                context.child('next').run('deepseek:search', {'query': 'fixture'}, Mock())

    def test_missing_prices_and_kill_deny_before_transport_even_with_known_history(self):
        context = cost_context(self)
        dispatch = Mock()
        with self.assertRaises(CostDenied):
            context.run('unpriced:new-provider', {}, dispatch)
        context.ledger.kill(context.tenant)
        with self.assertRaises(CostDenied):
            context.run('deepseek:search', {'query': 'fixture'}, dispatch)
        dispatch.assert_not_called()
        with self.assertRaises(CostDenied):
            context.ledger.configure_scope('global', 'all', historical=0, cutoff=datetime.now(timezone.utc).isoformat(), reference='cannot-reset-existing-history')

    def test_operator_receipt_reconciliation_and_reauthorization_are_explicit_and_audited(self):
        context = cost_context(self)
        ledger = context.ledger
        ledger.reserve(context.tenant, 'interrupted', 'deepseek:search', {'query': 'fixture'})
        ledger.uncertain(context.tenant, 'interrupted')
        ledger.kill()
        with self.assertRaises(CostDenied):
            ledger.authorize('global', 'all', 'fictional-owner-authorization')
        ledger.reconcile(context.tenant, 'interrupted', 50, 'fictional-billing-receipt')
        self.assertEqual(ledger.status(context.tenant)['status'], 'blocked')
        ledger.authorize('global', 'all', 'fictional-owner-authorization')
        self.assertEqual(ledger.status(context.tenant)['status'], 'admission_required')
        ledger.reconcile(context.tenant, 'interrupted', 101, 'fictional-over-bound-receipt')
        with self.assertRaisesRegex(CostDenied, 'operator reconciliation'):
            ledger.settle(context.tenant, 'interrupted', {'results': []})
        self.assertEqual(ledger.status(context.tenant)['status'], 'blocked')
        with ledger.repo.connect() as db:
            self.assertEqual(db.execute('SELECT actual FROM paid_attempts').fetchone()[0], 101)
            self.assertGreaterEqual(db.execute('SELECT COUNT(*) FROM monetary_audit').fetchone()[0], 6)

    def test_hunter_lookup_and_verifier_have_separate_durable_admissions(self):
        context = cost_context(self, keys={'HUNTER_API_KEY': 'fictional-only'})
        calls = []
        def dispatch(request):
            calls.append(request.url.path)
            if request.url.path.endswith('domain-search'):
                return httpx.Response(200, json={'data': {'emails': [{'value': 'hello@fictional.example', 'sources': []}]}})
            return httpx.Response(200, json={'data': {'email': 'hello@fictional.example', 'status': 'valid', 'result': 'deliverable', 'accept_all': False, 'disposable': False, 'webmail': False}})
        with patch.dict(os.environ, {'HUNTER_API_KEY': 'fictional-only'}):
            from app import customers
            original = customers.provider_json
            with patch('app.customers.provider_json', side_effect=lambda provider, endpoint, params, **kwargs: original(
                provider, endpoint, params, transport=httpx.MockTransport(dispatch), **kwargs)):
                result = enrich_contact('fictional.example', 'fictional-test-date', cost=context)
        self.assertEqual(len(calls), 2)
        self.assertEqual(result.contact.verification_status, 'verified')
        self.assertEqual(context.ledger.status(context.tenant)['tenant_ledger_exposure_micro_usd'], 200)

    def test_unicode_quote_is_integer_conservative_and_does_not_store_private_payload(self):
        payload = {'model': 'deepseek-flash', 'max_tokens': 600, 'messages': [{'content': '秘密😀' * 20}]}
        quote = quote_call('deepseek:intro', payload, CATALOG['deepseek:intro'])
        self.assertGreater(quote['input_bound'], len(json.dumps(payload).encode()))
        context = cost_context(self)
        context.run('deepseek:intro', payload, lambda: {'usage': {'prompt_tokens': 30, 'completion_tokens': 10}})
        with context.ledger.repo.connect() as db:
            row = dict(db.execute('SELECT * FROM paid_attempts').fetchone())
        self.assertNotIn('秘密', json.dumps(row, ensure_ascii=False))
        self.assertEqual(row['actual'], 50)


if __name__ == '__main__':
    unittest.main()
