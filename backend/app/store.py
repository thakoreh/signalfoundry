"""SQLite repository. Every lookup and mutation is explicitly tenant scoped.

This is defense-in-depth data organization, NOT authentication: the local demo
always injects one server-controlled tenant and does not accept client tenant IDs.
"""
from __future__ import annotations
import json
import re
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .models import Account, AccountStatus, Campaign, Profile, Workspace
from .primitives import new_id, now


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
              -- Latest user-authored metadata only; never copy licensed company/contact payloads.
              CREATE TABLE IF NOT EXISTS account_feedback (
                tenant_id TEXT NOT NULL, campaign_id TEXT NOT NULL, domain TEXT NOT NULL,
                account_id TEXT NOT NULL, status TEXT NOT NULL, reason TEXT,
                reviewed_at TEXT NOT NULL,
                PRIMARY KEY (tenant_id, campaign_id, domain)
              );
              CREATE TABLE IF NOT EXISTS workspace_suppressions (
                tenant_id TEXT NOT NULL, domain TEXT NOT NULL, campaign_id TEXT NOT NULL,
                account_id TEXT NOT NULL, reason TEXT, updated_at TEXT NOT NULL,
                PRIMARY KEY (tenant_id, domain)
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

    def save_profile(self, profile: Profile, website: str | None = None, *, set_website: bool = False) -> Workspace:
        with self.connect() as db:
            row = db.execute('SELECT data FROM workspaces WHERE tenant_id=?', (self.tenant_id,)).fetchone()
            workspace = Workspace.model_validate_json(row['data'])
            workspace.name = profile.company_name
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

    def create_campaign(self, name: str, mode: str, domains: list[str], *, profile_snapshot: Profile | None = None,
                        target_count: int = 10, offering_website: str | None = None,
                        enrich_contacts: bool = False) -> Campaign:
        timestamp = now()
        campaign = Campaign(id=new_id('cmp'), name=name, mode=mode, status='draft',
                            created_at=timestamp, updated_at=timestamp, account_count=0,
                            qualified_count=0, domains=domains, errors=[],
                            profile_snapshot=profile_snapshot or self.workspace().profile,
                            target_count=target_count, offering_website=offering_website,
                            enrich_contacts=enrich_contacts)
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
            accounts = [self._reviewed_account(db, Account.model_validate_json(r['data'])) for r in rows]
        return sorted(accounts, key=lambda a: (-a.score, a.name))

    def account(self, account_id: str) -> Account | None:
        with self.connect() as db:
            row = db.execute('SELECT data FROM accounts WHERE tenant_id=? AND id=?',
                             (self.tenant_id, account_id)).fetchone()
            return self._reviewed_account(db, Account.model_validate_json(row['data'])) if row else None

    @staticmethod
    def _feedback_domain(domain: str) -> str:
        # One exact business host, never a category, geography, or parent-domain wildcard.
        value = domain.strip().lower().rstrip('.').removeprefix('www.')
        if len(value) > 253 or not re.fullmatch(r'[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?', value) or '.' not in value or any(not label or len(label) > 63 or label.startswith('-') or label.endswith('-') for label in value.split('.')):
            raise ValueError('Enter an exact company domain without a URL path')
        return value

    def _suppression(self, db, domain: str):
        return db.execute('SELECT * FROM workspace_suppressions WHERE tenant_id=? AND domain=?',
                          (self.tenant_id, self._feedback_domain(domain))).fetchone()

    def is_research_excluded(self, campaign_id: str, domain: str) -> bool:
        with self.connect() as db:
            if self._suppression(db, domain):
                return True
            canonical = self._feedback_domain(domain)
            feedback = db.execute('''SELECT status FROM account_feedback
                WHERE tenant_id=? AND campaign_id=? AND domain=?''',
                (self.tenant_id, campaign_id, canonical)).fetchone()
            if feedback:
                return feedback['status'] == 'dismissed'
            # Preserve pre-feedback-version review statuses without bulk migrations.
            rows = db.execute('SELECT data FROM accounts WHERE tenant_id=? AND campaign_id=? LIMIT 31',
                (self.tenant_id, campaign_id)).fetchall()
            return any(self._feedback_domain(a.domain) == canonical and a.status == 'dismissed'
                for a in (Account.model_validate_json(row['data']) for row in rows))

    def is_workspace_suppressed(self, domain: str) -> bool:
        with self.connect() as db:
            return self._suppression(db, domain) is not None

    def workspace_suppressions(self, *, after: str = '', limit: int = 50) -> dict:
        if not 1 <= limit <= 100:
            raise ValueError('Suppression page limit must be between 1 and 100')
        with self.connect() as db:
            rows = db.execute('''SELECT domain,campaign_id,account_id,reason,updated_at
                                 FROM workspace_suppressions WHERE tenant_id=? AND domain>?
                                 ORDER BY domain LIMIT ?''', (self.tenant_id, after, limit + 1)).fetchall()
        page = [dict(row) for row in rows[:limit]]
        return {'items': page, 'continue_cursor': page[-1]['domain'] if len(rows) > limit else None,
                'is_done': len(rows) <= limit}

    def restore_workspace_domain(self, domain: str) -> None:
        with self.connect() as db:
            db.execute('DELETE FROM workspace_suppressions WHERE tenant_id=? AND domain=?',
                       (self.tenant_id, self._feedback_domain(domain)))

    def _reviewed_account(self, db, account: Account) -> Account:
        feedback = db.execute('''SELECT status,reason,reviewed_at FROM account_feedback
                                 WHERE tenant_id=? AND campaign_id=? AND domain=?''',
                              (self.tenant_id, account.campaign_id, self._feedback_domain(account.domain))).fetchone()
        updates = {'suppress_workspace': self._suppression(db, account.domain) is not None}
        if feedback:
            updates.update(status=feedback['status'], review_reason=feedback['reason'],
                           reviewed_at=feedback['reviewed_at'])
        return account.model_copy(update=updates)

    def set_account_status(self, account_id: str, status: str, *, reason: str | None = None,
                           suppress_workspace: bool | None = None,
                           preserve_workspace_suppression: bool = False) -> Account | None:
        # Repository callers get the same validation as the HTTP boundary.
        scope = {'suppress_workspace': suppress_workspace} if suppress_workspace is not None else {}
        update = AccountStatus(status=status, reason=reason,
            preserve_workspace_suppression=preserve_workspace_suppression, **scope)
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT data FROM accounts WHERE tenant_id=? AND id=?',
                             (self.tenant_id, account_id)).fetchone()
            if not row:
                return None
            account = Account.model_validate_json(row['data'])
            domain, timestamp = self._feedback_domain(account.domain), now()
            db.execute('''INSERT INTO account_feedback VALUES (?,?,?,?,?,?,?)
                          ON CONFLICT(tenant_id,campaign_id,domain) DO UPDATE SET
                          account_id=excluded.account_id,status=excluded.status,
                          reason=excluded.reason,reviewed_at=excluded.reviewed_at''',
                       (self.tenant_id, account.campaign_id, domain, account.id,
                        update.status, update.reason, timestamp))
            if suppress_workspace is True:
                db.execute('''INSERT INTO workspace_suppressions VALUES (?,?,?,?,?,?)
                              ON CONFLICT(tenant_id,domain) DO UPDATE SET
                              campaign_id=excluded.campaign_id,account_id=excluded.account_id,
                              reason=excluded.reason,updated_at=excluded.updated_at''',
                           (self.tenant_id, domain, account.campaign_id, account.id, update.reason, timestamp))
            elif suppress_workspace is False or (update.status != 'dismissed' and not update.preserve_workspace_suppression):
                db.execute('DELETE FROM workspace_suppressions WHERE tenant_id=? AND domain=?',
                           (self.tenant_id, domain))
            account = self._reviewed_account(db, account)
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
                review = db.execute('SELECT status FROM account_feedback WHERE tenant_id=? AND campaign_id=? AND domain=?',
                    (self.tenant_id, campaign_id, self._feedback_domain(account.domain))).fetchone()
                if self._suppression(db, account.domain) or (review and review['status'] == 'dismissed'):
                    continue
                if not review:
                    legacy = db.execute('SELECT data FROM accounts WHERE tenant_id=? AND campaign_id=? LIMIT 31',
                        (self.tenant_id, campaign_id)).fetchall()
                    if any(self._feedback_domain(item.domain) == self._feedback_domain(account.domain) and item.status == 'dismissed'
                           for item in (Account.model_validate_json(item['data']) for item in legacy)):
                        continue
                if row:
                    previous = Account.model_validate_json(row['data'])
                    if not review and previous.status == 'dismissed':
                        continue
                    account = account.model_copy(update={'id': previous.id, 'status': previous.status,
                        'review_reason': previous.review_reason, 'reviewed_at': previous.reviewed_at})
                else:
                    # Provider output cannot invent a user's review decision.
                    account = account.model_copy(update={'status': 'new', 'review_reason': None,
                        'reviewed_at': None, 'suppress_workspace': False})
                account = self._reviewed_account(db, account)
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
