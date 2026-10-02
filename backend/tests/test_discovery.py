"""Offline discovery licensing, spend, provider, provenance and isolation tests."""
from dataclasses import replace
from datetime import timedelta
import json
import os
import secrets
import tempfile
import unittest
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.discovery import DiscoveryService
from app.discovery_config import DiscoverySettings, ProviderPolicy, parse_date, timestamp, utcnow
from app.discovery_models import ContactsRequest, DiscoverRequest, VerifyRequest
from app.discovery_providers import (EXA_URL, PDL_URL, MAX_PROVIDER_BYTES, ExaDiscoveryProvider,
    ProviderFailure, ProviderHTTP, ProviderUnavailable)
from app.fixtures import DEMO_PROFILE
from app.main import create_app
from app.models import Contact
from app.safety import FetchError, Page
from app.worker import create_worker

PAGE = Page('https://company.com/', 'Company', 'B2B SaaS sales workflow automation',
            'B2B SaaS sales workflow automation for VP Sales. Hiring now.')


def approved_settings():
    common = dict(api_key='offline-test-only', key_approved=True, embedding=True, export=True,
        retention=True, retention_days=7, license_reference='offline-approved-contract',
        license_expires_at=timestamp(utcnow() + timedelta(days=30)))
    return DiscoverySettings(exa=ProviderPolicy(name='exa', unit_cost_microusd=27_000, **common),
        pdl=ProviderPolicy(name='peopledatalabs', unit_cost_microusd=100_000, **common),
        launch_approved=True, licensed_data_access=True, job_budget=1_000_000,
        monthly_budget=10_000_000, workspace_monthly_budget=5_000_000)


def scope():
    return dict(org_id='org_one', campaign_id='cmp_one', operation_id='job_one:discovery', max_cost_microusd=1_000_000)


def discover_body(**updates):
    return DiscoverRequest(**{**scope(), 'profile': DEMO_PROFILE, 'target_count': 3,
        'offering_website': 'https://seller.com/', **updates})


def contacts_body(**updates):
    return ContactsRequest(**{**scope(), 'profile': DEMO_PROFILE, 'domain': 'company.com',
        'account_id': 'acc_one', 'max_contacts': 3, **updates})


def pdl_person(**updates):
    return {'full_name': 'Casey Research', 'job_title': 'VP Sales', 'job_company_website': 'company.com',
            'work_email': 'casey@company.com', 'linkedin_url': 'linkedin.com/in/casey-research', **updates}


