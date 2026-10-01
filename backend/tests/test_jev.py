import copy
import io
from unittest.mock import MagicMock, patch
import json
import unittest
import secrets
import httpx

from app.fixtures import DEMO_PROFILE
from app.jev import JevDecisionProvider, MODEL
from app.providers import ProviderNotConfigured, UnconfiguredContacts, UnconfiguredDiscovery
from app.safety import Page

PAGE = Page('https://company.com/', 'Public Company', 'Workflow automation',
            'B2B SaaS sales workflow automation and developer tools for VP Sales. Hiring now.')


def response_data():
    return {'model': MODEL, 'answers': {
        'qualification': {'type': 'choice', 'choice': 'fit', 'probabilities': {'fit': 0.8, 'not_fit': 0.1, 'unknown': 0.1}, 'confidence': 0.7},
        'fit_score': {'type': 'score', 'score': 3.5, 'legend': {str(i): str(i) for i in range(5)},
                      'probabilities': {'0': 0.0, '1': 0.0, '2': 0.0, '3': 0.5, '4': 0.5}, 'confidence': 0.6},
    }, 'usage': {'input_tokens': 100, 'output_tokens': 20}}


class JevTest(unittest.TestCase):
    def setUp(self):
        self.api_key = secrets.token_urlsafe(36)

    def test_no_key_never_calls_network(self):
        def fail(_):
            raise AssertionError('Network must not be called')
        provider = JevDecisionProvider(None, transport=httpx.MockTransport(fail))
        account = provider.evaluate(DEMO_PROFILE, PAGE, campaign_id='cmp_test')
        self.assertEqual(provider.name, 'rules')
        self.assertEqual(account.decision_engine, 'rules')
        self.assertIn('no server key', account.unknowns[0])

    def test_mocked_official_contract_and_expected_score_scale(self):
        calls = []
        def handler(request):
            calls.append(request)
            self.assertEqual(str(request.url), 'https://api.typesafe.ai/v1/systemone')
            self.assertEqual(request.headers['Authorization'], f'Bearer {self.api_key}')
            body = json.loads(request.content)
            self.assertEqual(body['model'], MODEL)
            self.assertEqual(body['questions']['fit_score']['type'], 'score')
            self.assertEqual(len(body['questions']['fit_score']['criteria']), 5)
            self.assertEqual(body['state']['website']['url'], PAGE.url)
            return httpx.Response(200, json=response_data())
        provider = JevDecisionProvider(self.api_key, transport=httpx.MockTransport(handler))
        account = provider.evaluate(DEMO_PROFILE, PAGE, campaign_id='cmp_test')
        self.assertEqual(len(calls), 1)
        self.assertEqual(account.decision_engine, 'jev')
        self.assertEqual(account.score, 88)
        self.assertIn('0.60', account.unknowns[0])
        self.assertEqual(account.employee_range, 'Unknown')
        self.assertTrue(all(c.email is None for c in account.contacts))

    def test_not_fit_qualification_overrides_high_fit_score(self):
        data = response_data()
        data['answers']['qualification'].update(
            choice='not_fit', probabilities={'fit': 0.05, 'not_fit': 0.9, 'unknown': 0.05})
        raw = json.dumps(data).encode()
        provider = JevDecisionProvider(
            self.api_key,
            transport=httpx.MockTransport(lambda _: httpx.Response(200, content=raw)),
        )

        account = provider.evaluate(DEMO_PROFILE, PAGE, campaign_id='cmp_test')

        self.assertEqual(account.decision_engine, 'jev')
        self.assertEqual(account.score, 0)
        self.assertEqual(account.score_breakdown[0].points, 0)
        self.assertEqual(account.confidence, 'low')

    def test_sparse_probability_maps_are_accepted_as_zero_filled(self):
        data = response_data()
        data['answers']['qualification'].update(choice='fit', probabilities={'fit': 1.0})
        data['answers']['fit_score'].update(score=4.0, probabilities={'4': 1.0})
        raw = json.dumps(data).encode()
        provider = JevDecisionProvider(
            self.api_key,
            transport=httpx.MockTransport(lambda _: httpx.Response(200, content=raw)),
        )

        account = provider.evaluate(DEMO_PROFILE, PAGE, campaign_id='cmp_test')

        self.assertEqual(account.decision_engine, 'jev')
        self.assertEqual(account.score, 100)

    def test_usage_is_strictly_typed_and_bounded(self):
        for usage in ({'input_tokens': 100, 'output_tokens': 20, 'unexpected': 1},
                      {'input_tokens': -1, 'output_tokens': 20},
                      {'input_tokens': 100}):
            with self.subTest(usage=usage):
                data = response_data()
                data['usage'] = usage
                raw = json.dumps(data).encode()
                provider = JevDecisionProvider(
                    self.api_key,
                    transport=httpx.MockTransport(lambda _: httpx.Response(200, content=raw)),
                )

                account = provider.evaluate(DEMO_PROFILE, PAGE, campaign_id='cmp_test')

                self.assertEqual(account.decision_engine, 'rules')
                self.assertIn('Rules fallback used', account.unknowns[0])

    def test_low_model_confidence_is_exposed_and_downgrades_account(self):
        data = response_data()
        data['answers']['qualification']['confidence'] = 0.2
        data['answers']['fit_score']['confidence'] = 0.3
        raw = json.dumps(data).encode()
        provider = JevDecisionProvider(
            self.api_key,
            transport=httpx.MockTransport(lambda _: httpx.Response(200, content=raw)),
        )

        account = provider.evaluate(DEMO_PROFILE, PAGE, campaign_id='cmp_test')

        self.assertEqual(account.decision_engine, 'jev')
        self.assertEqual(account.confidence, 'low')
        self.assertLess(account.score, 65)
        self.assertIn('review', account.score_breakdown[0].reason.lower())
        self.assertIn('qualification 0.20', account.unknowns[0])
        self.assertIn('fit score 0.30', account.unknowns[0])

    def test_malformed_out_of_range_nonfinite_and_unknown_model_fallback(self):
        cases = []
        data = response_data(); data['answers']['fit_score']['score'] = 9.0; cases.append(data)
        data = response_data(); data['answers']['fit_score']['score'] = float('nan'); cases.append(data)
        data = response_data(); data['answers']['fit_score']['confidence'] = 5.0; cases.append(data)
        data = response_data(); data['answers']['qualification']['probabilities']['fit'] = -0.1; cases.append(data)
        data = response_data(); data['answers']['qualification']['probabilities']['fit'] = 0.4; cases.append(data)
        data = response_data(); data['answers']['fit_score']['score'] = 2.0; cases.append(data)
        data = response_data(); data['model'] = 'unrecognized'; cases.append(data)
        data = response_data(); data['answers']['invented'] = {}; cases.append(data)
        for data in cases:
            with self.subTest(data=data):
                raw = json.dumps(data).encode()
                provider = JevDecisionProvider(self.api_key, transport=httpx.MockTransport(lambda _: httpx.Response(200, content=raw)))
                account = provider.evaluate(DEMO_PROFILE, PAGE, campaign_id='cmp_test')
                self.assertEqual(account.decision_engine, 'rules')
                self.assertIn('Rules fallback used', account.unknowns[0])

    def test_http_errors_fallback_without_retry(self):
        for status in [301, 401, 422, 429, 529]:
            calls = []
            def handler(request):
                calls.append(request)
                return httpx.Response(status)
            provider = JevDecisionProvider(self.api_key, transport=httpx.MockTransport(handler))
            account = provider.evaluate(DEMO_PROFILE, PAGE, campaign_id='cmp_test')
            self.assertEqual(account.decision_engine, 'rules')
            self.assertIn(str(status), account.unknowns[0])
            self.assertEqual(len(calls), 1)

    def test_timeout_fallback(self):
        def handler(request):
            raise httpx.ReadTimeout('timeout')
        provider = JevDecisionProvider(self.api_key, transport=httpx.MockTransport(handler))
        account = provider.evaluate(DEMO_PROFILE, PAGE, campaign_id='cmp_test')
        self.assertEqual(account.decision_engine, 'rules')
        self.assertIn('timeout', account.unknowns[0])

    def test_oversized_response_fallback(self):
        provider = JevDecisionProvider(self.api_key, transport=httpx.MockTransport(lambda _: httpx.Response(200, content=b'x' * 100001)))
        self.assertEqual(provider.evaluate(DEMO_PROFILE, PAGE, campaign_id='cmp_test').decision_engine, 'rules')

    def test_live_transport_is_pinned_and_deadline_bounded_without_network(self):
        raw = json.dumps(response_data()).encode()
        response = MagicMock()
        response.status = 200
        response.getheader.return_value = 'identity'
        body = io.BytesIO(raw)
        response.read1.side_effect = body.read
        connection = MagicMock()
        connection.getresponse.return_value = response
        with patch('app.jev.resolve_public', return_value=['8.8.8.8']) as resolver, patch('app.jev.PinnedHTTPSConnection', return_value=connection) as factory:
            account = JevDecisionProvider(self.api_key).evaluate(DEMO_PROFILE, PAGE, campaign_id='cmp_test')
        self.assertEqual(account.decision_engine, 'jev')
        resolver.assert_called_once_with('api.typesafe.ai', 443, 2.0)
        self.assertEqual(factory.call_args.args[:3], ('api.typesafe.ai', '8.8.8.8', 443))
        connection.close.assert_called_once()
        response.close.assert_called_once()
        self.assertEqual(connection.request.call_args.args[:2], ('POST', '/v1/systemone'))

    def test_provider_total_deadline_falls_back(self):
        connection = MagicMock()
        response = MagicMock()
        response.status = 200
        response.getheader.return_value = 'identity'
        connection.getresponse.return_value = response
        with patch('app.jev.resolve_public', return_value=['8.8.8.8']), patch('app.jev.PinnedHTTPSConnection', return_value=connection), patch('app.jev.time.monotonic', side_effect=[0, 1, 9]):
            account = JevDecisionProvider(self.api_key).evaluate(DEMO_PROFILE, PAGE, campaign_id='cmp_test')
        self.assertEqual(account.decision_engine, 'rules')
        self.assertIn('timeout', account.unknowns[0])
        response.read1.assert_not_called()
        connection.close.assert_called_once()

    def test_provider_seams_explicitly_unconfigured(self):
        with self.assertRaises(ProviderNotConfigured):
            UnconfiguredDiscovery().discover(DEMO_PROFILE, 10)
        with self.assertRaises(ProviderNotConfigured):
            UnconfiguredContacts().contacts('company.com')


if __name__ == '__main__':
    unittest.main()
