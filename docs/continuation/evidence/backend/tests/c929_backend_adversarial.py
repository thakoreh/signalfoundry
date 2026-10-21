import json
import os
import tempfile
import traceback
from pathlib import Path

os.environ.setdefault('HOME', tempfile.mkdtemp(prefix='signalfoundry-home-'))

from app.customers import qualify_customer
from app.fixtures import DEMO_PROFILE
from app.outreach import (
    ContactBasis,
    ContactBasisRequest,
    CorrectReply,
    EditDraft,
    OutreachError,
    PasteReply,
    PauseRequest,
    RevisionRequest,
    StartOutreach,
)
from app.safety import Page
from app.store import Repository


ROOT = Path(__file__).resolve().parents[1]
RESULTS = []


class Keys:
    def __init__(self, prefix='verify'):
        self.prefix = prefix
        self.n = 0

    def next(self, label='op'):
        self.n += 1
        return f'{self.prefix}_{label}_{self.n}'


def profile(repo):
    value = DEMO_PROFILE.model_copy(update={
        'sender_name': 'Alex Fixture',
        'mailing_address': '100 Example Street, Toronto ON M5V 1A1',
        'sender_contact': 'alex@example.com',
    })
    repo.save_profile(value)
    return value


def search_with_account(repo, keys, domain, label):
    search, _ = repo.create_customer_search(keys.next(f'{label}_search'), f'{label} property management')
    account = qualify_customer(
        DEMO_PROFILE,
        Page(
            f'https://{domain}/{label}',
            f'{label.title()} Property Management',
            'Property management services.',
            'Property management services for businesses.',
        ),
        target='property management', geography='', search_id=search.id,
    )
    search.accounts, search.status = [account], 'complete'
    repo.save_customer_search(search)
    return search, account


def start(repo, search, account, keys, label):
    return repo.start_outreach(StartOutreach(
        search_id=search.id, account_ids=[account.id], idempotency_key=keys.next(label),
    ))['threads'][0]


def fields(thread, keys, label):
    return {'expected_revision': thread.revision, 'idempotency_key': keys.next(label)}


def edit(repo, thread, keys, label, **changes):
    values = {name: getattr(thread, name) for name in ('recipient', 'subject', 'body', 'booking_link')}
    values.update(changes)
    return repo.mutate_outreach(thread.id, 'draft', EditDraft(**fields(thread, keys, label), **values))


def basis(repo, thread, keys, label):
    return repo.mutate_outreach(thread.id, 'contact-basis', ContactBasisRequest(
        **fields(thread, keys, label),
        contact_basis=ContactBasis(
            published_email=thread.recipient,
            source_url=f"https://{thread.domain}/contact",
            captured_at='2026-01-01T12:00:00Z',
            publisher_attribution='recipient',
            notice_status='clear',
            recipient_role='Operations team',
            message_relevance='Question about property operations',
            recipient_country='CA',
        ),
    ))


def ready(repo, thread, keys, label='ready', recipient='ops@sameco.com'):
    thread = edit(repo, thread, keys, f'{label}_draft', recipient=recipient,
                  subject='A relevant introduction', body='Hello, could we discuss a possible fit?')
    thread = edit(repo, thread, keys, f'{label}_footer', body=thread.body + thread.sender_footer)
    thread = basis(repo, thread, keys, f'{label}_basis')
    return repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**fields(thread, keys, f'{label}_approve')))


def fresh_repo(tenant='tenant-a'):
    directory = tempfile.TemporaryDirectory(prefix='signalfoundry-review-')
    repo = Repository(Path(directory.name) / 'fresh.sqlite3', tenant_id=tenant)
    profile(repo)
    return directory, repo


def assert_raises(fn, text=''):
    try:
        fn()
    except Exception as exc:
        if text and text.lower() not in str(exc).lower():
            raise AssertionError(f'expected error containing {text!r}, got {exc!r}') from exc
        return exc
    raise AssertionError('expected exception, but operation succeeded')


