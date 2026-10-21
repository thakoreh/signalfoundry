"""SQLite repository. Every lookup and mutation is explicitly tenant scoped.

This is defense-in-depth data organization, NOT authentication: the local demo
always injects one server-controlled tenant and does not accept client tenant IDs.
"""
from __future__ import annotations
import json
import sqlite3
from datetime import datetime, timezone
from contextlib import contextmanager
from pathlib import Path

from .models import Account, Campaign, Profile, Workspace
from .primitives import new_id, now
from .customers import CustomerSearch


class Repository:
    def __init__(self, db_path: str | Path, tenant_id: str = 'local-demo'):
        self.db_path = str(db_path)
        self.tenant_id = tenant_id
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript('''
              PRAGMA journal_mode=WAL;
              CREATE TABLE IF NOT EXISTS workspaces (
                tenant_id TEXT PRIMARY KEY, data TEXT NOT NULL
              );
              CREATE TABLE IF NOT EXISTS campaigns (
                id TEXT NOT NULL, tenant_id TEXT NOT NULL, data TEXT NOT NULL,
                PRIMARY KEY (tenant_id, id)
              );
              CREATE TABLE IF NOT EXISTS accounts (
                id TEXT NOT NULL, campaign_id TEXT NOT NULL, tenant_id TEXT NOT NULL,
                domain TEXT NOT NULL, data TEXT NOT NULL,
                PRIMARY KEY (tenant_id, id), UNIQUE(tenant_id, campaign_id, domain),
                FOREIGN KEY (tenant_id,campaign_id) REFERENCES campaigns(tenant_id,id)
              );
              CREATE INDEX IF NOT EXISTS accounts_campaign ON accounts(tenant_id,campaign_id);
              CREATE TABLE IF NOT EXISTS customer_searches (
                tenant_id TEXT NOT NULL, id TEXT NOT NULL, request_key TEXT NOT NULL,
                created_at TEXT NOT NULL, data TEXT NOT NULL,
                PRIMARY KEY (tenant_id,id), UNIQUE(tenant_id,request_key)
              );
              CREATE INDEX IF NOT EXISTS customer_searches_tenant_created ON customer_searches(tenant_id,created_at);
              CREATE TABLE IF NOT EXISTS customer_drafts (
                tenant_id TEXT NOT NULL, cache_key TEXT NOT NULL, request_key TEXT NOT NULL,
                created_at TEXT NOT NULL, status TEXT NOT NULL, data TEXT,
                PRIMARY KEY (tenant_id,cache_key), UNIQUE(tenant_id,request_key)
              );
              CREATE INDEX IF NOT EXISTS customer_drafts_tenant_created ON customer_drafts(tenant_id,created_at);
              CREATE TABLE IF NOT EXISTS customer_draft_requests (
                tenant_id TEXT NOT NULL, request_key TEXT NOT NULL, cache_key TEXT NOT NULL,
                created_at TEXT NOT NULL, status TEXT NOT NULL, charged INTEGER NOT NULL, data TEXT,
                PRIMARY KEY (tenant_id,request_key)
              );
              CREATE INDEX IF NOT EXISTS customer_draft_requests_tenant_created ON customer_draft_requests(tenant_id,created_at);
              CREATE INDEX IF NOT EXISTS customer_draft_requests_cached_aliases ON customer_draft_requests(tenant_id,cache_key,charged,created_at);
              INSERT OR IGNORE INTO customer_draft_requests
                SELECT tenant_id,request_key,cache_key,created_at,status,1,data FROM customer_drafts;
              CREATE TABLE IF NOT EXISTS outreach_threads (
                tenant_id TEXT NOT NULL, id TEXT NOT NULL, search_id TEXT NOT NULL,
                account_id TEXT NOT NULL, data TEXT NOT NULL,
                PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,search_id,account_id)
              );
              CREATE INDEX IF NOT EXISTS outreach_threads_search ON outreach_threads(tenant_id,search_id);
              CREATE TABLE IF NOT EXISTS outreach_requests (
                tenant_id TEXT NOT NULL, request_key TEXT NOT NULL, fingerprint TEXT NOT NULL,
                resource_ids TEXT NOT NULL, created_at TEXT NOT NULL,
                PRIMARY KEY(tenant_id,request_key)
              );
              CREATE TABLE IF NOT EXISTS outreach_suppressions (
                tenant_id TEXT NOT NULL, target TEXT NOT NULL, reason TEXT NOT NULL,
                created_at TEXT NOT NULL, PRIMARY KEY(tenant_id,target)
              );
            ''')
            workspace = Workspace(id=tenant_id, name='Your workspace', website=None,
                                  profile=None, created_at=now())
            db.execute('INSERT OR IGNORE INTO workspaces VALUES (?,?)',
                       (tenant_id, workspace.model_dump_json()))

    @contextmanager
    def connect(self):
        connection = sqlite3.connect(self.db_path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute('PRAGMA foreign_keys=ON')
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def workspace(self) -> Workspace:
        with self.connect() as db:
            row = db.execute('SELECT data FROM workspaces WHERE tenant_id=?', (self.tenant_id,)).fetchone()
        return Workspace.model_validate_json(row['data'])

    def outreach_threads(self, search_id=None):
        from .outreach import OutreachStore
        return OutreachStore(self).list(search_id)

    def outreach_thread(self, thread_id):
        from .outreach import OutreachStore
        return OutreachStore(self).get(thread_id)

    def outreach_next_up(self):
        from .outreach import OutreachStore
        return OutreachStore(self).next_up()

    def outreach_insights(self):
        from .outreach import OutreachStore
        return OutreachStore(self).insights()

    def start_outreach(self, body):
        from .outreach import OutreachStore
        return OutreachStore(self).start(body)

    def mutate_outreach(self, thread_id, operation, body):
        from .outreach import OutreachStore
        return OutreachStore(self).mutate(thread_id, operation, body)

    def customer_search(self, search_id: str) -> CustomerSearch | None:
        with self.connect() as db:
            row = db.execute('SELECT data FROM customer_searches WHERE tenant_id=? AND id=?', (self.tenant_id, search_id)).fetchone()
        return CustomerSearch.model_validate_json(row['data']) if row else None

    def create_customer_search(self, request_key: str, query: str) -> tuple[CustomerSearch, bool]:
        timestamp = now()
        search = CustomerSearch(id=new_id('search'), status='queued', stage='Queued', query=query, created_at=timestamp, updated_at=timestamp)
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            old = db.execute('SELECT data FROM customer_searches WHERE tenant_id=? AND request_key=?', (self.tenant_id, request_key)).fetchone()
            if old:
                return CustomerSearch.model_validate_json(old['data']), False
            recent = db.execute('SELECT created_at,data FROM customer_searches WHERE tenant_id=? ORDER BY created_at DESC LIMIT 6', (self.tenant_id,)).fetchall()
            current = datetime.now(timezone.utc)
            def age(value):
                return (current - datetime.fromisoformat(value.replace('Z', '+00:00'))).total_seconds()
            if sum(age(row['created_at']) < 3600 for row in recent) >= 5:
                raise ValueError('Search allowance reached (5 per hour). Try again later.')
            if any(age(row['created_at']) < 180 and json.loads(row['data'])['status'] in ('queued', 'running') for row in recent):
                raise ValueError('A customer search is already running. Wait for it to finish.')
            db.execute('INSERT INTO customer_searches VALUES (?,?,?,?,?)', (self.tenant_id, search.id, request_key, timestamp, search.model_dump_json()))
        return search, True

    def save_customer_search(self, search: CustomerSearch) -> None:
        with self.connect() as db:
            db.execute('UPDATE customer_searches SET data=? WHERE tenant_id=? AND id=?', (search.model_dump_json(), self.tenant_id, search.id))

    def reserve_customer_draft(self, cache_key: str, request_key: str, *, allow_new=True):
        """Transactionally admit one attempt per immutable profile/evidence snapshot.

        A request key is never charged twice. Only an explicit new key after a
        terminal failure admits another attempt. Pending/successful snapshots
        deduplicate across keys; cached response aliases stay bound to the input.
        """
        from .customer_drafts import CustomerDraft, DraftError, DraftTerminalError
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            current = datetime.now(timezone.utc)
            def age(timestamp):
                return (current - datetime.fromisoformat(timestamp.replace('Z', '+00:00'))).total_seconds()
            def recover(expired_key):
                db.execute('UPDATE customer_drafts SET status=? WHERE tenant_id=? AND cache_key=? AND request_key=? AND status=?',
                           ('failed', self.tenant_id, cache_key, expired_key, 'pending'))
                db.execute('UPDATE customer_draft_requests SET status=? WHERE tenant_id=? AND request_key=? AND status=?',
                           ('failed', self.tenant_id, expired_key, 'pending'))
                # The terminal exception must not roll back this recovery.
                db.commit()
                raise DraftTerminalError('The earlier draft was interrupted. Choose Try draft again to make a new attempt.')
            old_request = db.execute('SELECT cache_key,status,data,created_at FROM customer_draft_requests WHERE tenant_id=? AND request_key=?',
                                     (self.tenant_id, request_key)).fetchone()
            if old_request and old_request['cache_key'] != cache_key:
                raise DraftError('This draft request belongs to an earlier business profile. Use a new request.')
            if old_request:
                if old_request['status'] == 'complete':
                    return CustomerDraft.model_validate_json(old_request['data'])
                if old_request['status'] == 'failed':
                    raise DraftTerminalError('This attempt could not finish. Choose Try draft again to make a new attempt.')
                if age(old_request['created_at']) > 90:
                    recover(request_key)
                raise DraftError('This draft is already in progress. Check it again shortly; no extra attempt was made.')
            old = db.execute('SELECT status,data,request_key,created_at FROM customer_drafts WHERE tenant_id=? AND cache_key=?',
                             (self.tenant_id, cache_key)).fetchone()
            if old:
                if old['status'] == 'complete':
                    aliases = db.execute('SELECT created_at FROM customer_draft_requests WHERE tenant_id=? AND cache_key=? AND charged=0 ORDER BY created_at DESC LIMIT 100',
                                         (self.tenant_id, cache_key)).fetchall()
                    if sum(age(row['created_at']) < 3600 for row in aliases) >= 100:
                        raise DraftError('Saved draft request allowance reached (100 per hour). Reuse the original request or try later.')
                    db.execute('INSERT INTO customer_draft_requests VALUES (?,?,?,?,?,?,?)',
                               (self.tenant_id, request_key, cache_key, now(), 'complete', 0, old['data']))
                    return CustomerDraft.model_validate_json(old['data'])
                if old['status'] == 'pending':
                    if age(old['created_at']) > 90:
                        recover(old['request_key'])
                    raise DraftError('This draft is already in progress. Check it again shortly; no extra attempt was made.')
            if not allow_new:
                raise DraftError('AI message drafting is not connected. Existing saved drafts remain available.')
            recent = db.execute('SELECT created_at FROM customer_draft_requests WHERE tenant_id=? AND charged=1 ORDER BY created_at DESC LIMIT 5',
                                (self.tenant_id,)).fetchall()
            if sum((current - datetime.fromisoformat(row['created_at'].replace('Z', '+00:00'))).total_seconds() < 3600 for row in recent) >= 5:
                raise DraftError('AI draft allowance reached (5 per hour). Try again later.')
            timestamp = now()
            db.execute('INSERT INTO customer_draft_requests VALUES (?,?,?,?,?,?,NULL)',
                       (self.tenant_id, request_key, cache_key, timestamp, 'pending', 1))
            db.execute('INSERT INTO customer_drafts VALUES (?,?,?,?,?,NULL) ON CONFLICT(tenant_id,cache_key) DO UPDATE SET request_key=excluded.request_key,created_at=excluded.created_at,status=excluded.status,data=NULL',
                       (self.tenant_id, cache_key, request_key, timestamp, 'pending'))
        return None

    def finish_customer_draft(self, cache_key: str, request_key: str, draft=None) -> bool:
        with self.connect() as db:
            updated = db.execute('UPDATE customer_drafts SET status=?,data=? WHERE tenant_id=? AND cache_key=? AND request_key=? AND status=?',
                       ('complete' if draft else 'failed', draft.model_dump_json() if draft else None,
                        self.tenant_id, cache_key, request_key, 'pending'))
            if not updated.rowcount:
                return False
            db.execute('UPDATE customer_draft_requests SET status=?,data=? WHERE tenant_id=? AND cache_key=? AND request_key=? AND status=?',
                       ('complete' if draft else 'failed', draft.model_dump_json() if draft else None,
                        self.tenant_id, cache_key, request_key, 'pending'))
        return True

    def save_profile(self, profile: Profile, website: str | None = None, *, set_website: bool = False) -> Workspace:
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT data FROM workspaces WHERE tenant_id=?', (self.tenant_id,)).fetchone()
            workspace = Workspace.model_validate_json(row['data'])
            # Older clients/website analysis do not know sender fields. Omission
            # preserves saved identity; an explicit empty string can clear it.
            if workspace.profile:
                profile = profile.model_copy(update={name: getattr(workspace.profile, name)
                    for name in ('sender_name', 'mailing_address', 'sender_contact')
                    if name not in profile.model_fields_set})
            workspace.name = profile.company_name
            if workspace.profile and any(getattr(workspace.profile, name) != getattr(profile, name)
                    for name in ('company_name', 'sender_name', 'mailing_address', 'sender_contact')):
                # Invalidate pending approvals, never rewrite immutable sent messages.
                from .outreach import OutreachThread
                for row in db.execute('SELECT id,data FROM outreach_threads WHERE tenant_id=?', (self.tenant_id,)).fetchall():
                    thread = OutreachThread.model_validate_json(row['data'])
                    if thread.approval:
                        thread.approval, thread.ready_for_manual_action = None, False
                        thread.revision += 1
                        db.execute('UPDATE outreach_threads SET data=? WHERE tenant_id=? AND id=?',
                                   (thread.model_dump_json(), self.tenant_id, row['id']))
            workspace.profile = profile
            if set_website:
                workspace.website = website
            db.execute('UPDATE workspaces SET data=? WHERE tenant_id=?',
                       (workspace.model_dump_json(), self.tenant_id))
        return workspace

    def campaigns(self) -> list[Campaign]:
        with self.connect() as db:
            rows = db.execute('SELECT data FROM campaigns WHERE tenant_id=? ORDER BY rowid DESC',
                              (self.tenant_id,)).fetchall()
        return [Campaign.model_validate_json(r['data']) for r in rows]

    def create_campaign(self, name: str, mode: str, domains: list[str]) -> Campaign:
        timestamp = now()
        campaign = Campaign(id=new_id('cmp'), name=name, mode=mode, status='draft',
                            created_at=timestamp, updated_at=timestamp, account_count=0,
                            qualified_count=0, domains=domains, errors=[])
        with self.connect() as db:
            count = db.execute('SELECT count(*) FROM campaigns WHERE tenant_id=?', (self.tenant_id,)).fetchone()[0]
            if count >= 250:
                raise ValueError('This local demo is limited to 250 campaigns')
            db.execute('INSERT INTO campaigns VALUES (?,?,?)',
                       (campaign.id, self.tenant_id, campaign.model_dump_json()))
        return campaign

    def campaign(self, campaign_id: str) -> Campaign | None:
        with self.connect() as db:
            row = db.execute('SELECT data FROM campaigns WHERE tenant_id=? AND id=?',
                             (self.tenant_id, campaign_id)).fetchone()
        return Campaign.model_validate_json(row['data']) if row else None

    def accounts(self, campaign_id: str) -> list[Account]:
        with self.connect() as db:
            rows = db.execute('SELECT data FROM accounts WHERE tenant_id=? AND campaign_id=?',
                              (self.tenant_id, campaign_id)).fetchall()
        return sorted((Account.model_validate_json(r['data']) for r in rows), key=lambda a: (-a.score, a.name))

    def account(self, account_id: str) -> Account | None:
        with self.connect() as db:
            row = db.execute('SELECT data FROM accounts WHERE tenant_id=? AND id=?',
                             (self.tenant_id, account_id)).fetchone()
        return Account.model_validate_json(row['data']) if row else None

    def set_account_status(self, account_id: str, status: str) -> Account | None:
        with self.connect() as db:
            row = db.execute('SELECT data FROM accounts WHERE tenant_id=? AND id=?',
                             (self.tenant_id, account_id)).fetchone()
            if not row:
                return None
            account = Account.model_validate_json(row['data'])
            account.status = status
            db.execute('UPDATE accounts SET data=? WHERE tenant_id=? AND id=?',
                       (account.model_dump_json(), self.tenant_id, account_id))
        return account

    def save_research(self, campaign_id: str, accounts: list[Account], errors: list[str]) -> Campaign:
        """Commit complete validated results atomically, retaining old failed-domain data.

        Existing account IDs and review statuses survive repeated research. An exception
        at any point rolls back all new accounts and campaign metadata together.
        """
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT data FROM campaigns WHERE tenant_id=? AND id=?',
                             (self.tenant_id, campaign_id)).fetchone()
            if not row:
                raise KeyError('Campaign not found')
            campaign = Campaign.model_validate_json(row['data'])
            for account in accounts:
                if account.campaign_id != campaign_id:
                    raise ValueError('Account belongs to a different campaign')
                row = db.execute('SELECT data FROM accounts WHERE tenant_id=? AND campaign_id=? AND domain=?',
                                 (self.tenant_id, campaign_id, account.domain)).fetchone()
                if row:
                    previous = Account.model_validate_json(row['data'])
                    account = account.model_copy(update={'id': previous.id, 'status': previous.status})
                db.execute('''INSERT INTO accounts VALUES (?,?,?,?,?)
                              ON CONFLICT(tenant_id,campaign_id,domain) DO UPDATE SET data=excluded.data''',
                           (account.id, campaign_id, self.tenant_id, account.domain, account.model_dump_json()))
            rows = db.execute('SELECT data FROM accounts WHERE tenant_id=? AND campaign_id=?',
                              (self.tenant_id, campaign_id)).fetchall()
            stored = [Account.model_validate_json(r['data']) for r in rows]
            campaign.account_count = len(stored)
            campaign.qualified_count = sum(a.score >= 65 for a in stored)
            campaign.status = ('partial' if accounts else 'failed') if errors else 'complete'
            campaign.errors = errors
            campaign.updated_at = now()
            db.execute('UPDATE campaigns SET data=? WHERE tenant_id=? AND id=?',
                       (campaign.model_dump_json(), self.tenant_id, campaign_id))
        return campaign
