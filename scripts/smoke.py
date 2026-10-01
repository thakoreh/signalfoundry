#!/usr/bin/env python3
"""End-to-end API check using a disposable fictional campaign.

Run only against your own private development instance. This initializes demo
profile data and writes a small campaign; it does not contact any lead provider.
"""
from __future__ import annotations
import argparse
import csv
import io
import json
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:8000')
    args = parser.parse_args()
    base = args.base_url.rstrip('/')
    checks: list[str] = []

    def call(method: str, path: str, body=None, expected=200):
        data = None if body is None else json.dumps(body).encode()
        request = Request(base + path, data=data, method=method,
                          headers={'Content-Type': 'application/json'})
        try:
            with urlopen(request, timeout=60) as response:
                status, raw = response.status, response.read()
        except HTTPError as exc:
            status, raw = exc.code, exc.read()
        assert status == expected, (method, path, status, raw.decode()[:1000])
        return json.loads(raw) if raw else None

    health = call('GET', '/api/health')
    assert health['status'] == 'ok' and health['mode'] == 'local-demo'
    checks.append('Health identifies local-demo mode')
    workspace = call('POST', '/api/demo/reset', {})
    assert workspace['profile']['company_name']
    checks.append('Fictional profile initialized')
    campaign = call('POST', '/api/campaigns', {
        'name': 'Verified demo walkthrough', 'mode': 'demo', 'domains': []
    }, expected=201)
    campaign_id = campaign['id']
    researched = call('POST', f'/api/campaigns/{campaign_id}/research', {})
    assert researched['status'] == 'complete', researched
    accounts = call('GET', f'/api/campaigns/{campaign_id}/accounts')
    assert len(accounts) >= 3
    assert accounts == sorted(accounts, key=lambda item: item['score'], reverse=True)
    assert all(a['is_demo'] and a['domain'].endswith('.example') for a in accounts)
    assert all(a['evidence'] for a in accounts)
    assert all(c['verification_status'] != 'verified' and c['email'] is None
               for a in accounts for c in a['contacts'])
    checks.append(f'Research persisted {len(accounts)} ranked, explicitly fictional accounts')
    account = accounts[0]
    detail = call('GET', f"/api/accounts/{account['id']}")
    assert detail['id'] == account['id']
    changed = call('PATCH', f"/api/accounts/{account['id']}", {'status': 'shortlisted'})
    assert changed['status'] == 'shortlisted'
    assert call('GET', f"/api/accounts/{account['id']}")['status'] == 'shortlisted'
    checks.append('Account detail and shortlist write/read round trip')
    draft = call('POST', f"/api/accounts/{account['id']}/draft", {})
    assert draft['engine'] == 'grounded_template' and draft['body'] and draft['basis']
    assert draft['warning']
    checks.append('Grounded draft returns basis and warning; no sending endpoint')
    with urlopen(base + f'/api/campaigns/{campaign_id}/export.csv') as response:
        rows = list(csv.DictReader(io.StringIO(response.read().decode('utf-8-sig'))))
    assert len(rows) == len(accounts)
    checks.append('CSV exports every campaign account')
    call('PATCH', f"/api/accounts/{account['id']}", {'status': 'invented'}, expected=422)
    call('POST', '/api/workspace/analyze', {'website': 'http://127.0.0.1'}, expected=422)
    call('GET', '/api/accounts/missing-account', expected=404)
    checks.append('Invalid statuses, localhost research, and missing accounts rejected')
    after = call('GET', '/api/workspace')
    assert after['profile'] == workspace['profile']
    checks.append('Failed research input preserves profile')
    print(json.dumps({'passed': len(checks), 'checks': checks, 'campaign_id': campaign_id}, indent=2))

if __name__ == '__main__':
    main()