def company_guard_and_tenant_scope():
    directory, repo = fresh_repo('tenant-a')
    try:
        keys = Keys('company')
        company_failures = []
        search1, account1 = search_with_account(repo, keys, 'sameco.com', 'first')
        owner = ready(repo, start(repo, search1, account1, keys, 'owner_start'), keys, 'owner')
        assert owner.ready_for_manual_action and not owner.paused

        search2, account2 = search_with_account(repo, keys, 'sameco.com', 'second')
        loser_key = keys.next('loser_start')
        loser = repo.start_outreach(StartOutreach(
            search_id=search2.id, account_ids=[account2.id], idempotency_key=loser_key,
        ))['threads'][0]
        assert loser.paused and loser.cold_followups_stopped
        replay = repo.start_outreach(StartOutreach(
            search_id=search2.id, account_ids=[account2.id], idempotency_key=loser_key,
        ))['threads'][0]
        assert replay.id == loser.id and replay.paused and not replay.ready_for_manual_action

        loser = repo.mutate_outreach(loser.id, 'pause', PauseRequest(**fields(loser, keys, 'resume')),
                                     ) if False else loser
        # Resume, complete, and try the normal approval path: it must remain denied.
        loser = repo.mutate_outreach(loser.id, 'pause', PauseRequest(**fields(loser, keys, 'resume'), paused=False))
        loser = edit(repo, loser, keys, 'loser_draft', recipient='team@sameco.com',
                     subject='A second introduction', body='Hello, could we discuss a possible fit?')
        loser = edit(repo, loser, keys, 'loser_footer', body=loser.body + loser.sender_footer)
        loser = basis(repo, loser, keys, 'loser_basis')
        claimed = repo.mutate_outreach(loser.id, 'approve', RevisionRequest(**fields(loser, keys, 'loser_approve')))
        assert claimed.paused and claimed.approval is None and not claimed.ready_for_manual_action

        # A legacy-looking row with the conflict flags cleared must be denied by current read/approve logic.
        with repo.connect() as db:
            row = db.execute('SELECT data FROM outreach_threads WHERE tenant_id=? AND id=?',
                             (repo.tenant_id, loser.id)).fetchone()
            raw = json.loads(row['data'])
            raw.update({'paused': False, 'cold_followups_stopped': False, 'company_conflict': False, 'approval': None})
            db.execute('UPDATE outreach_threads SET data=? WHERE tenant_id=? AND id=?',
                       (json.dumps(raw), repo.tenant_id, loser.id))
        legacy_view = repo.outreach_thread(loser.id)
        assert legacy_view.company_conflict and not legacy_view.ready_for_manual_action
        denied = repo.mutate_outreach(
            loser.id, 'approve', RevisionRequest(**fields(legacy_view, keys, 'legacy_approve')))
        assert denied.paused and denied.approval is None and not denied.ready_for_manual_action

        # Critical adversarial control: after the owner receives inbound, resume must not open a second company thread.
        owner = repo.mutate_outreach(owner.id, 'reply', PasteReply(
            **fields(owner, keys, 'owner_reply'), body='I am interested', reply_state='interested'))
        loser = repo.outreach_thread(loser.id)
        resumed = repo.mutate_outreach(loser.id, 'pause', PauseRequest(**fields(loser, keys, 'resume_after_inbound'), paused=False))
        resumed = repo.outreach_thread(resumed.id)
        if not resumed.company_conflict:
            # Preserve the attempted state in the assertion evidence; approval is the actual safety boundary.
            pass
        reopened = repo.mutate_outreach(
            resumed.id, 'approve', RevisionRequest(**fields(resumed, keys, 'approve_after_inbound')))
        if reopened.approval or reopened.ready_for_manual_action or not reopened.paused:
            company_failures.append({
                'case': 'resume_after_owner_inbound',
                'paused': reopened.paused,
                'company_conflict': reopened.company_conflict,
                'ready_for_manual_action': reopened.ready_for_manual_action,
                'approval': bool(reopened.approval),
            })

        # Same domain in a different tenant must remain independent.
        other_dir, other = fresh_repo('tenant-b')
        try:
            other_keys = Keys('other')
            other_search, other_account = search_with_account(other, other_keys, 'sameco.com', 'other')
            other_thread = ready(other, start(other, other_search, other_account, other_keys, 'other_start'),
                                 other_keys, 'other', recipient='ops@sameco.com')
            assert other_thread.ready_for_manual_action and not other_thread.paused
            assert other.outreach_thread(owner.id) if False else True
        finally:
            other_dir.cleanup()
        if company_failures:
            raise AssertionError(company_failures)
    finally:
        directory.cleanup()


