#!/usr/bin/env python3
"""Create a NEW fictional review workspace. Never opens an existing database.

No web/provider calls, real contacts, keys, spending, email or account connection.
The historical reports below are explicitly manufactured review fixtures.
"""
import argparse
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))


def seed(path):
    from app.customers import qualify_customer
    from app.models import Contact, Profile
    from app.outreach import ContactBasis, ContactBasisRequest, EditDraft, MeetingRequest, PasteReply, RevisionRequest, ScheduledDraft, SentRequest, StartOutreach
    from app.primitives import new_id
    from app.safety import Page
    from app.store import Repository
    path = Path(path).absolute()
    if not path.parent.is_dir() or path.exists() or path.is_symlink():
        raise ValueError('Choose a NEW database in an existing private review directory. Existing data is never opened or overwritten.')
    path.touch(mode=0o600, exist_ok=False)
    repo = Repository(path)
    current = datetime.now(timezone.utc)
    profile = Profile(company_name='FICTIONAL REVIEW · Repair SaaS', description='Fictional test software helping property managers record maintenance requests. Every prospect, message and outcome in this database is a manufactured review fixture, not customer evidence.',
                      sender_name='Alex Fixture', mailing_address='100 Example Street, Toronto ON M5V 1A1', sender_contact='alex@example.org',
                      industries=['Property management'], company_sizes=[], geographies=['Canada'], buyer_roles=['Operations'], keywords=['property management'], exclusions=[])
    repo.save_profile(profile)
    search, _ = repo.create_customer_search('fictional_review_search', 'Property managers')
    accounts = []
    for label in ('Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'):
        domain = label.lower() + '.example.org'
        account = qualify_customer(profile, Page('https://' + domain + '/', 'FICTIONAL ' + label + ' Property Management',
                    'Property management services.', 'Fictional property management services for businesses in Canada.'),
                    target='property management', geography='', search_id=search.id)
        account.contacts = [Contact(name='Fictional Operations Contact', role='Operations', email='operations@' + domain,
                            verification_status='unverified', source_url='https://' + domain + '/contact', note='Manufactured fixture address; never contact it.')]
        accounts.append(account)
    search.accounts, search.status, search.stage = accounts, 'complete', 'Fictional review fixture complete'
    repo.save_customer_search(search)
    threads = repo.start_outreach(StartOutreach(search_id=search.id, account_ids=[a.id for a in accounts], idempotency_key='fictional_review_start'))['threads']
    def fields(thread): return {'expected_revision': thread.revision, 'idempotency_key': new_id('fixture')}
    for index, thread in enumerate(threads):
        thread = repo.mutate_outreach(thread.id, 'draft', EditDraft(**fields(thread), recipient=thread.recipient,
            subject='A fictional property workflow question', body='Your saved example describes property management services. Our fictional software records maintenance requests. Would this be relevant to your operations team?' + thread.sender_footer))
        thread = repo.mutate_outreach(thread.id, 'contact-basis', ContactBasisRequest(**fields(thread), contact_basis=ContactBasis(
            published_email=thread.recipient, source_url='https://' + thread.domain + '/contact', captured_at=(current - timedelta(days=30)).isoformat(),
            publisher_attribution='recipient', notice_status='clear', recipient_role='Fictional operations team',
            message_relevance='Manufactured fixture for maintenance software review, not actual permission.', recipient_country='CA', recipient_timezone='UTC')))
        if not index: continue  # Pending initial review.
        thread = repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**fields(thread)))
        earlier = current - timedelta(days=14)
        with patch('app.outreach.now', return_value=earlier.isoformat()):
            thread = repo.mutate_outreach(thread.id, 'sent', SentRequest(**fields(thread)))
        if index == 1:
            due = current - timedelta(days=3)
            while due.weekday() > 4: due -= timedelta(days=1)
            with patch('app.outreach.datetime', wraps=datetime) as clock:
                clock.now.return_value = earlier
                repo.mutate_outreach(thread.id, 'followup', ScheduledDraft(**fields(thread), subject='Fictional reminder',
                    body='A brief fictional reminder about maintenance request software. Would it be useful to discuss?' + thread.sender_footer,
                    scheduled_at=due.isoformat(), scheduled_timezone='UTC'))
        elif index == 2:
            repo.mutate_outreach(thread.id, 'reply', PasteReply(**fields(thread), body='FICTIONAL reply: how does the maintenance workflow work?', reply_state='question'))
        elif index == 3:
            repo.mutate_outreach(thread.id, 'reply', PasteReply(**fields(thread), body='FICTIONAL automatic reply: away for the next week.', reply_state='auto_reply',
                revisit_at=(current + timedelta(days=7)).isoformat(), revisit_timezone='UTC'))
        else:
            thread = repo.mutate_outreach(thread.id, 'reply', PasteReply(**fields(thread), body='FICTIONAL reply: yes, let us meet.', reply_state='interested'))
            repo.mutate_outreach(thread.id, 'meeting', MeetingRequest(**fields(thread), meeting_at=(current - timedelta(hours=1)).isoformat(), meeting_timezone='UTC'))
    return {'home': '/workspace', 'results': '/workspace/customers/' + search.id, 'outreach': '/workspace/outreach/' + search.id}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', type=Path, required=True)
    parser.add_argument('--fictional-only', required=True, action='store_true')
    args = parser.parse_args()
    try:
        paths = seed(args.db)
    except (ValueError, OSError):
        print('Review fixture not created. Use a new explicit path; existing data was not opened.', file=sys.stderr)
        return 1
    print('FICTIONAL ONLY: five manufactured companies, historical reports and dates. No customer/demand/delivery evidence. Zero provider calls.')
    for name, value in paths.items(): print(name + ': ' + value)
    return 0


if __name__ == '__main__': raise SystemExit(main())
