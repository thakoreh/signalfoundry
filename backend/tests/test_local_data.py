"""Fictional local privacy/restore fixtures. Never accesses owner data."""
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from app.cost_admission import CostDenied, CostLedger
from app.fixtures import DEMO_PROFILE
from app.local_data import WorkspaceClosed, backup_database, erase_tenant, export_tenant, restore_quarantined
from app.main import create_app
from app.store import Repository


class LocalDataTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'fictional.sqlite3'
        self.repo = Repository(self.path)
        self.repo.save_profile(DEMO_PROFILE)
        self.search, _ = self.repo.create_customer_search('fictional_request', 'Fictional private buyer query')
        self.other = Repository(self.path, 'fictional_other')
        self.other.save_profile(DEMO_PROFILE.model_copy(update={'company_name': 'Other Fictional Tenant'}))
        self.ledger = CostLedger(self.repo)
        with self.repo.connect() as db:
            db.execute('INSERT INTO outreach_suppressions VALUES (?,?,?,?)', ('local-demo', 'email:stopped@example.org', 'opt_out', '2026-10-20T00:00:00Z'))

    def test_export_is_consistent_tenant_scoped_and_does_not_create_work(self):
        before = self.path.stat().st_size
        result = export_tenant(self.repo)
        encoded = json.dumps(result)
        self.assertIn('Fictional private buyer query', encoded)
        self.assertNotIn('Other Fictional Tenant', encoded)
        self.assertNotIn('cost_policies', encoded)
        self.assertIn('stopped@example.org', encoded)
        self.assertIsNotNone(self.repo.customer_search(self.search.id))
        self.assertGreater(before, 0)

    def test_export_http_is_local_only_attachment_and_no_store(self):
        with TestClient(create_app(self.path, testing=True)) as client:
            response = client.get('/api/privacy/export')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers['cache-control'], 'no-store')
            self.assertIn('attachment;', response.headers['content-disposition'])
            self.assertEqual(response.json()['format'], 'clientrove-local-export-v1')
        with patch.dict('os.environ', {'SIGNALFOUNDRY_PUBLIC_ACCESS': 'true'}), TestClient(create_app(self.path, testing=True)) as client:
            self.assertEqual(client.get('/api/privacy/export').status_code, 403)

    def test_erase_closes_stale_writers_and_retains_stop_and_financial_authority(self):
        with self.repo.connect() as db:
            db.execute("INSERT INTO cost_policies VALUES ('tenant','local-demo','2026-10',25000000,123,'2026-10-01T00:00:00Z','fictional statement',1,'{}')")
        with self.assertRaises(ValueError):
            erase_tenant(self.repo, 'wrong')
        self.assertIsNotNone(self.repo.customer_search(self.search.id))
        erase_tenant(self.repo, 'ERASE AND CLOSE local-demo')
        self.assertTrue(self.repo.closed())
        self.assertIsNone(self.repo.customer_search(self.search.id))
        self.assertEqual(self.other.workspace().profile.company_name, 'Other Fictional Tenant')
        for save in (lambda: self.repo.save_profile(DEMO_PROFILE), lambda: self.repo.save_customer_search(self.search),
                     lambda: self.repo.create_customer_search('new_request', 'Stale request')):
            with self.assertRaises(WorkspaceClosed):
                save()
        reopened = Repository(self.path)
        self.assertTrue(reopened.closed())
        with reopened.connect() as db:
            self.assertEqual(db.execute("SELECT historical,enabled FROM cost_policies WHERE scope_id='local-demo'").fetchone()[:], (123, 0))
            self.assertEqual(db.execute("SELECT COUNT(*) FROM outreach_suppressions WHERE tenant_id='local-demo'").fetchone()[0], 1)
        with self.assertRaisesRegex(CostDenied, 'closed'):
            self.ledger.reserve('local-demo', 'late_attempt', 'deepseek:search', {})
        with TestClient(create_app(self.path, testing=True)) as client:
            self.assertEqual(client.get('/api/workspace').status_code, 410)
            self.assertEqual(client.put('/api/workspace/profile', json=DEMO_PROFILE.model_dump()).status_code, 410)

    def test_preexisting_raw_writer_cannot_resurrect_a_closed_tenant(self):
        stale = sqlite3.connect(self.path)
        self.addCleanup(stale.close)
        erase_tenant(self.repo, 'ERASE AND CLOSE local-demo')
        with self.assertRaisesRegex(sqlite3.IntegrityError, 'local_workspace_closed'):
            stale.execute('INSERT INTO customer_searches VALUES (?,?,?,?,?)', ('local-demo', 'stale_search', 'stale_key', self.search.created_at, self.search.model_dump_json()))
        stale.rollback()
        self.assertIsNone(self.repo.customer_search('stale_search'))

    def test_restore_preserves_financial_exposure_and_suppression_without_enabling_dispatch(self):
        with self.repo.connect() as db:
            db.execute("INSERT INTO paid_attempts(tenant,attempt,operation,fingerprint,period,reserved,actual,status,quote,usage,created_at,finished_at) VALUES ('local-demo','fictional_hold','deepseek:search','fictional_hash','2026-10',123,NULL,'dispatching','{}',NULL,'2026-10-21T10:00:00Z',NULL)")
        target = self.path.parent / 'hold-drill.sqlite3'
        restore_quarantined(self.path, target)
        restored = Repository(target)
        with restored.connect() as db:
            self.assertEqual(db.execute("SELECT reserved,status FROM paid_attempts WHERE attempt='fictional_hold'").fetchone()[:], (123, 'uncertain'))
            self.assertEqual(db.execute('SELECT COUNT(*) FROM outreach_suppressions').fetchone()[0], 1)
        with self.repo.connect() as db:
            self.assertEqual(db.execute("SELECT status FROM paid_attempts WHERE attempt='fictional_hold'").fetchone()[0], 'dispatching')

    def test_backup_is_wal_consistent_exclusive_and_does_not_overwrite_authority(self):
        destination = self.path.parent / 'fictional-backup.sqlite3'
        manifest = backup_database(self.path, destination)
        self.assertEqual(len(manifest['sha256']), 64)
        snapshot = Repository(destination)
        self.assertEqual(snapshot.workspace().profile, self.repo.workspace().profile)
        self.assertIsNotNone(snapshot.customer_search(self.search.id))
        with self.assertRaises(ValueError):
            backup_database(self.path, self.path)
        with self.assertRaises(ValueError):
            backup_database(self.path, destination)
        self.assertFalse(self.repo.closed())

    def test_restore_drill_is_new_quarantined_and_cannot_send_or_spend(self):
        target = self.path.parent / 'fictional-restored.sqlite3'
        restore_quarantined(self.path, target)
        restored = Repository(target)
        self.assertTrue(restored.closed())
        self.assertIsNotNone(restored.customer_search(self.search.id))
        with self.assertRaises(WorkspaceClosed):
            restored.save_profile(DEMO_PROFILE)
        with self.assertRaises(CostDenied):
            CostLedger(restored).reserve('local-demo', 'restored_attempt', 'deepseek:search', {})
        with TestClient(create_app(target, testing=True)) as client:
            self.assertEqual(client.get('/api/workspace').status_code, 410)
        self.assertFalse(self.repo.closed(), 'The authoritative database was not changed')
        self.assertIsNotNone(self.repo.customer_search(self.search.id))

    def test_invalid_restore_is_not_left_as_a_runnable_database(self):
        invalid = self.path.parent / 'wrong.sqlite3'
        with sqlite3.connect(invalid) as db:
            db.execute('CREATE TABLE not_an_app (x TEXT)')
        db.close()
        destination = self.path.parent / 'failed-restore.sqlite3'
        with self.assertRaises(ValueError):
            restore_quarantined(invalid, destination)
        self.assertFalse(destination.exists())