class DiscoveryProviderTests(unittest.TestCase):
    def setUp(self):
        self.calls = []
        self.settings = approved_settings()

    def transport(self, data, status=200, headers=None):
        def handle(request):
            self.calls.append(request)
            return httpx.Response(status, json=data, headers=headers)
        return httpx.MockTransport(handle)

    def test_configuration_is_fail_closed_and_readiness_has_no_network(self):
        service = DiscoveryService(DiscoverySettings.from_environment({}), transport=self.transport({}))
        with patch('app.discovery_providers.resolve_public', side_effect=AssertionError('No DNS allowed')):
            self.assertFalse(service.status().enabled)
            result = service.discover(discover_body())
            contacts = service.contacts(contacts_body())
        self.assertEqual(result.accounts, [])
        self.assertEqual(result.cost_microusd, 0)
        self.assertEqual(contacts.cost_microusd, 0)
        self.assertEqual(self.calls, [])

    def test_every_commercial_gate_and_key_approval_is_required(self):
        for field in ('key_approved', 'embedding', 'export', 'retention'):
            settings = replace(self.settings, exa=replace(self.settings.exa, **{field: False}))
            service = DiscoveryService(settings, transport=self.transport({}))
            self.assertFalse(service.status().enabled)
            self.assertEqual(service.discover(discover_body()).cost_microusd, 0)
        for field in ('launch_approved', 'licensed_data_access'):
            service = DiscoveryService(replace(self.settings, **{field: False}), transport=self.transport({}))
            self.assertFalse(service.status().enabled)
            self.assertEqual(service.discover(discover_body()).cost_microusd, 0)
        self.assertEqual(self.calls, [])

    def test_expired_missing_reference_and_retention_never_enable_provider(self):
        for values in ({'license_expires_at': timestamp(utcnow()-timedelta(seconds=1))},
                       {'license_expires_at': '2030-01-01'}, {'license_reference': ''}, {'retention_days': 0}):
            settings = replace(self.settings, pdl=replace(self.settings.pdl, **values))
            result = DiscoveryService(settings, transport=self.transport({})).contacts(contacts_body())
            self.assertEqual(result.cost_microusd, 0)
        self.assertEqual(self.calls, [])

    def test_budget_refuses_zero_insufficient_over_job_and_unreviewed_price(self):
        for allowance in (0, 26_999, 1_000_001):
            result = DiscoveryService(self.settings, transport=self.transport({})).discover(discover_body(max_cost_microusd=allowance))
            self.assertEqual(result.cost_microusd, 0)
        settings = replace(self.settings, exa=replace(self.settings.exa, unit_cost_microusd=1))
        self.assertFalse(DiscoveryService(settings).status().enabled)
        with self.assertRaises(ProviderUnavailable):
            ExaDiscoveryProvider(settings, transport=self.transport({})).search(DEMO_PROFILE, 3, None, 1_000_000)
        self.assertEqual(self.calls, [])

    def test_exa_contract_fixed_endpoint_bounded_and_targeting_only(self):
        result = ExaDiscoveryProvider(self.settings, transport=self.transport({'results': [
            {'url': 'https://company.com/', 'title': 'Invented company details ignored'}]})).search(DEMO_PROFILE, 3, 'seller.com', 1_000_000)
        request = self.calls[0]
        payload = json.loads(request.content)
        self.assertEqual(str(request.url), EXA_URL)
        self.assertEqual(request.headers['x-api-key'], 'offline-test-only')
        self.assertEqual(payload['category'], 'company')
        self.assertEqual(payload['numResults'], 3)
        self.assertNotIn('contents', payload)
        self.assertNotIn('excludeDomains', payload)
        self.assertNotIn(DEMO_PROFILE.description, payload['query'])
        self.assertEqual(result[0].domain, 'company.com')
        self.assertFalse(hasattr(result[0], 'name'))

    def test_exa_filters_duplicate_self_directory_private_and_malformed_urls(self):
        urls = ['https://www.company.com/about', 'https://company.com/', 'https://seller.com/',
                'https://linkedin.com/company/target', 'http://127.0.0.1/', 'https://private.local/',
                'https://foo.com/?secret=do-not-reflect', 'https://user:pass@secret.com', 'javascript:bad']
        result = ExaDiscoveryProvider(self.settings, transport=self.transport({'results': [{'url': u} for u in urls]})).search(DEMO_PROFILE, 9, 'seller.com', 1_000_000)
        self.assertEqual([r.domain for r in result], ['company.com', 'foo.com'])
        self.assertEqual(result[1].source_url, 'https://foo.com/')

    def test_exa_rejects_overreturned_or_malformed_result_sets(self):
        for data in ({'results': [{}, {}]}, {'results': {}}, {'results': None}):
            with self.assertRaises(ProviderFailure):
                ExaDiscoveryProvider(self.settings, transport=self.transport(data)).search(DEMO_PROFILE, 1, None, 1_000_000)

    def test_company_discovery_uses_reader_rules_provenance_and_retention(self):
        service = DiscoveryService(self.settings, transport=self.transport({'results': [{'url': 'https://company.com/about'}]}))
        fetched = []
        def fetch(url):
            fetched.append(url)
            return PAGE
        result = service.discover(discover_body(), fetch_page=fetch)
        self.assertEqual(fetched, ['https://company.com/'])
        account = result.accounts[0]
        self.assertEqual(account.decision_engine, 'rules')
        self.assertFalse(account.is_demo)
        self.assertEqual(account.contacts, [])
        self.assertEqual(account.source_provider, 'exa')
        self.assertEqual(account.source_url, 'https://company.com/about')
        self.assertEqual(account.evidence[0].url, PAGE.url)
        self.assertLessEqual(parse_date(account.license_expires_at), utcnow()+timedelta(days=7))
        self.assertIn('No cross-customer cache or reuse', account.license_restrictions)
        self.assertEqual(result.cost_microusd, 27_000)
        self.assertFalse(result.spend_uncertain)

    def test_fetch_failure_or_cross_domain_redirect_never_fabricates_account(self):
        for fetch in (lambda _: (_ for _ in ()).throw(FetchError('Private or restricted network address')),
                      lambda _: Page('https://different.com/', 'Other', 'Other', 'Other')):
            service = DiscoveryService(self.settings, transport=self.transport({'results': [{'url': 'https://company.com'}]}))
            result = service.discover(discover_body(), fetch_page=fetch)
            self.assertEqual(result.accounts, [])
            self.assertTrue(result.errors)
            self.assertEqual(result.cost_microusd, 27_000)

    def test_deadline_stops_website_reads_after_search(self):
        service = DiscoveryService(self.settings, transport=self.transport({'results': [{'url': 'https://company.com'}]}))
        with patch('app.discovery.DISCOVERY_DEADLINE_SECONDS', 0), patch('app.discovery.fetch_public_page') as fetch:
            result = service.discover(discover_body(), fetch_page=fetch)
        fetch.assert_not_called()
        self.assertEqual(result.accounts, [])
        self.assertIn('deadline', result.errors[0])

    def test_pdl_contract_exact_employer_bounded_role_search_and_unverified_email(self):
        result = DiscoveryService(self.settings, transport=self.transport({'status': 200, 'data': [pdl_person()]})).contacts(contacts_body(domain='https://www.company.com/path'))
        request = self.calls[0]
        payload = json.loads(request.content)
        self.assertEqual(str(request.url), PDL_URL)
        self.assertEqual(payload['size'], 3)
        self.assertEqual(payload['query']['query']['bool']['filter'][0], {'term': {'job_company_website': 'company.com'}})
        self.assertNotIn('sql', payload)
        self.assertNotIn('scroll_token', payload)
        person = result.contacts[0]
        self.assertEqual(person.name, 'Casey Research')
        self.assertEqual(person.verification_status, 'unverified')
        self.assertEqual(person.email_status, 'not_checked')
        self.assertIsNone(person.employment_verified_at)
        self.assertIsNone(person.email_checked_at)
        self.assertEqual(person.provider, 'peopledatalabs')
        self.assertEqual(result.cost_microusd, 300_000)

    def test_pdl_rejects_other_employers_and_never_infers_missing_email(self):
        data = [pdl_person(job_company_website='other-company.com'), pdl_person(full_name=None),
                pdl_person(work_email=None, emails=[{'address': 'private@gmail.com'}])]
        result = DiscoveryService(self.settings, transport=self.transport({'status': 200, 'data': data})).contacts(contacts_body())
        self.assertEqual(len(result.contacts), 1)
        self.assertIsNone(result.contacts[0].email)
        self.assertEqual(result.contacts[0].verification_status, 'not_available')

    def test_pdl_no_roles_has_no_paid_call(self):
        body = contacts_body(profile=DEMO_PROFILE.model_copy(update={'buyer_roles': []}))
        result = DiscoveryService(self.settings, transport=self.transport({})).contacts(body)
        self.assertEqual(result.cost_microusd, 0)
        self.assertEqual(self.calls, [])

    def test_no_results_are_honest_and_conservatively_accounted(self):
        result = DiscoveryService(self.settings, transport=self.transport({'status': 200, 'data': []})).contacts(contacts_body())
        self.assertEqual(result.contacts, [])
        self.assertEqual(result.cost_microusd, 300_000)
        self.assertFalse(result.spend_uncertain)
        self.assertIn('not inferred', result.errors[0])

    def test_failures_redacted_uncertain_reserved_and_never_retried(self):
        for status in (302, 400, 401, 402, 429, 500):
            before = len(self.calls)
            result = DiscoveryService(self.settings, transport=self.transport({'secret': 'Never return this'}, status)).contacts(contacts_body())
            self.assertEqual(len(self.calls)-before, 1)
            self.assertEqual(result.cost_microusd, 300_000)
            self.assertTrue(result.spend_uncertain)
            self.assertNotIn('Never return', result.model_dump_json())

    def test_timeout_retains_reservation_and_does_not_leak(self):
        def handler(request):
            self.calls.append(request)
            raise httpx.ReadTimeout('secret request body key', request=request)
        result = DiscoveryService(self.settings, transport=httpx.MockTransport(handler)).discover(discover_body())
        self.assertEqual(len(self.calls), 1)
        self.assertTrue(result.spend_uncertain)
        self.assertEqual(result.cost_microusd, 27_000)
        self.assertNotIn('secret', result.model_dump_json())

    def test_oversized_or_compressed_response_is_rejected(self):
        for data, headers in (({'results': [], 'padding': 'x' * MAX_PROVIDER_BYTES}, None),
                              ({'results': []}, {'content-encoding': 'deflate'})):
            result = DiscoveryService(self.settings, transport=self.transport(data, headers=headers)).discover(discover_body())
            self.assertEqual(result.accounts, [])
            self.assertTrue(result.spend_uncertain)

    def test_non_mock_transport_cannot_override_fixed_live_boundary(self):
        with self.assertRaises(ValueError):
            ProviderHTTP(transport=httpx.HTTPTransport())
        with self.assertRaises(ProviderUnavailable):
            ProviderHTTP().post('https://attacker.com', 'secret', {})

    def test_distinct_customers_are_never_served_from_cache(self):
        service = DiscoveryService(self.settings, transport=self.transport({'results': [{'url': 'https://company.com'}]}))
        one = service.discover(discover_body(), fetch_page=lambda _: PAGE)
        two = service.discover(discover_body(org_id='org_two', campaign_id='cmp_two', operation_id='job_two:discovery'), fetch_page=lambda _: PAGE)
        self.assertEqual(len(self.calls), 2)
        self.assertNotEqual(one.accounts[0].id, two.accounts[0].id)
        self.assertEqual(two.accounts[0].campaign_id, 'cmp_two')

    def test_license_expiry_is_earlier_of_contract_and_retention(self):
        ends = timestamp(utcnow()+timedelta(days=1))
        self.assertEqual(replace(self.settings.pdl, license_expires_at=ends).expires_at(), ends)

    def test_unconfigured_verifier_never_attests_pdl_email(self):
        person = Contact(name='Casey', role='Sales', email='casey@company.com', verification_status='verified',
                         source_url=None, note='Provider input', email_status='valid')
        body = VerifyRequest(**scope(), account_id='acc_one', contacts=[person])
        result = DiscoveryService(self.settings).verify(body)
        self.assertEqual(result.contacts[0].verification_status, 'unverified')
        self.assertEqual(result.contacts[0].email_status, 'not_checked')
        self.assertIsNone(result.contacts[0].email_checked_at)
        self.assertEqual(result.cost_microusd, 0)
        self.assertTrue(DiscoveryService(self.settings).status().enabled)
        self.assertFalse(DiscoveryService(self.settings).status().providers.verification.configured)

    def test_strict_bounds_reject_unknown_fields_and_unbounded_targets(self):
        for values in ({'target_count': 31}, {'target_count': 0}, {'max_cost_microusd': -1},
                       {'target_count': '3'}, {'api_key': 'client-secret'}, {'org_id': 'bad tenant'},
                       {'operation_id': 'x'*161}):
            with self.assertRaises(ValidationError):
                discover_body(**values)
        with self.assertRaises(ValidationError):
            contacts_body(max_contacts=4)


