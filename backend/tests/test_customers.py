"""Offline discovery contracts; all provider and public-page I/O is injected."""
import os
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient
import httpx
from tests.cost_fixtures import cost_context

from app.customers import (CustomerSearchRequest, DiscoveryRequest, ProviderError, business_url,
                           discover_customers, engine_status, enrich_contact, provider_json,
                           plan_query, published_contacts, qualify_customer, source_business_name, ContactLookup, customer_is_qualified)
from app.fixtures import DEMO_PROFILE
from app.main import create_app
from app.safety import FetchError, Page
from app.store import Repository
from app.worker import create_worker


ENV = {'CLIENTROVE_SEARCH_PROVIDER': 'deepseek', 'CLIENTROVE_DEEPSEEK_ENABLED': 'true', 'DEEPSEEK_API_KEY': 'test-only-key',
       'CLIENTROVE_HUNTER_ENABLED': '', 'HUNTER_API_KEY': '', 'CLIENTROVE_BRAVE_SEARCH_ENABLED': '', 'BRAVE_SEARCH_API_KEY': ''}
PAGE = Page('https://business.com/', 'Business | Accounting firms', 'Accounting firms serving Toronto businesses.',
            'Accounting firms providing financial reporting and tax advice for businesses in Toronto.')


class DiscoveryTests(unittest.TestCase):
    def request(self, **kwargs):
        return DiscoveryRequest(profile=DEMO_PROFILE, website='https://mybusiness.com', search_id='search_test',
                                target=kwargs.get('target', 'Accounting firms'), geography=kwargs.get('geography', 'Toronto'), limit=kwargs.get('limit', 5))

    def test_fail_closed_even_when_unrelated_key_exists(self):
        with patch.dict(os.environ, {**ENV, 'CLIENTROVE_DEEPSEEK_ENABLED': ''}):
            self.assertEqual(engine_status()['discovery']['status'], 'unconfigured')
            with patch('app.customers.provider_json', side_effect=AssertionError('No paid call')):
                with self.assertRaises(ProviderError):
                    discover_customers(self.request())

    def test_query_preserves_short_full_location_and_clips_long_queries_at_word_boundaries(self):
        query = plan_query('property management companies', 'Kitchener Waterloo Ontario', 'deepseek')
        self.assertIn('Kitchener Waterloo Ontario', query)
        self.assertLessEqual(len(query), 128)
        query = plan_query('independent property management businesses ' * 4, 'Kitchener Waterloo Ontario Canada', 'deepseek')
        self.assertLessEqual(len(query), 128)
        self.assertIn('Kitchener Waterloo Ontario Canada', query)

    def test_customer_type_plural_matching_and_source_area_outrank_incidental_funding(self):
        local = Page('https://blacklinemanagement.com/', 'Property Management in Kitchener, Waterloo | Blackline Management',
                     'Professional property management in Kitchener-Waterloo.', 'Blackline Management provides property management in Kitchener and Waterloo. Contact our team.')
        broad = Page('https://other.com/', 'Other Property Management', 'Property management services across North America.',
                     'Other Property Management provides community services. Read our blog about funding, hiring, expanding and partnerships.')
        nearby = qualify_customer(DEMO_PROFILE, local, target='property management companies', geography='Kitchener Waterloo Ontario', search_id='search_test')
        distant = qualify_customer(DEMO_PROFILE, broad, target='property management companies', geography='Kitchener Waterloo Ontario', search_id='search_test')
        self.assertEqual(nearby.name, 'Blackline Management')
        self.assertEqual(nearby.score, 100)
        self.assertEqual(distant.score, 60)
        self.assertEqual(nearby.confidence, 'medium')
        self.assertEqual(distant.confidence, 'low')
        self.assertTrue(all('funding' not in item for item in distant.why_fit + distant.why_now))
        self.assertFalse(any(item.kind == 'signal' for item in distant.evidence))
        self.assertTrue(all(item.url == local.url for item in nearby.evidence))

    def test_source_name_uses_brand_and_literal_copyright_not_marketing_headline(self):
        page = Page('https://iconpm.ca/', 'Condominium Property Management Services You Can Trust',
                    'Trusted condominium property management.', 'About ICON. Contact info@iconpm.ca. © 2026 ICON PM All Rights Reserved.')
        self.assertEqual(source_business_name(page), 'ICON PM')
        contacts = published_contacts(page, '2026-10-19T00:00:00Z')
        self.assertEqual([item.email for item in contacts], ['info@iconpm.ca'])
        self.assertEqual(contacts[0].verification_status, 'unverified')
        self.assertIsNone(contacts[0].name)
        self.assertEqual(contacts[0].source_url, page.url)

    def test_qualification_requires_customer_identity_not_location_or_incidental_mentions(self):
        strong = qualify_customer(DEMO_PROFILE, PAGE, target='Accounting firms', geography='Toronto', search_id='search_test')
        self.assertTrue(customer_is_qualified(strong))
        incidental = Page('https://incidental.com/', 'Incidental | Toronto', 'Toronto company news.',
                          'Toronto businesses discuss accounting firms in this article.')
        weak = qualify_customer(DEMO_PROFILE, incidental, target='Accounting firms', geography='Toronto', search_id='search_test')
        self.assertGreaterEqual(weak.score, 60)  # Geography cannot compensate for weak company identity.
        self.assertFalse(customer_is_qualified(weak))
        unrelated = qualify_customer(DEMO_PROFILE, PAGE, target='Dental practices', geography='Toronto', search_id='search_test')
        self.assertFalse(customer_is_qualified(unrelated))
        self.assertFalse(customer_is_qualified(strong.model_copy(update={'evidence': []})))
        self.assertFalse(customer_is_qualified(strong.model_copy(update={'is_demo': True})))
        self.assertFalse(customer_is_qualified(strong.model_copy(update={'evidence': [item.model_copy(update={'is_demo': True}) for item in strong.evidence]})))
        self.assertFalse(customer_is_qualified(strong.model_copy(update={'evidence': [item.model_copy(update={'url': 'http://127.0.0.1/'}) for item in strong.evidence]})))

    def test_weak_candidates_are_replaced_before_any_contact_lookup(self):
        urls = ['https://unrelated.com/', 'https://incidental.com/', 'https://accountants.com/']
        search = Mock(return_value={'results': [{'url': url} for url in urls]})
        pages = {
            urls[0]: Page(urls[0], 'Unrelated | Toronto', 'Bakery in Toronto.', 'Fresh bread.'),
            urls[1]: Page(urls[1], 'Incidental | Toronto', 'Company news in Toronto.', 'Accounting firms are discussed in a news post.'),
            urls[2]: Page(urls[2], PAGE.title, PAGE.description, PAGE.text),
        }
        with patch.dict(os.environ, {**ENV, 'CLIENTROVE_HUNTER_ENABLED': 'true', 'HUNTER_API_KEY': 'test-only'}), \
             patch('app.customers.enrich_contact', return_value=ContactLookup()) as contacts:
            result = discover_customers(self.request(limit=1), call=search, fetch_page=pages.__getitem__)
        self.assertEqual([account.domain for account in result.accounts], ['accountants.com'])
        self.assertEqual(contacts.call_count, 1)
        self.assertEqual(contacts.call_args.args[0], 'accountants.com')
        self.assertEqual(search.call_count, 1)

    def test_public_emails_require_literal_same_domain_and_never_invent_people(self):
        page = Page('https://www.business.com/', 'Business', '',
                    'Contact hello@business.com or person@gmail.com. Example fake@another.com. Call us for sales.')
        contacts = published_contacts(page, 'today')
        self.assertEqual([item.email for item in contacts], ['hello@business.com'])
        self.assertTrue(all(item.verification_status == 'unverified' and item.name is None for item in contacts))
        self.assertEqual(published_contacts(PAGE, 'today'), [])

    def test_literal_jsdelivr_footer_email_is_preserved_as_unverified(self):
        # This address is actually visible in the publisher's footer, not derived
        # from an npm/CDN URL or an inferred username.
        page = Page('https://www.jsdelivr.com/', 'jsDelivr', 'CDN service',
                    'About Our History Our Sponsors Custom OSS CDN Status Terms & Policies d@jsdelivr.com Convert from: GitHub')
        contacts = published_contacts(page, 'today')
        self.assertEqual([item.email for item in contacts], ['d@jsdelivr.com'])
        self.assertEqual(contacts[0].verification_status, 'unverified')
        self.assertIsNone(contacts[0].name)

    def test_blocked_first_batch_is_backfilled_from_same_provider_response(self):
        urls = [f'https://blocked{i}.com/' for i in range(5)] + [f'https://good{i}.com/' for i in range(5)]
        search = Mock(return_value={'results': [{'url': url} for url in urls]})
        attempted = []
        def fetch(url):
            attempted.append(url)
            if 'blocked' in url:
                raise FetchError('The website returned HTTP 403; try another public page')
            return Page(url, url, PAGE.description, PAGE.text)
        with patch.dict(os.environ, ENV):
            result = discover_customers(self.request(limit=5), call=search, fetch_page=fetch)
        self.assertEqual(len(result.accounts), 5)
        self.assertEqual(len(result.errors), 5)
        self.assertTrue(all('HTTP 403' in error for error in result.errors))
        self.assertEqual(len(attempted), 10)
        self.assertEqual(search.call_count, 1)
        self.assertEqual({a.domain for a in result.accounts}, {f'good{i}.com' for i in range(5)})

    def test_all_blocked_stops_after_ten_public_attempts_with_three_workers(self):
        urls = [f'https://blocked{i}.com/' for i in range(20)]
        search = Mock(return_value={'results': [{'url': url} for url in urls]})
        attempted, active, peak = [], 0, 0
        lock = threading.Lock()
        def fetch(url):
            nonlocal active, peak
            with lock:
                attempted.append(url)
                active += 1
                peak = max(active, peak)
            try:
                time.sleep(.01)
                raise FetchError('The website returned HTTP 403; try another public page')
            finally:
                with lock:
                    active -= 1
        with patch.dict(os.environ, ENV):
            result = discover_customers(self.request(limit=5), call=search, fetch_page=fetch)
        self.assertEqual(result.accounts, [])
        self.assertEqual(len(attempted), 10)
        self.assertEqual(len(set(attempted)), 10)
        self.assertLessEqual(peak, 3)
        self.assertGreater(peak, 1)
        self.assertEqual(search.call_count, 1)
        self.assertTrue(any('ten-attempt limit' in error for error in result.errors))

    def test_redirect_duplicates_and_failures_backfill_before_contact_credit_admission(self):
        urls = ['https://one.com/', 'https://alias.com/', 'https://blocked.com/', 'https://unique.com/', 'https://another.com/']
        search = Mock(return_value={'results': [{'url': url} for url in urls]})
        attempted = []
        def fetch(url):
            attempted.append(url)
            if 'blocked' in url:
                raise FetchError('The website returned HTTP 403; try another public page')
            destination = 'https://samebusiness.com/' if url in urls[:2] else url
            return Page(destination, destination, PAGE.description, PAGE.text)
        with patch.dict(os.environ, {**ENV, 'CLIENTROVE_HUNTER_ENABLED': 'true', 'HUNTER_API_KEY': 'test-only'}), \
             patch('app.customers.enrich_contact', return_value=ContactLookup()) as contacts:
            result = discover_customers(self.request(limit=3), call=search, fetch_page=fetch)
        self.assertEqual(len(result.accounts), 3)
        self.assertEqual({a.domain for a in result.accounts}, {'samebusiness.com', 'unique.com', 'another.com'})
        self.assertEqual(len(attempted), 5)
        self.assertEqual(contacts.call_count, 3)
        self.assertEqual(len({call.args[0] for call in contacts.call_args_list}), 3)
        self.assertEqual(search.call_count, 1)
        self.assertEqual(len(result.errors), 1)

    def test_successful_result_limit_does_not_research_or_enrich_unused_candidates(self):
        urls = [f'https://business{i}.com/' for i in range(20)]
        search = Mock(return_value={'results': [{'url': url} for url in urls]})
        attempted = []
        def fetch(url):
            attempted.append(url)
            return Page(url, url, PAGE.description, PAGE.text)
        with patch.dict(os.environ, {**ENV, 'CLIENTROVE_HUNTER_ENABLED': 'true', 'HUNTER_API_KEY': 'test-only'}), \
             patch('app.customers.enrich_contact', return_value=ContactLookup()) as contacts:
            result = discover_customers(self.request(limit=2), call=search, fetch_page=fetch)
        self.assertEqual(len(result.accounts), 2)
        self.assertEqual(len(attempted), 2)
        self.assertEqual(contacts.call_count, 2)
        self.assertEqual(search.call_count, 1)

    def test_filter_self_directories_private_paths_and_deduplicate_before_fetch(self):
        urls = ['http://127.0.0.1/', 'https://metadata.internal/', 'https://www.linkedin.com/company/x',
                'https://mybusiness.com/', 'https://blog.mybusiness.com/', 'https://news.com/blog/story',
                'https://business.com/contact', 'https://www.business.com/']
        seen = []
        with patch.dict(os.environ, ENV):
            result = discover_customers(self.request(), call=lambda *args: {'results': [{'url': url, 'summary': 'Fabricated funded company'} for url in urls]},
                                        fetch_page=lambda url: seen.append(url) or PAGE)
        self.assertEqual(seen, ['https://business.com/'])
        self.assertEqual(len(result.accounts), 1)
        account = result.accounts[0]
        self.assertFalse(account.is_demo)
        self.assertEqual(account.contacts[0].verification_status, 'not_available')
        self.assertEqual(account.evidence[0].url, PAGE.url)
        self.assertNotIn('Fabricated', account.model_dump_json())

    def test_deepseek_query_bound_unicode_and_no_implicit_failover(self):
        captured = []
        with patch.dict(os.environ, {**ENV, 'CLIENTROVE_BRAVE_SEARCH_ENABLED': 'true', 'BRAVE_SEARCH_API_KEY': 'other'}):
            result = discover_customers(self.request(target='界' * 200, geography='é' * 120),
                                        call=lambda provider, endpoint, params: captured.append((provider, params)) or {'results': []})
            self.assertEqual(captured[0][0], 'deepseek')
            self.assertLessEqual(len(captured[0][1]['query']), 128)
            self.assertFalse(captured[0][1]['need_content'])
            self.assertEqual(result.accounts, [])
            def fail(*args):
                captured.append(args[0])
                raise ProviderError('Search unavailable')
            with self.assertRaises(ProviderError):
                discover_customers(self.request(), call=fail)
            self.assertEqual(captured[-1], 'deepseek')

    def test_brave_explicit_selection(self):
        with patch.dict(os.environ, {**ENV, 'CLIENTROVE_SEARCH_PROVIDER': 'brave', 'CLIENTROVE_BRAVE_SEARCH_ENABLED': 'true', 'BRAVE_SEARCH_API_KEY': 'test-only'}):
            calls = []
            result = discover_customers(self.request(), call=lambda *args: calls.append(args) or {'web': {'results': []}})
            self.assertEqual(calls[0][0], 'brave')
            self.assertEqual(result.accounts, [])

    def test_hunter_verifier_flags_not_confidence_define_verified(self):
        found = {'data': {'domain': 'business.com', 'accept_all': False, 'emails': [{'value': 'person@business.com', 'first_name': 'Alex',
                 'last_name': 'Lee', 'position': 'Founder', 'confidence': 100, 'sources': [{'uri': 'https://business.com/team'}]}]}}
        cases = [({'status': 'valid', 'email': 'person@business.com', 'accept_all': False, 'disposable': False, 'webmail': False}, 'verified'),
                 ({'status': 'valid', 'accept_all': True, 'disposable': False, 'webmail': False}, 'unverified'),
                 ({'status': 'unknown', 'accept_all': False, 'disposable': False, 'webmail': False}, 'unverified'),
                 ({'status': 'valid'}, 'unverified'),
                 ({'status': 'valid', 'email': 'someone@other.com', 'accept_all': False, 'disposable': False, 'webmail': False}, 'unverified')]
        for flags, expected in cases:
            with self.subTest(flags=flags), patch('app.customers.provider_json', side_effect=[found, {'data': flags}]):
                contact = enrich_contact('business.com', '2026-10-19T00:00:00Z').contact
                self.assertEqual(contact.verification_status, expected)
                self.assertEqual(contact.source_url, 'https://business.com/team')
        with patch('app.customers.provider_json', side_effect=[found, {'data': {'status': 'invalid'}}]):
            lookup = enrich_contact('business.com', 'today')
            self.assertIsNone(lookup.contact)
            self.assertEqual(lookup.rejected_email, 'person@business.com')
        with patch('app.customers.provider_json', return_value={'data': {'emails': [{'value': 'outsider@other.com'}]}}) as call:
            self.assertIsNone(enrich_contact('business.com', 'today').contact)
            self.assertEqual(call.call_count, 1)

    def test_hunter_rejected_email_cannot_return_as_public_unverified_fallback(self):
        page = Page('https://business.com/', 'Business accounting firms', 'Accounting services in Toronto.',
                    'Contact Bad@business.com or hello@business.com for accounting services in Toronto.')
        found = {'data': {'domain': 'business.com', 'emails': [{'value': 'bad@business.com'}]}}
        for rejected in ({'status': 'invalid'}, {'status': 'valid', 'result': 'undeliverable'}, {'status': 'valid', 'disposable': True}):
            with self.subTest(rejected=rejected), patch.dict(os.environ, {**ENV, 'CLIENTROVE_HUNTER_ENABLED': 'true', 'HUNTER_API_KEY': 'test-only'}), \
                 patch('app.customers.provider_json', side_effect=[found, {'data': rejected}]):
                result = discover_customers(self.request(), call=lambda *args: {'results': [{'url': page.url}]}, fetch_page=lambda url: page)
            contacts = result.accounts[0].contacts
            self.assertEqual([item.email for item in contacts], ['hello@business.com'])
            self.assertTrue(all(item.verification_status == 'unverified' for item in contacts))
            self.assertFalse(result.errors)
        one = Page(page.url, page.title, page.description, 'Contact bad@business.com for accounting services.')
        with patch.dict(os.environ, {**ENV, 'CLIENTROVE_HUNTER_ENABLED': 'true', 'HUNTER_API_KEY': 'test-only'}), \
             patch('app.customers.provider_json', side_effect=[found, {'data': {'status': 'invalid'}}]):
            result = discover_customers(self.request(), call=lambda *args: {'results': [{'url': one.url}]}, fetch_page=lambda url: one)
        self.assertTrue(all(item.email is None and item.verification_status == 'not_available' for item in result.accounts[0].contacts))
        self.assertIn('ineligible', result.accounts[0].contacts[0].note)

    def test_fixed_transport_redacts_secret_errors_and_blocks_redirect(self):
        observed = []
        def handler(request):
            observed.append(request)
            return httpx.Response(302, headers={'location': 'https://evil.com/?key=secret'}, text='secret body')
        with patch.dict(os.environ, ENV):
            with self.assertRaises(ProviderError) as error:
                provider_json('deepseek', 'search', {'query': 'accounting firms', 'count': 5, 'need_content': False}, cost=cost_context(self), transport=httpx.MockTransport(handler))
        self.assertEqual(len(observed), 1)
        self.assertEqual(observed[0].method, 'POST')
        self.assertNotIn('secret', str(error.exception))
        self.assertNotIn('test-only', str(error.exception))

    def test_hunter_http_logging_cannot_emit_key_bearing_url(self):
        with patch.dict(os.environ, {**ENV, 'HUNTER_API_KEY': 'test-only-private-value'}), \
             self.assertNoLogs('httpx', level='INFO'):
            self.assertEqual(provider_json('hunter', 'domain-search', {'domain': 'business.com', 'limit': 1}, cost=cost_context(self),
                transport=httpx.MockTransport(lambda request: httpx.Response(200, json={'data': {}}))), {'data': {}})

    def test_malformed_results_do_not_masquerade_as_empty_success(self):
        with patch.dict(os.environ, ENV):
            with self.assertRaises(ProviderError):
                discover_customers(self.request(), call=lambda *args: {'error': 'not a search response'})

    def test_store_idempotency_and_tenant_isolation(self):
        with tempfile.TemporaryDirectory() as tmp:
            first, other = Repository(Path(tmp) / 'state.db', 'one'), Repository(Path(tmp) / 'state.db', 'two')
            search, created = first.create_customer_search('repeat_123', 'accountants')
            self.assertTrue(created)
            same, created = first.create_customer_search('repeat_123', 'accountants')
            self.assertEqual(same.id, search.id)
            self.assertFalse(created)
            self.assertIsNone(other.customer_search(search.id))
            with self.assertRaises(ValueError): first.create_customer_search('another_123', 'accountants')

    def test_local_api_real_contract_without_live_provider_calls(self):
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ, ENV), TestClient(create_app(Path(tmp) / 'state.db', testing=True)) as client:
            client.put('/api/workspace/profile', json=DEMO_PROFILE.model_dump())
            with patch('app.main.discover_customers') as engine:
                from app.customers import DiscoveryResult
                engine.return_value = DiscoveryResult(accounts=[], errors=[], query='Accounting firms Toronto company')
                response = client.post('/api/customers/search', json={'target': 'Accounting firms', 'geography': 'Toronto', 'limit': 2, 'idempotency_key': 'api_request_123'})
                self.assertEqual(response.status_code, 200, response.text)
                search_id = response.json()['id']
                for _ in range(50):
                    result = client.get('/api/customers/searches/' + search_id)
                    if result.json()['status'] == 'complete': break
                    time.sleep(.01)
                self.assertEqual(result.json()['status'], 'complete')
                self.assertEqual(engine.call_count, 1)
                again = client.post('/api/customers/search', json={'target': 'Accounting firms', 'geography': 'Toronto', 'limit': 2, 'idempotency_key': 'api_request_123'})
                self.assertEqual(again.json()['id'], search_id)
                self.assertEqual(engine.call_count, 1)
            self.assertEqual(client.post('/api/customers/search', json={'target': 'x', 'limit': 30, 'idempotency_key': 'invalid'}).status_code, 422)

    def test_worker_new_routes_require_auth_and_never_return_credentials(self):
        token = 'test-only-worker-token-not-a-real-secret'
        with patch.dict(os.environ, {**ENV, 'SIGNALFOUNDRY_WORKER_TOKEN': token, 'SIGNALFOUNDRY_WORKER_URL': 'https://worker.company.com'}):
            with TestClient(create_worker(), base_url='https://worker.company.com') as client:
                self.assertEqual(client.post('/worker/customer-status', json={}).status_code, 401)
                response = client.post('/worker/customer-status', json={}, headers={'Authorization': 'Bearer ' + token})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()['discovery']['provider'], 'deepseek')
                self.assertNotIn('test-only', response.text)


if __name__ == '__main__':
    unittest.main()
