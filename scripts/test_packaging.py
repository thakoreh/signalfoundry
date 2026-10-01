#!/usr/bin/env python3
"""Packaging privacy regression: no runtime data, credentials or SQLite sidecars."""
import pathlib
import shutil
import subprocess
import tempfile
import unittest
import zipfile


class PackagingTest(unittest.TestCase):
    def test_runtime_data_and_secrets_never_enter_source_archive(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            (root / 'scripts').mkdir()
            shutil.copy(pathlib.Path(__file__).with_name('package.sh'), root / 'scripts/package.sh')
            omit = ['backend/data/signalfoundry.sqlite3', 'backend/data/unexpected.txt',
                    'other.sqlite3-wal', 'other.sqlite3-shm', 'other.sqlite3-journal',
                    'other.sqlite-wal', 'other.db-journal', '.env', '.env.local',
                    'deploy/secrets/preview.htpasswd', 'leaked.htpasswd', '.htpasswd', 'private.key', 'private.pem',
                    'frontend/node_modules/pkg/file.js', 'frontend/.next/build.js']
            keep = ['README.md', 'backend/app/main.py', 'backend/.env.example', 'frontend/package-lock.json']
            for name in omit + keep:
                p = root / name
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text('non-sensitive test content')
            archive = root / 'artifacts/source.zip'
            subprocess.run(['bash', str(root / 'scripts/package.sh'), str(archive)], check=True, capture_output=True)
            with zipfile.ZipFile(archive) as z:
                names = set(z.namelist())
            for name in omit:
                self.assertNotIn('signalfoundry-mvp/' + name, names)
            for name in keep:
                self.assertIn('signalfoundry-mvp/' + name, names)


if __name__ == '__main__':
    unittest.main()
