"""SQLite repository. Every lookup and mutation is explicitly tenant scoped.

This is defense-in-depth data organization, NOT authentication: the local demo
always injects one server-controlled tenant and does not accept client tenant IDs.
"""
from __future__ import annotations
import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .models import Account, Campaign, Profile, Workspace
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
                        target_count: int = 10, offering_website: str | None = None) -> Campaign:
        timestamp = now()
        campaign = Campaign(id=new_id('cmp'), name=name, mode=mode, status='draft',
                            created_at=timestamp, updated_at=timestamp, account_count=0,
                            qualified_count=0, domains=domains, errors=[],
                            profile_snapshot=profile_snapshot or self.workspace().profile,
                            target_count=target_count, offering_website=offering_website)
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