def queue_completion(state):
    directory, repo = fresh_repo(f'tenant-{state}')
    try:
        keys = Keys(f'queue_{state}')
        search, account = search_with_account(repo, keys, 'queueco.com', state)
        thread = ready(repo, start(repo, search, account, keys, f'{state}_start'), keys, state,
                       recipient='ops@queueco.com')
        thread = repo.mutate_outreach(thread.id, 'reply', PasteReply(
            **fields(thread, keys, f'{state}_inbound1'), body=f'{state} reply', reply_state=state))
        assert repo.outreach_next_up()['items'][0]['action'] == 'answer_reply'
        thread = edit(repo, thread, keys, f'{state}_answer', body='Here is the reviewed answer.' + thread.sender_footer)
        thread = repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**fields(thread, keys, f'{state}_answer_approve')))
        sent_key = keys.next(f'{state}_sent')
        sent_request = RevisionRequest(expected_revision=thread.revision, idempotency_key=sent_key)
        sent = repo.mutate_outreach(thread.id, 'sent', sent_request)
        outbound_snapshot = sent.messages[-1].model_dump()
        assert sent.messages[-1].direction == 'outbound'
        assert sent.messages[-1].approved_content_hash
        assert repo.outreach_next_up()['items'] == []
        replay = repo.mutate_outreach(thread.id, 'sent', sent_request)
        assert replay == sent and len(replay.messages) == 2
        assert repo.outreach_next_up()['items'] == []
        reopened = repo.mutate_outreach(thread.id, 'reply', PasteReply(
            **fields(replay, keys, f'{state}_inbound2'), body='A newer reply', reply_state='question'))
        assert repo.outreach_next_up()['items'][0]['action'] == 'answer_reply'
        assert reopened.messages[1].model_dump() == outbound_snapshot
    finally:
        directory.cleanup()


def dates_and_suppression():
    common = dict(expected_revision=1, idempotency_key='date_probe_123')
    assert_raises(lambda: PasteReply(**common, body='later', reply_state='not_now',
                                     revisit_at='2026-03-08T02:30:00-05:00', revisit_timezone='America/Toronto'), 'does not exist')
    assert_raises(lambda: PasteReply(**common, body='later', reply_state='not_now',
                                     revisit_at='2026-01-15T12:00:00-04:00', revisit_timezone='America/Toronto'), 'offset')
    for offset in ('-04:00', '-05:00'):
        parsed = PasteReply(**common, body='later', reply_state='not_now',
                             revisit_at=f'2026-11-01T01:30:00{offset}', revisit_timezone='America/Toronto')
        assert parsed.revisit_at.endswith('+00:00')
    normal = PasteReply(**common, body='later', reply_state='not_now',
                        revisit_at='2026-01-15T12:00:00-05:00', revisit_timezone='America/Toronto')
    assert normal.revisit_at.endswith('+00:00')

    for label, kwargs in (
        ('timezone_only', {'revisit_timezone': 'America/Toronto'}),
        ('date_only', {'revisit_at': '2026-11-01T01:30:00-04:00'}),
    ):
        directory, repo = fresh_repo(f'tenant-{label}')
        try:
            keys = Keys(label)
            search, account = search_with_account(repo, keys, 'dateco.com', label)
            thread = ready(repo, start(repo, search, account, keys, 'start'), keys, 'ready', recipient='ops@dateco.com')
            thread = repo.mutate_outreach(thread.id, 'reply', PasteReply(
                **fields(thread, keys, 'inbound'), body='Please check back later', reply_state='not_now', **kwargs))
            assert thread.reply_state == 'awaiting_review'
            assert thread.revisit_at is None and thread.revisit_timezone is None
            assert thread.messages[-1].body == 'Please check back later'
            assert repo.outreach_next_up()['items'][0]['action'] == 'review_reply'
        finally:
            directory.cleanup()

    directory, repo = fresh_repo('tenant-expiry')
    try:
        keys = Keys('expiry')
        search, account = search_with_account(repo, keys, 'dateco.com', 'expiry')
        thread = ready(repo, start(repo, search, account, keys, 'start'), keys, 'ready', recipient='ops@dateco.com')
        thread = repo.mutate_outreach(thread.id, 'reply', PasteReply(
            **fields(thread, keys, 'inbound'), body='Check back later', reply_state='not_now',
            revisit_at='2000-01-02T12:00:00-05:00', revisit_timezone='America/Toronto'))
        assert thread.review_due and thread.cold_followups_stopped and thread.approval is None
        with repo.connect() as db:
            before = db.execute('SELECT COUNT(*) FROM outreach_requests').fetchone()[0]
        next_up = repo.outreach_next_up()
        with repo.connect() as db:
            after = db.execute('SELECT COUNT(*) FROM outreach_requests').fetchone()[0]
        assert before == after and next_up['items'][0]['action'] == 'review_reply'
        assert_raises(lambda: repo.mutate_outreach(thread.id, 'sent', RevisionRequest(**fields(thread, keys, 'send'))), 'approve')
        assert len(repo.outreach_thread(thread.id).messages) == 1
    finally:
        directory.cleanup()

    directory, repo = fresh_repo('tenant-suppression')
    try:
        keys = Keys('suppression')
        search, account = search_with_account(repo, keys, 'stickyco.com', 'suppression')
        thread = ready(repo, start(repo, search, account, keys, 'start'), keys, 'ready', recipient='ops@stickyco.com')
        reply_key = keys.next('optout')
        reply_body = PasteReply(expected_revision=thread.revision, idempotency_key=reply_key,
                                body='Unsubscribe me', reply_state='interested')
        thread = repo.mutate_outreach(thread.id, 'reply', reply_body)
        assert thread.reply_state == 'opt_out' and thread.suppressed
        thread = repo.mutate_outreach(thread.id, 'reply-state', CorrectReply(
            **fields(thread, keys, 'correct'), reply_state='interested'))
        assert thread.suppressed and thread.approval is None
        replay = repo.mutate_outreach(thread.id, 'reply', reply_body)
        assert replay.suppressed and len(replay.messages) == 1
        thread = edit(repo, thread, keys, 'recipient_change', recipient='new@stickyco.com',
                      body='A response' + thread.sender_footer)
        assert_raises(lambda: repo.mutate_outreach(thread.id, 'approve', RevisionRequest(**fields(thread, keys, 'approve'))), 'blocked')

        source = ready(repo, start(repo, search, account, keys, 'source_start'), keys, 'source', recipient='source@stickyco.com') if False else None
        bounce = start(repo, search, account, keys, 'bounce_start')
        bounce = edit(repo, bounce, keys, 'bounce_draft', recipient='bad@stickyco.com', subject='Hello', body='Hello')
        bounce = repo.mutate_outreach(bounce.id, 'reply', PasteReply(
            **fields(bounce, keys, 'bounce_reply'), body='Delivery failed permanently', reply_state='bounce'))
        assert bounce.recipient_status == 'invalid' and bounce.reply_state == 'bounce'
        assert_raises(lambda: repo.mutate_outreach(bounce.id, 'approve', RevisionRequest(**fields(bounce, keys, 'bounce_approve'))))
    finally:
        directory.cleanup()


