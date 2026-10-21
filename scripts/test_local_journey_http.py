#!/usr/bin/env python3
"""Actual loopback HTTP + fresh SQLite manual journey. No providers or sending.

This is API integration evidence, not rendered Chrome/Next/auth acceptance.
All company/contact/profile values below are fictional isolated test data.
"""
from __future__ import annotations
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.request import ProxyHandler, Request, build_opener
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))


def run():
    from app.customers import qualify_customer
    from app.models import Profile
    from app.safety import Page
    from app.store import Repository
    with tempfile.TemporaryDirectory(prefix='clientrove-http-fictional-') as folder:
        path = Path(folder) / 'fictional.sqlite3'
        repo = Repository(path)
        profile = Profile(company_name='Fictional Repair SaaS', description='Software that helps property managers record repair requests.',
                          sender_name='Alex Fixture', mailing_address='100 Example Street, Toronto ON M5V 1A1', sender_contact='alex@example.org',
                          industries=['Property management'], company_sizes=[], geographies=['Canada'], buyer_roles=['Operations'], keywords=['property management'], exclusions=[])
        search, _ = repo.create_customer_search('fictional_http_seed', 'Property management')
        search.accounts = [qualify_customer(profile, Page(f'https://{domain}/', f'Fictional {index} Property Management',
                           'Property management services.', 'Property management services for businesses in Canada.'),
                           target='property management', geography='', search_id=search.id)
                           for index, domain in enumerate(('alpha.example.org', 'bravo.example.org'))]
        search.status, search.stage = 'complete', 'Fictional fixture complete'
        repo.save_customer_search(search)
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
        # Deliberately exclude owner provider/auth/billing variables and proxies.
        env = {key: os.environ[key] for key in ('PATH', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'LANG') if key in os.environ}
        env.update(PYTHONPATH=str(ROOT / 'backend'), PYTHONDONTWRITEBYTECODE='1',
                   SIGNALFOUNDRY_DB_PATH=str(path), SIGNALFOUNDRY_MODE='local-demo', DECISION_ENGINE='rules',
                   CLIENTROVE_DEEPSEEK_ENABLED='false', CLIENTROVE_DEEPSEEK_DRAFTS_ENABLED='false',
                   CLIENTROVE_HUNTER_ENABLED='false', CLIENTROVE_BRAVE_SEARCH_ENABLED='false')
        opener = build_opener(ProxyHandler({}))
        with tempfile.TemporaryFile() as logs:
            process = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', str(port),
                                        '--no-access-log', '--no-proxy-headers'], env=env, cwd=ROOT / 'backend', stdout=logs, stderr=logs)
            try:
                def request(method, route, body=None, expected=200):
                    headers = {'Content-Type': 'application/json'}
                    req = Request(f'http://127.0.0.1:{port}/api{route}', method=method, headers=headers,
                                  data=json.dumps(body).encode() if body is not None else None)
                    try:
                        response = opener.open(req, timeout=5)
                    except HTTPError as error:
                        response = error
                    with response:
                        assert response.status == expected, f'{method} {route}: expected {expected}, received {response.status}'
                        return json.load(response)

                deadline = time.monotonic() + 15
                while True:
                    try:
                        request('GET', '/health'); break
                    except URLError:
                        if process.poll() is not None or time.monotonic() >= deadline:
                            raise RuntimeError('Isolated fixture API failed to start; no private configuration was used.')
                        time.sleep(0.05)
                def fields(thread):
                    return {'expected_revision': thread['revision'], 'idempotency_key': 'fixture_' + uuid4().hex}
                def mutate(thread, route, body=None, method='POST', expected=200):
                    return request(method, f"/outreach/{thread['id']}/{route}", {**fields(thread), **(body or {})}, expected)
                def draft(thread, body='Could this help with your property operations?'):
                    thread = mutate(thread, 'draft', {'recipient': 'operations@' + thread['domain'], 'subject': 'A property workflow question',
                                                     'body': body + thread['sender_footer'], 'booking_link': ''}, 'PUT')
                    return mutate(thread, 'contact-basis', {'contact_basis': {'version': 1, 'published_email': thread['recipient'],
                        'source_url': 'https://' + thread['domain'] + '/contact', 'captured_at': datetime.now(timezone.utc).isoformat(),
                        'publisher_attribution': 'recipient', 'notice_status': 'clear', 'recipient_role': 'Operations team',
                        'message_relevance': 'Recording property maintenance requests', 'recipient_country': 'CA', 'recipient_timezone': 'UTC'}}, 'PUT')

                assert request('GET', '/workspace')['profile'] is None
                request('PUT', '/workspace/profile', profile.model_dump())
                assert request('GET', '/customers/engine')['monetary']['historical_usage_known'] is False
                request('POST', '/customers/search', {'target': 'Property managers', 'limit': 6, 'idempotency_key': 'fixture_invalid_limit'}, 422)
                threads = request('POST', '/outreach', {'search_id': search.id, 'account_ids': [a.id for a in search.accounts], 'idempotency_key': 'fixture_start_http'})['threads']
                first = threads[0]
                mutate(first, 'approve', expected=409)
                first = draft(first)
                first = mutate(first, 'approve')
                saved = request('GET', f"/outreach/{first['id']}")
                assert saved['ready_for_manual_action'] and not saved['messages'], 'Ready/read is not a sent event'
                approved = first['body']
                first = mutate(first, 'sent', {'sent_as': 'with_changes', 'actual_subject': 'Actual fixture subject', 'actual_body': 'Actual reported message.' + first['sender_footer']})
                assert first['messages'][-1]['approved_body'] == approved
                assert first['messages'][-1]['body'] != approved
                followup = datetime.now(timezone.utc) + timedelta(days=8)
                while followup.weekday() > 4: followup += timedelta(days=1)
                first = mutate(first, 'followups', {'subject': 'A brief reminder', 'body': 'One brief reminder.' + first['sender_footer'],
                              'scheduled_at': followup.isoformat(), 'scheduled_timezone': 'UTC'})
                assert not first['ready_for_manual_action']
                mutate(first, 'approve', expected=409)
                first = mutate(first, 'replies', {'body': 'Fictional automatic reply: away until next week.', 'reply_state': 'auto_reply',
                                                'revisit_at': followup.isoformat(), 'revisit_timezone': 'UTC'})
                assert first['next_followup_at'] is None and not first['approval']
                first = mutate(first, 'reply-state', {'reply_state': 'referral'}, 'PATCH')
                child = mutate(first, 'referrals', {'recipient': 'jordan@' + first['domain'], 'contact_name': 'Jordan Fixture',
                               'referrer_name': 'Original Fixture Contact', 'referrer_message_id': first['messages'][-1]['id']})
                assert child['id'] != first['id'] and not child['contact_basis'] and child['recipient_status'] == 'user_entered'
                child = mutate(child, 'replies', {'body': 'Please unsubscribe me.', 'reply_state': 'opt_out'})
                assert child['suppressed']
                assert request('GET', f"/outreach/{first['id']}")['suppressed'], 'Company stop survives across contacts'
                mutate(child, 'reply-state', {'reply_state': 'interested'}, 'PATCH')
                assert request('GET', f"/outreach/{child['id']}")['suppressed'], 'Status correction never clears an opt-out'

                second = mutate(draft(threads[1]), 'approve')
                second = mutate(second, 'sent')
                second = mutate(second, 'replies', {'body': 'Yes, let us discuss it.', 'reply_state': 'interested'})
                past = datetime.now(timezone.utc) - timedelta(hours=1)
                second = mutate(second, 'meeting', {'meeting_at': past.isoformat(), 'meeting_timezone': 'UTC'})
                queue = request('GET', '/outreach/next-up')['items']
                assert any(item['thread_id'] == second['id'] and item['action'] == 'report_meeting' for item in queue)
                second = mutate(second, 'outcomes', {'meeting_state': 'attended_reported', 'sale_state': 'not_recorded'}, 'PATCH')
                assert second['sale_state'] == 'not_recorded', 'Attendance is not a customer'
                second = mutate(second, 'outcomes', {'meeting_state': 'attended_reported', 'sale_state': 'won_reported'}, 'PATCH')
                insights = request('GET', '/outreach/insights')
                assert insights['funnel']['customers'] == 1 and insights['funnel']['meetings_held'] == 1
                assert request('GET', '/privacy/export')['format'] == 'clientrove-local-export-v1'
                assert len(request('GET', '/outreach')['threads']) == 3
                with repo.connect() as db:
                    assert db.execute('SELECT COUNT(*) FROM paid_attempts').fetchone()[0] == 0
                print('PASS: real loopback HTTP + isolated SQLite: saved setup, five-result bound, exact approval, distinct actual send, dated followup, OOO cancellation, fresh referral, sticky company opt-out, timed meeting, reported funnel, export and saved return. Zero paid attempts.')
                print('Not verified: rendered Next/Chrome, real auth, providers, email delivery, calendar, physical phone or accessibility.')
            finally:
                if process.poll() is None:
                    if os.name == 'nt':
                        subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
                    else: process.terminate()
                    process.wait(timeout=10)


if __name__ == '__main__':
    run()
