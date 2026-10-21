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
from pydantic import Field, StringConstraints, field_validator, model_validator

from .models import EmptyRequest, StrictModel, Workspace
from .primitives import new_id, now
from .safety import FetchError, normalize_url
from .outreach_lifecycle import cold_followups_sent, weekday_gap, manual_action_block

Key = Annotated[str, StringConstraints(pattern=r'^[A-Za-z0-9_-]{8,128}$')]
Identifier = Annotated[str, StringConstraints(pattern=r'^[A-Za-z0-9_-]{1,128}$')]
ReplyState = Literal['awaiting_review', 'interested', 'question', 'not_now', 'not_interested', 'opt_out', 'uncertain', 'referral', 'source_question', 'auto_reply', 'bounce']
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


class DatedReply(RevisionRequest):
    revisit_at: str | None = None
    revisit_timezone: str | None = None

    @field_validator('revisit_at')
    @classmethod
    def aware_revisit(cls, value):
        if not value:
            return None
        timestamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if timestamp.tzinfo is None or timestamp.utcoffset() is None:
            raise ValueError('Revisit time must include a timezone')
        return timestamp.isoformat()

    @field_validator('revisit_timezone')
    @classmethod
    def valid_revisit_timezone(cls, value):
        if value:
            try:
                ZoneInfo(value)
            except (ZoneInfoNotFoundError, ValueError):
                raise ValueError('Use an IANA timezone for the revisit date') from None
        return value or None

    @model_validator(mode='after')
    def roundtrip_revisit_wall_time(self):
        if not self.revisit_at or not self.revisit_timezone:
            return self
        timestamp = datetime.fromisoformat(self.revisit_at.replace('Z', '+00:00'))
        zone = ZoneInfo(self.revisit_timezone)
        local_wall = timestamp.replace(tzinfo=None)
        valid_offsets = set()
        for fold in (0, 1):
            candidate = local_wall.replace(tzinfo=zone, fold=fold)
            if candidate.astimezone(timezone.utc).astimezone(zone).replace(tzinfo=None) == local_wall:
                valid_offsets.add(candidate.utcoffset())
        if not valid_offsets:
            raise ValueError('Revisit time does not exist in the selected timezone')
        if timestamp.utcoffset() not in valid_offsets:
            raise ValueError('Revisit time offset does not match the selected timezone')
        self.revisit_at = timestamp.astimezone(timezone.utc).isoformat()
        return self


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


class ReferralRequest(RevisionRequest):
    recipient: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=320)]
    contact_name: Annotated[str, StringConstraints(strip_whitespace=True, max_length=160)] = ''
    referrer_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
    referrer_message_id: Identifier

    @field_validator('recipient')
    @classmethod
    def referral_email(cls, value):
        return EditDraft.email(value)

    @field_validator('contact_name', 'referrer_name')
    @classmethod
    def single_line(cls, value):
        return EditDraft.one_line(value)


class PasteReply(DatedReply):
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=6000)]
    reply_state: ReplyState = 'awaiting_review'


class CorrectReply(DatedReply):
    reply_state: ReplyState


class PauseRequest(RevisionRequest):
    paused: bool


class OutcomesRequest(RevisionRequest):
    meeting_state: MeetingState
    sale_state: SaleState


class ScheduledDraft(RevisionRequest):
    scheduled_at: str
    scheduled_timezone: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    subject: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=6000)]

    @field_validator('subject')
    @classmethod
    def single_line_subject(cls, value):
        return EditDraft.one_line(value)

    @model_validator(mode='after')
    def explicit_schedule(self):
        value = DatedReply(expected_revision=self.expected_revision, idempotency_key=self.idempotency_key,
                           revisit_at=self.scheduled_at, revisit_timezone=self.scheduled_timezone)
        if not value.revisit_at or not value.revisit_timezone:
            raise ValueError('Confirm a date, numeric offset and IANA timezone')
        self.scheduled_at = value.revisit_at
        return self