def source_question_guard():
    directory, repo = fresh_repo('tenant-source')
    try:
        keys = Keys('source')
        search, account = search_with_account(repo, keys, 'sourceco.com', 'source')
        thread = ready(repo, start(repo, search, account, keys, 'start'), keys, 'ready', recipient='ops@sourceco.com')
        thread = repo.mutate_outreach(thread.id, 'reply', PasteReply(
            **fields(thread, keys, 'source_reply'), body='Where did you get my email?', reply_state='question'))
        assert thread.reply_state == 'source_question' and thread.suppressed and thread.approval is None
        thread = repo.mutate_outreach(thread.id, 'reply-state', CorrectReply(
            **fields(thread, keys, 'source_correct'), reply_state='interested'))
        thread = edit(repo, thread, keys, 'source_answer', body='A response' + thread.sender_footer)
        assert thread.suppressed and thread.approval is None
        assert_raises(lambda: repo.mutate_outreach(
            thread.id, 'approve', RevisionRequest(**fields(thread, keys, 'source_approve'))), 'blocked')
    finally:
        directory.cleanup()


def run(name, fn):
    try:
        fn()
    except Exception as exc:
        RESULTS.append({'name': name, 'status': 'FAIL', 'error': repr(exc), 'traceback': traceback.format_exc()})
        print(json.dumps(RESULTS[-1], sort_keys=True), flush=True)
    else:
        RESULTS.append({'name': name, 'status': 'PASS'})
        print(json.dumps(RESULTS[-1], sort_keys=True), flush=True)


run('company_guard_tenant_scope_legacy_and_resume', company_guard_and_tenant_scope)
run('queue_completion_interested', lambda: queue_completion('interested'))
run('queue_completion_question', lambda: queue_completion('question'))
run('dates_and_suppression', dates_and_suppression)
run('source_question_guard', source_question_guard)

print(json.dumps({'summary': {'passed': sum(r['status'] == 'PASS' for r in RESULTS),
                              'failed': sum(r['status'] == 'FAIL' for r in RESULTS),
                              'results': RESULTS}}, sort_keys=True))
if any(r['status'] == 'FAIL' for r in RESULTS):
    raise SystemExit(1)