class DiscoveryRoutesTests(unittest.TestCase):
    def test_all_stages_share_auth_origin_and_redacted_validation_boundary(self):
        token = secrets.token_urlsafe(36)
        env = {'SIGNALFOUNDRY_WORKER_TOKEN': token, 'SIGNALFOUNDRY_WORKER_URL': 'https://worker.company.com',
               'SIGNALFOUNDRY_WORKER_ALLOW_PRIVATE_HTTP': 'false', 'FORWARDED_ALLOW_IPS': '', 'DECISION_ENGINE': 'rules'}
        with patch.dict(os.environ, env, clear=True):
            app = create_worker()
        auth = {'Authorization': 'Bearer ' + token}
        with TestClient(app, base_url=env['SIGNALFOUNDRY_WORKER_URL']) as client:
            for route in ('discover', 'contacts', 'verify', 'discovery-status'):
                self.assertEqual(client.post('/worker/'+route, json={}).status_code, 401)
                self.assertEqual(client.post('/worker/'+route, json={}, headers={**auth, 'Origin': 'https://app.com'}).status_code, 403)
            status = client.post('/worker/discovery-status', json={}, headers=auth)
            self.assertEqual(status.status_code, 200)
            self.assertFalse(status.json()['enabled'])
            self.assertNotIn(token, status.text)
            result = client.post('/worker/discover', json=discover_body().model_dump(), headers=auth)
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json()['accounts'], [])
            self.assertEqual(result.json()['cost_microusd'], 0)
            bad = client.post('/worker/discover', json={'api_key': token}, headers=auth)
            self.assertEqual(bad.status_code, 422)
            self.assertNotIn(token, bad.text)

    def test_local_discovery_draft_is_disabled_and_manual_snapshot_frozen(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {'SIGNALFOUNDRY_PREVIEW_ORIGIN': '', 'DECISION_ENGINE': 'rules'}):
            app = create_app(directory+'/local.sqlite3', testing=True)
            app.state.fetch_page = lambda _: PAGE
            with TestClient(app) as client:
                self.assertFalse(client.get('/api/discovery/status').json()['enabled'])
                profile = DEMO_PROFILE.model_dump()
                result = client.post('/api/campaigns', json={'mode': 'discovery', 'name': 'Find companies',
                    'domains': [], 'profile_snapshot': profile, 'target_count': 10})
                self.assertEqual(result.status_code, 201)
                with patch.object(app.state, 'fetch_page', side_effect=AssertionError('No discovery network')):
                    self.assertEqual(client.post('/api/campaigns/'+result.json()['id']+'/research', json={}).status_code, 503)
                result = client.post('/api/campaigns', json={'mode': 'manual', 'name': 'Snapshot',
                    'domains': ['company.com'], 'profile_snapshot': profile, 'target_count': 2,
                    'offering_website': 'seller.com'})
                self.assertEqual(result.status_code, 201, result.text)
                campaign = result.json()
                client.put('/api/workspace/profile', json={**profile, 'keywords': ['nonmatching']})
                self.assertEqual(client.post('/api/campaigns/'+campaign['id']+'/research', json={}).status_code, 200)
                saved = client.get('/api/campaigns/'+campaign['id']).json()
                self.assertEqual(saved['profile_snapshot'], profile)
                self.assertEqual(saved['offering_website'], 'https://seller.com/')
                workspace = client.get('/api/workspace').json()
                suggested = client.post('/api/campaigns/suggest-brief', json={'website': 'company.com'})
                self.assertEqual(suggested.status_code, 200)
                self.assertEqual(client.get('/api/workspace').json(), workspace)