class Approval(StrictModel):
    content_hash: str
    approved_at: str
    revision: int
    contact_basis_snapshot: ContactBasis | None = None


class MeetingRequest(RevisionRequest):
    meeting_at: str
    meeting_timezone: str

    @model_validator(mode='after')
    def explicit_meeting(self):
        value = DatedReply(expected_revision=self.expected_revision, idempotency_key=self.idempotency_key,
                           revisit_at=self.meeting_at, revisit_timezone=self.meeting_timezone)
        if not value.revisit_at or not value.revisit_timezone:
            raise ValueError('Confirm the meeting date, numeric offset and IANA timezone')
        self.meeting_at = value.revisit_at
        return self


class ConfirmationDraft(RevisionRequest):
    subject: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=6000)]

    @field_validator('subject')
    @classmethod
    def single_line_subject(cls, value):
        return EditDraft.one_line(value)


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
    outbound_purpose: Literal['initial', 'answer', 'cold_followup', 'meeting_confirmation'] | None = None
    scheduled_at: str | None = None
    scheduled_timezone: str | None = None
    meeting_version: int | None = None
    contact_basis_snapshot: ContactBasis | None = None


class OutreachThread(StrictModel):
    id: str
    search_id: str
    account_id: str
    company_name: str
    domain: str
    recipient: str = ''
    recipient_name: str = ''
    referrer_thread_id: str | None = None
    referrer_message_id: str | None = None
    referrer_name: str = ''
    referral_completed_message_ids: list[str] = Field(default_factory=list, max_length=50)
    outbound_purpose: Literal['initial', 'answer', 'cold_followup', 'meeting_confirmation'] = 'initial'
    next_followup_at: str | None = None
    followup_timezone: str | None = None
    followups_sent: int = 0
    manual_action_block: str | None = None
    meeting_at: str | None = None
    meeting_timezone: str | None = None
    meeting_version: int = 0
    meeting_recipient: str | None = None
    lifecycle_events: list[dict[str, str]] = Field(default_factory=list, max_length=200)
    recipient_status: Literal['missing', 'verified', 'published_unverified', 'user_entered', 'invalid'] = 'missing'
    invalid_recipient_emails: list[str] = Field(default_factory=list, max_length=10)
    subject: str = ''
    body: str = ''
    booking_link: str = ''
    sender_footer: str = ''
    contact_basis: ContactBasis | None = None
    paused: bool = False
    cold_followups_stopped: bool = False
    suppressed: bool = False
    suppression_reason: str | None = None
    reply_state: ReplyState = 'awaiting_review'
    revisit_at: str | None = None
    revisit_timezone: str | None = None
    review_due: bool = False
    company_conflict: bool = False
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
    if thread.outbound_purpose != 'initial' or thread.next_followup_at:
        data.append([thread.outbound_purpose, thread.next_followup_at, thread.followup_timezone,
                     thread.meeting_version if thread.outbound_purpose == 'meeting_confirmation' else None])
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
    return (thread.suppressed or thread.paused or thread.company_conflict or thread.recipient_status == 'invalid'
            or (has_reply and thread.reply_state not in ('interested', 'question')))


def source_question(body: str) -> bool:
    return bool(re.search(r'\b(where|how) did you get my (email|address)|how did you find me|source of (your|the) (email|information)', body, re.I))


def dated_reply_state(state, body):
    if state in ('not_now', 'auto_reply') and bool(body.revisit_at) != bool(body.revisit_timezone):
        return 'awaiting_review'
    return state


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
            f'Contact: {profile.sender_contact}\nAdvertisement: business outreach.\nTo opt out, reply "unsubscribe".')


def domain_target(domain):
    host = urlsplit(domain if '://' in domain else 'https://' + domain).hostname or domain
    return 'domain:' + host.rstrip('.').lower().removeprefix('www.')


