"""Local conversation review ledger. All delivery and outcomes are user reports.

There is deliberately no inbox, transport, calendar or paid-provider dependency.
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from urllib.parse import urlsplit
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException
from pydantic import Field, StringConstraints, field_validator

from .models import EmptyRequest, StrictModel, Workspace
from .primitives import new_id, now
from .safety import FetchError, normalize_url

Key = Annotated[str, StringConstraints(pattern=r'^[A-Za-z0-9_-]{8,128}$')]
Identifier = Annotated[str, StringConstraints(pattern=r'^[A-Za-z0-9_-]{1,128}$')]
ReplyState = Literal['awaiting_review', 'interested', 'question', 'not_now', 'not_interested', 'opt_out', 'uncertain']
MeetingState = Literal['not_recorded', 'booked_reported', 'attended_reported', 'no_show_reported', 'cancelled_reported']
SaleState = Literal['not_recorded', 'won_reported', 'lost_reported']


class OutreachError(ValueError):
    def __init__(self, message, status=409):
        super().__init__(message)
        self.status = status


class StartOutreach(StrictModel):
    search_id: Identifier
    account_ids: list[Identifier] = Field(min_length=1, max_length=5)
    idempotency_key: Key

    @field_validator('account_ids')
    @classmethod
    def unique_accounts(cls, value):
        if len(set(value)) != len(value):
            raise ValueError('Choose each customer only once')
        return value


class RevisionRequest(StrictModel):
    expected_revision: int = Field(ge=1, le=1_000_000)
    idempotency_key: Key


class EditDraft(RevisionRequest):
    recipient: Annotated[str, StringConstraints(strip_whitespace=True, max_length=320)]
    subject: Annotated[str, StringConstraints(strip_whitespace=True, max_length=160)]
    body: Annotated[str, StringConstraints(strip_whitespace=True, max_length=6000)]
    booking_link: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2048)] = ''

    @field_validator('recipient')
    @classmethod
    def email(cls, value):
        if value and not re.fullmatch(r'[A-Za-z0-9.!#$%&\'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?\.[A-Za-z]{2,63}', value):
            raise ValueError('Enter one plain email address without a display name')
        if value:
            local, domain = value.rsplit('@', 1)
            if local.startswith('.') or local.endswith('.') or '..' in local:
                raise ValueError('Enter one valid plain email address')
            try:
                normalize_url('https://' + domain)
            except FetchError:
                raise ValueError('Use a public email domain') from None
        return value

    @field_validator('subject')
    @classmethod
    def one_line(cls, value):
        if '\n' in value or '\r' in value:
            raise ValueError('Subject must be one line')
        return value

    @field_validator('booking_link')
    @classmethod
    def public_link(cls, value):
        if value:
            try:
                value = normalize_url(value)
            except FetchError:
                raise ValueError('Use a public booking-page URL without credentials') from None
            if not value.startswith('https://'):
                raise ValueError('Use a public HTTPS booking-page URL')
        return value


class ContactBasis(StrictModel):
    version: Literal[1] = 1
    published_email: Annotated[str, StringConstraints(strip_whitespace=True, max_length=320)] = ''
    source_url: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2048)] = ''
    captured_at: str = ''
    publisher_attribution: Literal['recipient', 'caused_by_recipient', 'third_party', 'unknown'] = 'unknown'
    notice_status: Literal['clear', 'prohibits', 'unknown'] = 'unknown'
    recipient_role: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] = ''
    message_relevance: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] = ''
    recipient_country: Literal['US', 'CA', 'unknown', 'other'] = 'unknown'
    recipient_timezone: str | None = None
    basis_type: Literal['conspicuous_publication'] = 'conspicuous_publication'

    @field_validator('source_url')
    @classmethod
    def source(cls, value):
        if value:
            try:
                value = normalize_url(value)
            except FetchError:
                raise ValueError('Use a public HTTP(S) source URL without credentials') from None
        return value

    @field_validator('captured_at')
    @classmethod
    def observed(cls, value):
        if value:
            timestamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
            if timestamp.tzinfo is None or timestamp.utcoffset() is None:
                raise ValueError('Observation time must include a timezone')
            if timestamp > datetime.now(timezone.utc) + timedelta(minutes=5):
                raise ValueError('Observation time cannot be in the future (5 minute clock tolerance)')
            value = timestamp.astimezone(timezone.utc).isoformat()
        return value

    @field_validator('recipient_timezone')
    @classmethod
    def zone(cls, value):
        if value:
            try:
                ZoneInfo(value)
            except (ZoneInfoNotFoundError, ValueError):
                raise ValueError('Use an IANA timezone or leave unknown') from None
        return value or None


class ContactBasisRequest(RevisionRequest):
    contact_basis: ContactBasis | None


class SentRequest(RevisionRequest):
    sent_as: Literal['approved', 'with_changes'] = 'approved'
    actual_subject: Annotated[str, StringConstraints(strip_whitespace=True, max_length=160)] = ''
    actual_body: Annotated[str, StringConstraints(strip_whitespace=True, max_length=10000)] = ''


class PasteReply(RevisionRequest):
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=6000)]
    reply_state: ReplyState = 'awaiting_review'


class CorrectReply(RevisionRequest):
    reply_state: ReplyState


class PauseRequest(RevisionRequest):
    paused: bool


class OutcomesRequest(RevisionRequest):
    meeting_state: MeetingState
    sale_state: SaleState


class Approval(StrictModel):
    content_hash: str
    approved_at: str
    revision: int


class ConversationMessage(StrictModel):
    id: str
    direction: Literal['inbound', 'outbound']
    recipient: str
    subject: str
    body: str
    booking_link: str = ''
    approved_content_hash: str | None = None
    approved_subject: str | None = None
    approved_body: str | None = None
    sent_as: Literal['approved', 'with_changes'] | None = None
    source: Literal['user_reported'] = 'user_reported'
    reply_state: ReplyState | None
    created_at: str


class OutreachThread(StrictModel):
    id: str
    search_id: str
    account_id: str
    company_name: str
    domain: str
    recipient: str = ''
    recipient_status: Literal['missing', 'verified', 'published_unverified', 'user_entered'] = 'missing'
    subject: str = ''
    body: str = ''
    booking_link: str = ''
    sender_footer: str = ''
    contact_basis: ContactBasis | None = None
    paused: bool = False
    suppressed: bool = False
    suppression_reason: str | None = None
    reply_state: ReplyState = 'awaiting_review'
    revision: int = 1
    approval: Approval | None = None
    ready_for_manual_action: bool = False
    messages: list[ConversationMessage] = Field(default_factory=list, max_length=50)
    meeting_state: MeetingState = 'not_recorded'
    sale_state: SaleState = 'not_recorded'
    created_at: str
    updated_at: str


def content_hash(thread: OutreachThread) -> str:
    inbound = next((m.id for m in reversed(thread.messages) if m.direction == 'inbound'), None)
    data = [thread.recipient, thread.subject, thread.body, thread.booking_link, inbound,
            thread.contact_basis.model_dump() if thread.contact_basis else None]
    return hashlib.sha256(json.dumps(data, ensure_ascii=True).encode()).hexdigest()


def contact_basis_ready(thread: OutreachThread) -> bool:
    basis = thread.contact_basis
    return bool(basis and basis.published_email.lower() == thread.recipient.lower()
                and thread.recipient and basis.source_url and basis.captured_at
                and basis.publisher_attribution in ('recipient', 'caused_by_recipient')
                and basis.notice_status == 'clear' and basis.recipient_role and basis.message_relevance
                and basis.recipient_country in ('US', 'CA'))


def blocked(thread: OutreachThread) -> bool:
    has_reply = any(m.direction == 'inbound' for m in thread.messages)
    return thread.suppressed or thread.paused or (has_reply and thread.reply_state not in ('interested', 'question'))


def sender_footer(profile) -> str:
    if not profile or not all((profile.sender_name, profile.company_name, profile.mailing_address, profile.sender_contact)):
        return ''
    contact = profile.sender_contact
    email = re.fullmatch(r"[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}", contact)
    phone = re.fullmatch(r'\+?[0-9 ()-]{7,30}', contact) and len(re.sub(r'\D', '', contact)) >= 7
    web = False
    if contact.startswith('https://'):
        try:
            web = normalize_url(contact).startswith('https://')
        except FetchError:
            pass
    if not (email or phone or web):
        return ''
    return (f'\n\n--\n{profile.sender_name} | {profile.company_name}\n{profile.mailing_address}\n'
            f'Contact: {profile.sender_contact}\nTo opt out, reply "unsubscribe".')


def domain_target(domain):
    host = urlsplit(domain if '://' in domain else 'https://' + domain).hostname or domain
    return 'domain:' + host.rstrip('.').lower().removeprefix('www.')


def request_hash(operation, body):
    return hashlib.sha256(json.dumps([operation, body.model_dump()], sort_keys=True).encode()).hexdigest()


class OutreachStore:
    def __init__(self, repository):
        self.repo = repository
        self.tenant = repository.tenant_id

    def _view(self, db, thread):
        workspace = Workspace.model_validate_json(db.execute('SELECT data FROM workspaces WHERE tenant_id=?', (self.tenant,)).fetchone()['data'])
        thread.sender_footer = sender_footer(workspace.profile)
        suppression = db.execute('SELECT reason FROM outreach_suppressions WHERE tenant_id=? AND (target=? OR target=?) LIMIT 1',
                                 (self.tenant, domain_target(thread.domain), 'email:' + thread.recipient.lower())).fetchone()
        if suppression:
            thread.suppressed, thread.suppression_reason = True, suppression['reason']
        if blocked(thread) or not contact_basis_ready(thread) or not thread.sender_footer or not thread.body.endswith(thread.sender_footer):
            thread.approval = None
        thread.ready_for_manual_action = bool(not blocked(thread) and thread.recipient and thread.subject and thread.body and
                                               thread.approval and thread.approval.content_hash == content_hash(thread))
        return thread

    def _get(self, db, thread_id):
        row = db.execute('SELECT data FROM outreach_threads WHERE tenant_id=? AND id=?', (self.tenant, thread_id)).fetchone()
        if not row:
            raise OutreachError('Conversation not found', 404)
        return self._view(db, OutreachThread.model_validate_json(row['data']))

    def _save(self, db, thread):
        thread = self._view(db, thread)
        db.execute('UPDATE outreach_threads SET data=? WHERE tenant_id=? AND id=?', (thread.model_dump_json(), self.tenant, thread.id))
        return thread

    def _replay(self, db, operation, body):
        prior = db.execute('SELECT fingerprint,resource_ids FROM outreach_requests WHERE tenant_id=? AND request_key=?',
                           (self.tenant, body.idempotency_key)).fetchone()
        if prior:
            fingerprints = {request_hash(operation, body)}
            # Before changed-send reports, /sent accepted only RevisionRequest.
            # Honor that fingerprint only for identical approved-send semantics;
            # never drop changed text or its mode from an idempotency binding.
            if (operation.startswith('sent:') and isinstance(body, SentRequest)
                    and body.sent_as == 'approved' and not body.actual_subject and not body.actual_body):
                legacy = RevisionRequest(expected_revision=body.expected_revision, idempotency_key=body.idempotency_key)
                fingerprints.add(request_hash(operation, legacy))
            if prior['fingerprint'] not in fingerprints:
                raise OutreachError('This request key was already used for different changes')
            return [self._get(db, value) for value in json.loads(prior['resource_ids'])]
        # Bounded local ledger admission, including cached/replayed creates.
        count = db.execute('SELECT COUNT(*) FROM outreach_requests WHERE tenant_id=?', (self.tenant,)).fetchone()[0]
        if count >= 10_000:
            raise OutreachError('This local review ledger has reached its operation allowance', 429)
        return None

    def _record(self, db, operation, body, threads):
        db.execute('INSERT INTO outreach_requests VALUES (?,?,?,?,?)',
                   (self.tenant, body.idempotency_key, request_hash(operation, body), json.dumps([t.id for t in threads]), now()))

    def list(self, search_id=None):
        with self.repo.connect() as db:
            if search_id:
                rows = db.execute('SELECT data FROM outreach_threads WHERE tenant_id=? AND search_id=? ORDER BY rowid LIMIT 5',
                                  (self.tenant, search_id)).fetchall()
            else:
                rows = db.execute('SELECT data FROM outreach_threads WHERE tenant_id=? ORDER BY rowid DESC LIMIT 100', (self.tenant,)).fetchall()
            threads = [self._view(db, OutreachThread.model_validate_json(row['data'])) for row in rows]
        if search_id:
            return {'threads': threads}
        fields = ('id', 'search_id', 'account_id', 'company_name', 'domain', 'recipient', 'reply_state', 'paused', 'suppressed',
                  'ready_for_manual_action', 'meeting_state', 'sale_state', 'updated_at')
        return {'threads': [{name: getattr(t, name) for name in fields} for t in threads]}

    def get(self, thread_id):
        with self.repo.connect() as db:
            return self._get(db, thread_id)

    def start(self, body: StartOutreach):
        from .customers import CustomerSearch, customer_is_qualified
        from .customer_drafts import draft_cache_key
        from .models import Workspace
        with self.repo.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            replay = self._replay(db, 'start', body)
            if replay is not None:
                return {'threads': replay}
            row = db.execute('SELECT data FROM customer_searches WHERE tenant_id=? AND id=?', (self.tenant, body.search_id)).fetchone()
            if not row:
                raise OutreachError('Customer search not found', 404)
            search = CustomerSearch.model_validate_json(row['data'])
            if search.status not in ('complete', 'partial'):
                raise OutreachError('Wait for customer research to finish')
            accounts = {a.id: a for a in search.accounts}
            if any(account_id not in accounts or not customer_is_qualified(accounts[account_id]) for account_id in body.account_ids):
                raise OutreachError('Choose only researched customers with clear fit evidence', 422)
            workspace = Workspace.model_validate_json(db.execute('SELECT data FROM workspaces WHERE tenant_id=?', (self.tenant,)).fetchone()['data'])
            threads = []
            for account_id in body.account_ids:
                old = db.execute('SELECT id FROM outreach_threads WHERE tenant_id=? AND search_id=? AND account_id=?',
                                 (self.tenant, body.search_id, account_id)).fetchone()
                if old:
                    threads.append(self._get(db, old['id']))
                    continue
                count = db.execute('SELECT COUNT(*) FROM outreach_threads WHERE tenant_id=?', (self.tenant,)).fetchone()[0]
                if count >= 100:
                    raise OutreachError('This local workspace is limited to 100 conversations', 429)
                account = accounts[account_id]
                timestamp = now()
                thread = OutreachThread(id=new_id('outreach'), search_id=body.search_id, account_id=account.id,
                                        company_name=account.name, domain=account.domain, created_at=timestamp, updated_at=timestamp)
                contacts = sorted((c for c in account.contacts if c.email), key=lambda c: c.verification_status != 'verified')
                if contacts:
                    try:
                        valid = EditDraft(expected_revision=1, idempotency_key='initial_contact', recipient=contacts[0].email,
                                          subject='', body='', booking_link='')
                        thread.recipient = valid.recipient
                        thread.recipient_status = 'verified' if contacts[0].verification_status == 'verified' else 'published_unverified'
                    except ValueError:
                        pass
                if workspace.profile:
                    try:
                        key = draft_cache_key(workspace.profile, account)
                        cached = db.execute('SELECT data FROM customer_drafts WHERE tenant_id=? AND cache_key=? AND status=?',
                                            (self.tenant, key, 'complete')).fetchone()
                        if cached:
                            saved = json.loads(cached['data'])
                            thread.subject, thread.body = saved['subject'], saved['body']
                    except ValueError:
                        pass
                thread = self._view(db, thread)
                db.execute('INSERT INTO outreach_threads VALUES (?,?,?,?,?)',
                           (self.tenant, thread.id, thread.search_id, thread.account_id, thread.model_dump_json()))
                threads.append(thread)
            self._record(db, 'start', body, threads)
            return {'threads': threads}

    def mutate(self, thread_id, operation, body):
        with self.repo.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            operation_key = operation + ':' + thread_id
            replay = self._replay(db, operation_key, body)
            if replay is not None:
                return replay[0]
            thread = self._get(db, thread_id)
            if thread.revision != body.expected_revision:
                raise OutreachError('This conversation changed. Refresh it before saving your next change.')
            next_revision = thread.revision + 1
            if operation == 'draft':
                changed = any(getattr(thread, name) != getattr(body, name) for name in ('recipient', 'subject', 'body', 'booking_link'))
                if thread.recipient != body.recipient:
                    thread.recipient_status = 'user_entered' if body.recipient else 'missing'
                    thread.contact_basis = None
                for name in ('recipient', 'subject', 'body', 'booking_link'):
                    setattr(thread, name, getattr(body, name))
                if changed:
                    thread.approval = None
            elif operation == 'contact-basis':
                thread.contact_basis, thread.approval = body.contact_basis, None
            elif operation == 'approve':
                if not thread.sender_footer:
                    raise OutreachError('Save your sender name, company, mailing address and reachable contact in Edit business before approval.')
                if not any(m.direction == 'inbound' and m.reply_state in ('interested', 'question') for m in thread.messages) and (thread.booking_link or re.search(r'https?://(?:www\.)?(?:calendly\.com|cal\.com|calendar\.[^/\s?#]+)(?=[/?#\s]|$)', thread.subject + '\n' + thread.body, re.I)):
                    raise OutreachError('Remove the booking link from the cold message. Offer it only after interest is shown.')
                if not thread.body.endswith(thread.sender_footer):
                    raise OutreachError('Restore the current saved sender footer in your message, then save and approve again.')
                if blocked(thread):
                    raise OutreachError('This conversation is paused, suppressed or needs reply review. Approval is blocked.')
                if not all((thread.recipient, thread.subject, thread.body)):
                    raise OutreachError('Save a recipient, subject and message before approving.')
                if not contact_basis_ready(thread):
                    raise OutreachError('Review and save the recipient contact basis before approval.')
                thread.approval = Approval(content_hash=content_hash(thread), approved_at=now(), revision=next_revision)
            elif operation == 'sent':
                if not thread.ready_for_manual_action:
                    raise OutreachError('Approve this exact saved message before recording it as sent outside Clientrove.')
                if len(thread.messages) >= 50:
                    raise OutreachError('This local conversation has reached its 50-message allowance', 429)
                sent_as = getattr(body, 'sent_as', 'approved')
                approved_body = thread.body + ('\n\nBooking link: ' + thread.booking_link if thread.booking_link else '')
                subject, text = thread.subject, approved_body
                if sent_as == 'with_changes':
                    subject, text = body.actual_subject, body.actual_body
                    if not subject or not text or '\n' in subject or '\r' in subject:
                        raise OutreachError('Enter the actual subject and message sent outside Clientrove.')
                elif getattr(body, 'actual_subject', '') or getattr(body, 'actual_body', ''):
                    raise OutreachError('Choose sent with changes to record different text.')
                thread.messages.append(ConversationMessage(id=new_id('msg'), direction='outbound', recipient=thread.recipient,
                    subject=subject, body=text, approved_subject=thread.subject, approved_body=approved_body, sent_as=sent_as,
                    booking_link=thread.booking_link, approved_content_hash=thread.approval.content_hash, reply_state=None, created_at=now()))
                thread.body, thread.approval = '', None
            elif operation == 'reply':
                if len(thread.messages) >= 50:
                    raise OutreachError('This local conversation has reached its 50-message allowance', 429)
                # Obvious unsubscribe language fails closed even if the selected
                # classification was accidentally left on an affirmative value.
                opt_out = re.search(r'\b(unsubscribe|remove me|do not contact|don.t contact|stop emailing|opt[ -]?out)\b', body.body, re.I)
                state = 'opt_out' if opt_out else body.reply_state
                thread.messages.append(ConversationMessage(id=new_id('msg'), direction='inbound', recipient=thread.recipient,
                    subject=thread.subject, body=body.body, reply_state=state, created_at=now()))
                thread.reply_state, thread.body, thread.approval = state, '', None
                if thread.subject and not thread.subject.lower().startswith('re:'):
                    thread.subject = ('Re: ' + thread.subject)[:160]
            elif operation == 'reply-state':
                latest = next((m for m in reversed(thread.messages) if m.direction == 'inbound'), None)
                if latest is None:
                    raise OutreachError('Paste a reply before reviewing its classification.')
                latest.reply_state, thread.reply_state, thread.approval = body.reply_state, body.reply_state, None
            elif operation == 'pause':
                thread.paused, thread.approval = body.paused, None
            elif operation == 'outcomes':
                if body.meeting_state in ('attended_reported', 'no_show_reported') and thread.meeting_state not in ('booked_reported', 'attended_reported', 'no_show_reported'):
                    raise OutreachError('Report a booked meeting before recording attendance or a no-show.')
                thread.meeting_state, thread.sale_state = body.meeting_state, body.sale_state
            else:
                raise OutreachError('Unsupported conversation action', 404)
            if thread.reply_state == 'opt_out':
                latest_inbound = next((m for m in reversed(thread.messages) if m.direction == 'inbound'), None)
                addresses = {thread.recipient.lower()}
                if latest_inbound:
                    addresses.add(latest_inbound.recipient.lower())
                for target in [domain_target(thread.domain)] + ['email:' + address for address in addresses if address]:
                    db.execute('INSERT OR IGNORE INTO outreach_suppressions VALUES (?,?,?,?)',
                               (self.tenant, target, 'An opt-out was recorded. Outreach approval is blocked.', now()))
                thread.suppressed = True
                thread.suppression_reason = 'An opt-out was recorded. Outreach approval is blocked.'
            thread.revision, thread.updated_at = next_revision, now()
            thread = self._save(db, thread)
            self._record(db, operation_key, body, [thread])
            return thread


def outreach_router(repository, *, blocked_preview=False):
    router = APIRouter(prefix='/api/outreach')

    def service():
        if blocked_preview:
            raise HTTPException(403, 'Conversation review requires a private local workspace. It is unavailable in this public preview.')
        return repository()

    def call(method, *args):
        try:
            return method(*args)
        except OutreachError as error:
            raise HTTPException(error.status, str(error)) from None

    @router.get('')
    def list_threads(search_id: str | None = None):
        return call(service().outreach_threads, search_id)

    @router.post('')
    def start(body: StartOutreach):
        return call(service().start_outreach, body)

    @router.get('/{thread_id}', response_model=OutreachThread)
    def get_thread(thread_id: str):
        return call(service().outreach_thread, thread_id)

    @router.put('/{thread_id}/draft', response_model=OutreachThread)
    def edit(thread_id: str, body: EditDraft):
        return call(service().mutate_outreach, thread_id, 'draft', body)

    @router.put('/{thread_id}/contact-basis', response_model=OutreachThread)
    def contact_basis(thread_id: str, body: ContactBasisRequest):
        return call(service().mutate_outreach, thread_id, 'contact-basis', body)

    @router.post('/{thread_id}/approve', response_model=OutreachThread)
    def approve(thread_id: str, body: RevisionRequest):
        return call(service().mutate_outreach, thread_id, 'approve', body)

    @router.post('/{thread_id}/sent', response_model=OutreachThread)
    def sent(thread_id: str, body: SentRequest):
        return call(service().mutate_outreach, thread_id, 'sent', body)

    @router.post('/{thread_id}/replies', response_model=OutreachThread)
    def reply(thread_id: str, body: PasteReply):
        return call(service().mutate_outreach, thread_id, 'reply', body)

    @router.patch('/{thread_id}/reply-state', response_model=OutreachThread)
    def state(thread_id: str, body: CorrectReply):
        return call(service().mutate_outreach, thread_id, 'reply-state', body)

    @router.patch('/{thread_id}/pause', response_model=OutreachThread)
    def pause(thread_id: str, body: PauseRequest):
        return call(service().mutate_outreach, thread_id, 'pause', body)

    @router.patch('/{thread_id}/outcomes', response_model=OutreachThread)
    def outcomes(thread_id: str, body: OutcomesRequest):
        return call(service().mutate_outreach, thread_id, 'outcomes', body)

    @router.post('/{thread_id}/reply-draft')
    def ai_reply(thread_id: str, body: EmptyRequest):
        call(service().outreach_thread, thread_id)
        raise HTTPException(503, 'AI reply drafting is disabled until a total monthly spending guard is configured. Write and review a response here without provider charges.')

    return router
