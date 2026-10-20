#!/usr/bin/env python3
"""Offline checks of the production-page smoke assertions; no services or DB."""
import unittest
from test_full_stack import assert_landing_page


LANDING = '''<!doctype html><html><body>
<a href="/">Clientrove.</a>
<a href="/sign-up?redirect_url=/workspace/setup">Sign up</a>
<a href="/sign-in?redirect_url=/workspace">Sign in</a>
<form aria-label="Start with your business website">
<label for="business-website">Your business website</label>
<input id="business-website" inputmode="url"><button>Get started</button>
</form></body></html>'''


class LandingAssertionsTest(unittest.TestCase):
    def test_current_brand_and_website_first_account_routes_pass(self):
        assert_landing_page(LANDING.encode())

    def test_stale_brand_or_brand_only_inside_hydration_script_fails(self):
        for body in [LANDING.replace('Clientrove.', 'SignalFoundry.'),
                     LANDING.replace('Clientrove.', '<script>"Clientrove"</script>')]:
            with self.subTest(body=body), self.assertRaisesRegex(AssertionError, 'brand'):
                assert_landing_page(body.encode())

    def test_missing_or_unusable_website_entry_fails(self):
        for body in [LANDING.replace('Start with your business website', 'Old campaign form'),
                     LANDING.replace('id="business-website"', 'id="another-field"'),
                     LANDING.replace('inputmode="url"', 'inputmode="numeric"')]:
            with self.subTest(body=body), self.assertRaisesRegex(AssertionError, 'website-first'):
                assert_landing_page(body.encode())

    def test_signup_or_signin_cannot_skip_its_intended_destination(self):
        for body in [LANDING.replace('/sign-up?redirect_url=/workspace/setup', '/sign-up'),
                     LANDING.replace('/sign-in?redirect_url=/workspace', '/sign-in')]:
            with self.subTest(body=body), self.assertRaisesRegex(AssertionError, 'Sign '):
                assert_landing_page(body.encode())


if __name__ == '__main__':
    unittest.main()