def invalidate_bounced_address(thread, address):
    address = address.lower()
    if address and address not in thread.invalid_recipient_emails:
        if len(thread.invalid_recipient_emails) >= 10:
            raise OutreachError('This conversation has reached its invalid-address allowance.', 429)
        thread.invalid_recipient_emails.append(address)
    if thread.recipient.lower() == address:
        thread.recipient_status = 'invalid'


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
        if thread.recipient and thread.recipient.lower() in {value.lower() for value in thread.invalid_recipient_emails}:
            thread.recipient_status = 'invalid'
        thread.review_due = False
        thread.followups_sent = cold_followups_sent(thread)
        thread.manual_action_block = manual_action_block(thread, datetime.now(timezone.utc))
        if thread.revisit_at and thread.reply_state in ('not_now', 'auto_reply'):
            revisit = datetime.fromisoformat(thread.revisit_at.replace('Z', '+00:00'))
            thread.review_due = revisit <= datetime.now(timezone.utc)
        owner = self._cold_company_owner(db, thread)
        thread.company_conflict = bool(owner and owner != thread.id)
        if thread.company_conflict:
            thread.approval = None
        if blocked(thread) or not contact_basis_ready(thread) or not thread.sender_footer or not thread.body.endswith(thread.sender_footer):
            thread.approval = None
        thread.ready_for_manual_action = bool(not blocked(thread) and not thread.manual_action_block and thread.recipient and thread.subject and thread.body and
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

    def _cold_company_owner(self, db, thread):
        """Return the deterministic oldest active cold thread for this company."""
        candidates = []
        rows = db.execute('SELECT id,data FROM outreach_threads WHERE tenant_id=?', (self.tenant,)).fetchall()
        for row in rows:
            candidate = OutreachThread.model_validate_json(row['data'])
            if candidate.id == thread.id or domain_target(candidate.domain) != domain_target(thread.domain):
                continue
            # Cancelled followups are a historical fact, not permission for
            # multiple resumed cold threads to escape company ownership.
            if candidate.paused or candidate.suppressed:
                continue
            if any(message.direction == 'inbound' for message in candidate.messages):
                continue
            candidates.append((candidate.created_at, candidate.id))
        if not thread.paused and not thread.suppressed \
                and not any(message.direction == 'inbound' for message in thread.messages):
            candidates.append((thread.created_at, thread.id))
        return min(candidates)[1] if candidates else None

    def _pause_company_siblings(self, db, thread):
        """Pause same-tenant/domain outreach without touching other tenants."""
        target = domain_target(thread.domain)
        rows = db.execute('SELECT id,data FROM outreach_threads WHERE tenant_id=?', (self.tenant,)).fetchall()
        for row in rows:
            if row['id'] == thread.id:
                continue
            sibling = OutreachThread.model_validate_json(row['data'])
            if domain_target(sibling.domain) != target:
                continue
            sibling.paused = True
            sibling.cold_followups_stopped = True
            sibling.approval = None
            sibling.next_followup_at = sibling.followup_timezone = None
            sibling.revision += 1
            sibling.updated_at = now()
            db.execute('UPDATE outreach_threads SET data=? WHERE tenant_id=? AND id=?',
                       (sibling.model_dump_json(), self.tenant, sibling.id))

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
                rows = db.execute('SELECT data FROM outreach_threads WHERE tenant_id=? AND search_id=? ORDER BY rowid LIMIT 100',
                                  (self.tenant, search_id)).fetchall()
            else:
                rows = db.execute('SELECT data FROM outreach_threads WHERE tenant_id=? ORDER BY rowid DESC LIMIT 100', (self.tenant,)).fetchall()
            threads = [self._view(db, OutreachThread.model_validate_json(row['data'])) for row in rows]
        if search_id:
            return {'threads': threads}
        fields = ('id', 'search_id', 'account_id', 'company_name', 'domain', 'recipient', 'reply_state', 'paused', 'suppressed',
                  'ready_for_manual_action', 'meeting_state', 'sale_state', 'updated_at')
        return {'threads': [{name: getattr(t, name) for name in fields} for t in threads]}

    def next_up(self, limit=20):
        """Return a read-only, durable-work projection for returning users."""
        with self.repo.connect() as db:
            rows = db.execute('SELECT data FROM outreach_threads WHERE tenant_id=? ORDER BY rowid DESC',
                              (self.tenant,)).fetchall()
            threads = [self._view(db, OutreachThread.model_validate_json(row['data'])) for row in rows]
        ranked = []
        for thread in threads:
            inbound_indexes = [index for index, message in enumerate(thread.messages) if message.direction == 'inbound']
            outbound_indexes = [index for index, message in enumerate(thread.messages) if message.direction == 'outbound']
            latest_inbound = max(inbound_indexes, default=-1)
            latest_outbound = max(outbound_indexes, default=-1)
            inbound = latest_inbound >= 0
            if thread.reply_state in ('not_now', 'auto_reply') and thread.revisit_at and not thread.review_due:
                continue
            if thread.meeting_state == 'booked_reported' and (not thread.meeting_at or datetime.fromisoformat(thread.meeting_at) <= datetime.now(timezone.utc)):
                priority, action, reason = 2, 'report_meeting', 'Report what happened, or repair a missing meeting date. Unknown stays unknown.'
            elif thread.next_followup_at and datetime.fromisoformat(thread.next_followup_at) <= datetime.now(timezone.utc) and not inbound and not thread.paused and not thread.suppressed and not thread.company_conflict:
                priority, action, reason = 2, 'review_followup', 'Any reply since your last send? Check your inbox, then review this due reminder. Nothing sends automatically.'
            elif inbound and thread.reply_state == 'referral' and thread.messages[latest_inbound].id in thread.referral_completed_message_ids:
                continue
            elif inbound and thread.reply_state in ('awaiting_review', 'uncertain', 'not_now', 'not_interested', 'opt_out', 'source_question', 'auto_reply', 'bounce', 'referral'):
                priority, action, reason = 0, 'review_reply', 'Review the pasted reply and its recorded consequence.'
            elif inbound and thread.reply_state in ('interested', 'question') and latest_outbound > latest_inbound:
                continue
            elif inbound and thread.reply_state in ('interested', 'question'):
                priority, action, reason = 1, 'answer_reply', 'Write and review a human answer using saved facts.'
            elif thread.approval and thread.ready_for_manual_action:
                priority, action, reason = 3, 'manual_send', 'Copy or send the exact approved message, then record what happened.'
            else:
                continue
            ranked.append((priority, thread.updated_at, thread, action, reason))
        ranked.sort(key=lambda item: (item[0], item[1]), reverse=False)
        return {'items': [
            {'thread_id': thread.id, 'search_id': thread.search_id, 'company_name': thread.company_name, 'action': action,
             'reason': reason, 'reply_state': thread.reply_state,
             'meeting_state': thread.meeting_state, 'updated_at': thread.updated_at}
            for _, _, thread, action, reason in ranked[:limit]
        ]}

    def get(self, thread_id):
        with self.repo.connect() as db:
            return self._get(db, thread_id)

    def insights(self):
        from .customers import CustomerSearch
        from .outreach_insights import project_insights
        with self.repo.connect() as db:
            threads = [self._view(db, OutreachThread.model_validate_json(row['data'])) for row in db.execute(
                'SELECT data FROM outreach_threads WHERE tenant_id=? ORDER BY rowid', (self.tenant,)).fetchall()]
            examples = set()
            known = set()
            for row in db.execute('SELECT data FROM customer_searches WHERE tenant_id=?', (self.tenant,)).fetchall():
                search = CustomerSearch.model_validate_json(row['data'])
                for account in search.accounts:
                    known.add((search.id, account.id))
                    if account.is_demo:
                        examples.add((search.id, account.id))
            excluded = {thread.id for thread in threads if not thread.referrer_thread_id and (
                (thread.search_id, thread.account_id) in examples or (thread.search_id, thread.account_id) not in known)}
            # Referral provenance inherits example exclusion, never verification or permission.
            for _ in range(len(threads)):
                inherited = {thread.id for thread in threads if thread.referrer_thread_id in excluded}
                if inherited <= excluded:
                    break
                excluded.update(inherited)
        return project_insights(threads, excluded, domain_target, now())

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
                if self._cold_company_owner(db, thread) not in (None, thread.id):
                    thread.paused = True
                    thread.cold_followups_stopped = True
                thread = self._view(db, thread)
                db.execute('INSERT INTO outreach_threads VALUES (?,?,?,?,?)',
                           (self.tenant, thread.id, thread.search_id, thread.account_id, thread.model_dump_json()))
                threads.append(thread)
            self._record(db, 'start', body, threads)
            return {'threads': threads}

    def referral(self, thread_id, body: ReferralRequest):
        """Create a distinct, unverified contact from a manually reviewed reply."""
        with self.repo.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            operation = 'referral:' + thread_id
            replay = self._replay(db, operation, body)
            if replay is not None:
                return replay[0]
            parent = self._get(db, thread_id)
            if parent.revision != body.expected_revision:
                raise OutreachError('This conversation changed. Refresh before adding the referred contact.')
            latest = next((m for m in reversed(parent.messages) if m.direction == 'inbound'), None)
            if parent.suppressed or not latest or latest.id != body.referrer_message_id or parent.reply_state != 'referral':
                raise OutreachError('Review a current referral reply before adding its contact. Suppression remains in effect.')
            if body.recipient.lower() == parent.recipient.lower():
                raise OutreachError('A referral must identify a different contact. The original history is preserved.')
            rows = db.execute('SELECT data FROM outreach_threads WHERE tenant_id=?', (self.tenant,)).fetchall()
            if len(rows) >= 100:
                raise OutreachError('This local workspace is limited to 100 conversations.', 429)
            for row in rows:
                existing = OutreachThread.model_validate_json(row['data'])
                if body.recipient.lower() in {address.lower() for address in existing.invalid_recipient_emails}:
                    raise OutreachError('This address was recorded as bounced. Use a different contact.')
                if domain_target(existing.domain) == domain_target(parent.domain) and existing.recipient.lower() == body.recipient.lower():
                    raise OutreachError('This company contact already has a conversation. Reopen its saved thread.')
            suppression = db.execute('SELECT 1 FROM outreach_suppressions WHERE tenant_id=? AND target IN (?,?) LIMIT 1',
                (self.tenant, domain_target(parent.domain), 'email:' + body.recipient.lower())).fetchone()
            if suppression:
                raise OutreachError('This company or address is suppressed. A referral cannot remove an opt-out.')
            stamp = now()
            child = OutreachThread(id=new_id('outreach'), search_id=parent.search_id, account_id=new_id('referral'),
                company_name=parent.company_name, domain=parent.domain, recipient=body.recipient, recipient_name=body.contact_name,
                recipient_status='user_entered', referrer_thread_id=parent.id, referrer_message_id=latest.id,
                referrer_name=body.referrer_name, created_at=stamp, updated_at=stamp)
            if self._cold_company_owner(db, child) not in (None, child.id):
                child.paused, child.cold_followups_stopped = True, True
            child = self._view(db, child)
            db.execute('INSERT INTO outreach_threads VALUES (?,?,?,?,?)',
                (self.tenant, child.id, child.search_id, child.account_id, child.model_dump_json()))
            if latest.id not in parent.referral_completed_message_ids:
                parent.referral_completed_message_ids.append(latest.id)
            parent.approval, parent.revision, parent.updated_at = None, parent.revision + 1, stamp
            self._save(db, parent)
            self._record(db, operation, body, [child])
            return child

    def mutate(self, thread_id, operation, body):
        if operation == 'referral':
            return self.referral(thread_id, body)
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
            if operation == 'meeting':
                if len(thread.lifecycle_events) >= 200:
                    raise OutreachError('This conversation has reached its planning-history allowance.', 429)
                if thread.meeting_recipient and thread.meeting_recipient.lower() != thread.recipient.lower():
                    raise OutreachError('This booking belongs to the original contact. Use a separate contact thread for a different recipient.')
                same_booking = bool(thread.meeting_at and datetime.fromisoformat(thread.meeting_at) == datetime.fromisoformat(body.meeting_at))
                thread.meeting_at, thread.meeting_timezone = body.meeting_at, body.meeting_timezone
                thread.meeting_recipient = thread.recipient
                if not same_booking:
                    thread.meeting_version += 1
                thread.meeting_state, thread.approval = 'booked_reported', None
                thread.next_followup_at = thread.followup_timezone = None
                thread.cold_followups_stopped = True
                thread.lifecycle_events.append({'kind': 'booking_reported', 'at': now(), 'meeting_at': body.meeting_at,
                                                'timezone': body.meeting_timezone, 'version': str(thread.meeting_version)})
                self._pause_company_siblings(db, thread)
            elif operation == 'meeting-confirmation':
                if thread.meeting_state != 'booked_reported' or not thread.meeting_at or datetime.fromisoformat(thread.meeting_at) <= datetime.now(timezone.utc):
                    raise OutreachError('Report a future timed booking before preparing a confirmation.')
                if not thread.meeting_recipient or thread.meeting_recipient.lower() != thread.recipient.lower():
                    raise OutreachError('This booking does not belong to the current recipient. Review the original contact.')
                thread.outbound_purpose = 'meeting_confirmation'
                thread.subject, thread.body, thread.booking_link, thread.approval = body.subject, body.body, '', None
            elif operation == 'followup':
                if any(message.direction == 'inbound' for message in thread.messages):
                    raise OutreachError('A received reply permanently stops cold followups on this thread.')
                outbound = [message for message in thread.messages if message.direction == 'outbound']
                if not outbound or cold_followups_sent(thread) >= 2:
                    raise OutreachError('At most two cold followups follow a first send reported by you.')
                if outbound[-1].recipient.lower() != thread.recipient.lower() or thread.meeting_state != 'not_recorded':
                    raise OutreachError('A cold followup must stay with its original recipient and cannot follow a reported meeting.')
                if thread.suppressed or thread.paused or thread.company_conflict or thread.recipient_status == 'invalid':
                    raise OutreachError('Review this company, pause or invalid contact before scheduling.')
                due = datetime.fromisoformat(body.scheduled_at)
                last_sent = datetime.fromisoformat(outbound[-1].created_at.replace('Z', '+00:00'))
                if due <= datetime.now(timezone.utc) or due <= last_sent or weekday_gap(last_sent, due, body.scheduled_timezone) < 3:
                    raise OutreachError('Choose a future followup at least three business days after the last reported send.')
                if due.astimezone(ZoneInfo(body.scheduled_timezone)).weekday() >= 5:
                    raise OutreachError('Choose a weekday for the manually reviewed followup.')
                if len(thread.lifecycle_events) >= 200:
                    raise OutreachError('This conversation has reached its planning-history allowance.', 429)
                thread.next_followup_at, thread.followup_timezone = body.scheduled_at, body.scheduled_timezone
                thread.outbound_purpose = 'cold_followup'
                thread.subject, thread.body, thread.booking_link, thread.approval = body.subject, body.body, '', None
                thread.lifecycle_events.append({'kind': 'followup_scheduled', 'at': now(), 'scheduled_at': body.scheduled_at,
                                                'timezone': body.scheduled_timezone})
            elif operation == 'draft':
                changed = any(getattr(thread, name) != getattr(body, name) for name in ('recipient', 'subject', 'body', 'booking_link'))
                if thread.recipient != body.recipient:
                    thread.recipient_status = 'user_entered' if body.recipient else 'missing'
                    thread.contact_basis = None
                    thread.next_followup_at = thread.followup_timezone = None
                    thread.outbound_purpose = 'answer' if any(m.direction == 'inbound' for m in thread.messages) else 'initial'
                for name in ('recipient', 'subject', 'body', 'booking_link'):
                    setattr(thread, name, getattr(body, name))
                if changed:
                    thread.approval = None
            elif operation == 'contact-basis':
                thread.contact_basis, thread.approval = body.contact_basis, None
            elif operation == 'approve':
                owner = self._cold_company_owner(db, thread)
                if owner not in (None, thread.id):
                    thread.paused = True
                    thread.cold_followups_stopped = True
                    thread.approval = None
                    thread.revision, thread.updated_at = next_revision, now()
                    thread = self._save(db, thread)
                    self._record(db, operation_key, body, [thread])
                    return thread
                if not thread.sender_footer:
                    raise OutreachError('Save your sender name, company, mailing address and reachable contact in Edit business before approval.')
                if thread.reply_state != 'interested' and (thread.booking_link or re.search(r'https?://(?:www\.)?(?:calendly\.com|cal\.com|calendar\.[^/\s?#]+)(?=[/?#\s]|$)', thread.subject + '\n' + thread.body, re.I)):
                    raise OutreachError('Remove the booking link from the cold message. Offer it only after interest is shown.')
                if not thread.body.endswith(thread.sender_footer):
                    raise OutreachError('Restore the current saved sender footer in your message, then save and approve again.')
                if blocked(thread):
                    raise OutreachError('This conversation is paused, suppressed or needs reply review. Approval is blocked.')
                if not all((thread.recipient, thread.subject, thread.body)):
                    raise OutreachError('Save a recipient, subject and message before approving.')
                if not contact_basis_ready(thread):
                    raise OutreachError('Review and save the recipient contact basis before approval.')
                if thread.outbound_purpose in ('cold_followup', 'meeting_confirmation') and thread.manual_action_block:
                    raise OutreachError(thread.manual_action_block)
                thread.approval = Approval(content_hash=content_hash(thread), approved_at=now(), revision=next_revision,
                                           contact_basis_snapshot=thread.contact_basis.model_copy(deep=True))
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
                    booking_link=thread.booking_link, approved_content_hash=thread.approval.content_hash, reply_state=None, created_at=now(),
                    outbound_purpose=thread.outbound_purpose, scheduled_at=thread.next_followup_at, scheduled_timezone=thread.followup_timezone,
                    meeting_version=thread.meeting_version if thread.outbound_purpose == 'meeting_confirmation' else None,
                    contact_basis_snapshot=thread.approval.contact_basis_snapshot))
                thread.body, thread.approval = '', None
                thread.next_followup_at = thread.followup_timezone = None
                thread.outbound_purpose = 'answer' if any(m.direction == 'inbound' for m in thread.messages) else 'initial'
            elif operation == 'reply':
                if len(thread.messages) >= 50:
                    raise OutreachError('This local conversation has reached its 50-message allowance', 429)
                # Obvious unsubscribe language fails closed even if the selected
                # classification was accidentally left on an affirmative value.
                opt_out = re.search(r'\b(unsubscribe|remove me|do not contact|don.t contact|stop emailing|opt[ -]?out)\b', body.body, re.I)
                state = 'opt_out' if opt_out else ('source_question' if source_question(body.body) else body.reply_state)
                state = dated_reply_state(state, body)
                if state == 'bounce':
                    invalidate_bounced_address(thread, thread.recipient)
                if state in ('not_now', 'auto_reply'):
                    thread.revisit_at, thread.revisit_timezone = body.revisit_at, body.revisit_timezone
                else:
                    thread.revisit_at = thread.revisit_timezone = None
                thread.messages.append(ConversationMessage(id=new_id('msg'), direction='inbound', recipient=thread.recipient,
                    subject=thread.subject, body=body.body, reply_state=state, created_at=now()))
                thread.reply_state, thread.body, thread.approval = state, '', None
                thread.cold_followups_stopped = True
                thread.next_followup_at = thread.followup_timezone = None
                thread.outbound_purpose = 'answer'
                self._pause_company_siblings(db, thread)
                if thread.subject and not thread.subject.lower().startswith('re:'):
                    thread.subject = ('Re: ' + thread.subject)[:160]
            elif operation == 'reply-state':
                latest = next((m for m in reversed(thread.messages) if m.direction == 'inbound'), None)
                if latest is None:
                    raise OutreachError('Paste a reply before reviewing its classification.')
                state = 'source_question' if source_question(latest.body) else body.reply_state
                state = dated_reply_state(state, body)
                if state == 'bounce':
                    invalidate_bounced_address(thread, latest.recipient)
                latest.reply_state, thread.reply_state, thread.approval = state, state, None
                thread.cold_followups_stopped = True
                thread.next_followup_at = thread.followup_timezone = None
                thread.outbound_purpose = 'answer'
                if state in ('not_now', 'auto_reply'):
                    thread.revisit_at, thread.revisit_timezone = body.revisit_at, body.revisit_timezone
                else:
                    thread.revisit_at = thread.revisit_timezone = None
            elif operation == 'pause':
                thread.paused, thread.approval = body.paused, None
            elif operation == 'outcomes':
                if body.meeting_state == 'booked_reported' and not thread.meeting_at:
                    raise OutreachError('Confirm a meeting date, numeric offset and timezone before reporting a booking.')
                if body.meeting_state in ('attended_reported', 'no_show_reported') and thread.meeting_state not in ('booked_reported', 'attended_reported', 'no_show_reported'):
                    raise OutreachError('Report a booked meeting before recording attendance or a no-show.')
                if body.meeting_state in ('attended_reported', 'no_show_reported') and (not thread.meeting_at or datetime.fromisoformat(thread.meeting_at) > datetime.now(timezone.utc)):
                    raise OutreachError('Wait until the reported meeting time has passed before recording attendance or a no-show.')
                if len(thread.lifecycle_events) >= 200:
                    raise OutreachError('This conversation has reached its planning-history allowance.', 429)
                thread.meeting_state, thread.sale_state = body.meeting_state, body.sale_state
                thread.approval = None
                thread.lifecycle_events.append({'kind': 'outcome_reported', 'at': now(), 'meeting_state': body.meeting_state,
                                                'sale_state': body.sale_state, 'version': str(thread.meeting_version)})
                if body.meeting_state != 'not_recorded':
                    thread.cold_followups_stopped = True
                    self._pause_company_siblings(db, thread)
            else:
                raise OutreachError('Unsupported conversation action', 404)
            if thread.reply_state in ('opt_out', 'source_question'):
                latest_inbound = next((m for m in reversed(thread.messages) if m.direction == 'inbound'), None)
                addresses = {thread.recipient.lower()}
                if latest_inbound:
                    addresses.add(latest_inbound.recipient.lower())
                reason = ('A source-of-contact question was recorded. Outreach approval is blocked.'
                          if thread.reply_state == 'source_question'
                          else 'An opt-out was recorded. Outreach approval is blocked.')
                for target in [domain_target(thread.domain)] + ['email:' + address for address in addresses if address]:
                    db.execute('INSERT OR IGNORE INTO outreach_suppressions VALUES (?,?,?,?)',
                               (self.tenant, target, reason, now()))
                thread.suppressed = True
                thread.suppression_reason = reason
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

    @router.get('/next-up')
    def next_up():
        return call(service().outreach_next_up)

    @router.get('/insights')
    def insights():
        return call(service().outreach_insights)

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

    @router.post('/{thread_id}/referrals', response_model=OutreachThread)
    def referral(thread_id: str, body: ReferralRequest):
        return call(service().mutate_outreach, thread_id, 'referral', body)

    @router.post('/{thread_id}/followups', response_model=OutreachThread)
    def followup(thread_id: str, body: ScheduledDraft):
        return call(service().mutate_outreach, thread_id, 'followup', body)

    @router.post('/{thread_id}/meeting', response_model=OutreachThread)
    def meeting(thread_id: str, body: MeetingRequest):
        return call(service().mutate_outreach, thread_id, 'meeting', body)

    @router.post('/{thread_id}/meeting-confirmation', response_model=OutreachThread)
    def confirmation(thread_id: str, body: ConfirmationDraft):
        return call(service().mutate_outreach, thread_id, 'meeting-confirmation', body)

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
