"""Local-only data operations. No network, secrets, reset or live restore path.

Erasure closes this tenant permanently in this authority. Minimal suppression,
financial and deletion facts remain; it is not a marketing-data reset.
"""
from __future__ import annotations
import hashlib
import json
from contextlib import closing
import os
from pathlib import Path
import sqlite3
import tempfile

from .primitives import now

DATA_TABLES = ('workspaces', 'campaigns', 'accounts', 'customer_searches',
               'customer_drafts', 'customer_draft_requests', 'outreach_threads', 'outreach_requests')
CONTROL_SCHEMA = '''CREATE TABLE IF NOT EXISTS local_controls (
 name TEXT NOT NULL, scope_id TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(name,scope_id));'''


class WorkspaceClosed(ValueError):
    pass


def install_controls(db):
    db.execute(CONTROL_SCHEMA)
    # Database enforcement also catches already-running stale jobs/connections.
    for table in DATA_TABLES:
        for operation in ('INSERT', 'UPDATE'):
            db.execute(f'''CREATE TRIGGER IF NOT EXISTS closed_{table}_{operation.lower()}
              BEFORE {operation} ON {table}
              WHEN EXISTS (SELECT 1 FROM local_controls WHERE
                (name='erased' AND scope_id=NEW.tenant_id) OR name='quarantine')
              BEGIN SELECT RAISE(ABORT,'local_workspace_closed'); END''')


def closed(db, tenant):
    return bool(db.execute("SELECT 1 FROM local_controls WHERE (name='erased' AND scope_id=?) OR name='quarantine' LIMIT 1", (tenant,)).fetchone())


def export_tenant(repository):
    """One consistent tenant snapshot. No private pricing/catalogue/global rows."""
    with repository.connect() as db:
        db.execute('BEGIN')
        result = {'format': 'clientrove-local-export-v1', 'exported_at': now(), 'tenant': repository.tenant_id,
                  'provenance': 'Saved research and manual reports; not delivery, inbox or calendar evidence.', 'records': {}}
        for table in DATA_TABLES + ('outreach_suppressions',):
            rows = db.execute(f'SELECT * FROM {table} WHERE tenant_id=? LIMIT 10001', (repository.tenant_id,)).fetchall()
            if len(rows) > 10000:
                raise ValueError('The local export exceeds its bounded allowance. Use an operator backup instead.')
            result['records'][table] = [dict(row) for row in rows]
        result['retention'] = 'Minimal opt-out/suppression, financial audit and closure facts survive operator erasure. Files exported or sent elsewhere require separate deletion.'
        if len(json.dumps(result, ensure_ascii=True).encode()) > 32 * 1024 * 1024:
            raise ValueError('The local export exceeds its bounded allowance. Use an operator backup instead.')
        return result


def erase_tenant(repository, confirmation):
    if confirmation != 'ERASE AND CLOSE ' + repository.tenant_id:
        raise ValueError('Exact tenant closure confirmation is required.')
    with repository.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        if closed(db, repository.tenant_id):
            raise WorkspaceClosed('This local workspace is already closed.')
        # Suppression/financial records are deliberately NOT removed or reset.
        for table in reversed(DATA_TABLES):
            db.execute(f'DELETE FROM {table} WHERE tenant_id=?', (repository.tenant_id,))
        if db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='cost_policies'").fetchone():
            db.execute("UPDATE cost_policies SET enabled=0 WHERE scope='tenant' AND scope_id=?", (repository.tenant_id,))
        db.execute("INSERT INTO local_controls VALUES ('erased',?,?)", (repository.tenant_id, now()))


def _existing(path):
    path = Path(path).resolve(strict=True)
    if not path.is_file():
        raise ValueError('Use an existing SQLite file.')
    return path


def _new_output(path):
    path = Path(path).absolute()
    if not path.parent.is_dir() or path.exists() or path.is_symlink():
        raise ValueError('The output must be a new file in an existing private directory.')
    # Exclusive creation refuses aliases to any existing authority or backup.
    path.touch(mode=0o600, exist_ok=False)
    return path


def backup_database(source, destination):
    source = _existing(source)
    target = _new_output(destination)
    try:
        with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as live, closing(sqlite3.connect(target)) as copy:
            live.backup(copy)
            if copy.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise ValueError('Backup integrity check failed.')
        return {'format': 'clientrove-local-backup-v1', 'created_at': now(), 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                'activation': 'Not authorized. Restores must be isolated and quarantined; a historical backup cannot replace current suppression or monetary authority.'}
    except BaseException:
        target.unlink(missing_ok=True)
        raise


def restore_quarantined(source, destination):
    """Restore drill only: fresh path, durable no-write/no-paid activation gate.

    Never replaces a live database or claims to reconcile newer suppressions,
    deletions or receipts. There is intentionally no unquarantine command.
    """
    destination = Path(destination).absolute()
    if not destination.parent.is_dir() or destination.exists() or destination.is_symlink():
        raise ValueError('The restore output must be a new file in an existing private directory.')
    # Never publish an active copy at the requested output, even if the process
    # dies before quarantine. A hard-link publish is atomic and cannot overwrite.
    with tempfile.TemporaryDirectory(prefix='.clientrove-restore-', dir=destination.parent) as stage:
        target = Path(stage) / 'staged.sqlite3'
        manifest = backup_database(source, target)
        with closing(sqlite3.connect(target)) as db, db:
            db.row_factory = sqlite3.Row
            for table in DATA_TABLES + ('outreach_suppressions',):
                if not db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone():
                    raise ValueError('The backup lacks required app tables.')
            install_controls(db)
            db.execute("INSERT OR IGNORE INTO local_controls VALUES ('quarantine','all',?)", (now(),))
            if db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='cost_policies'").fetchone():
                db.execute('UPDATE cost_policies SET enabled=0')
            if db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='paid_attempts'").fetchone():
                db.execute("UPDATE paid_attempts SET status='uncertain' WHERE status='dispatching'")
        manifest['sha256'] = hashlib.sha256(target.read_bytes()).hexdigest()
        manifest['activation'] = 'QUARANTINED restore drill only. App writes and new paid admission denied. No activation command exists.'
        os.link(target, destination)
        return manifest
