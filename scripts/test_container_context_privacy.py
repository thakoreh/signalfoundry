#!/usr/bin/env python3
"""Test real Docker ignore semantics using manufactured files only. No network.

Requires Docker; absence/failure is a failure, never a skip-as-success. The real
repository/data is never a build context here. No image process is executed.
"""
import io
from pathlib import Path
import secrets
import subprocess
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def command(*args, binary=False):
    result = subprocess.run(['docker', *args], capture_output=True, timeout=60)
    if result.returncode:
        raise RuntimeError('Docker privacy fixture operation failed; no private data was used or logged.')
    return result.stdout if binary else result.stdout.decode().strip()


def run():
    suffix = secrets.token_hex(16)
    image, name = 'clientrove-context-fixture:' + suffix, 'clientrove-context-fixture-' + suffix
    built, container = False, None
    with tempfile.TemporaryDirectory(prefix='clientrove-context-fictional-') as directory:
        root = Path(directory)
        (root / '.dockerignore').write_bytes((ROOT / '.dockerignore').read_bytes())
        (root / 'Dockerfile').write_text('FROM scratch\nCOPY . /context/\n', encoding='utf-8')
        omit = ['private/policy.json', 'frontend/private/policy.json', 'backend/app/private/policy.json',
                'exports/workspace.json', 'frontend/exports/workspace.json', 'frontend/backups/billing.json',
                'frontend/.local/diagnostics.json', 'frontend/public/customer-list.csv', 'backend/app/.local/draft.json',
                '.env', 'frontend/.env.local', 'backend/data/workspace.sqlite3', 'other.sqlite3-wal',
                'deploy/secrets/private.key', 'frontend/node_modules/fixture/index.js', 'frontend/.next/private.json']
        keep = ['README.md', 'frontend/public/mark.svg', 'backend/app/main.py', 'backend/.env.example']
        for value in omit + keep:
            path = root / value
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('MANUFACTURED NONSECRET CONTEXT FIXTURE', encoding='utf-8')
        try:
            command('build', '--network', 'none', '--tag', image, str(root)); built = True
            container = command('create', '--name', name, '--network', 'none', image, '/never-executed')
            exported = command('export', container, binary=True)
            if len(exported) > 2_000_000:
                raise AssertionError('Fictional container context unexpectedly exceeded its bound')
            with tarfile.open(fileobj=io.BytesIO(exported), mode='r:') as archive:
                names = {member.name.lstrip('./') for member in archive.getmembers()}
            for value in omit:
                assert 'context/' + value not in names, 'Private fixture unexpectedly entered a build context: ' + value
            for value in keep:
                assert 'context/' + value in names, 'Public source fixture was unexpectedly dropped: ' + value
            print('PASS: actual Docker context excludes private/export/backup/local/CSV/runtime fixtures while keeping public source. No real data, external network or container process.')
        finally:
            if container:
                command('rm', '--force', container)
            if built:
                command('image', 'rm', '--force', image)


if __name__ == '__main__': run()
