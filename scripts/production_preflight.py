#!/usr/bin/env python3
"""Offline source gates. Does not read runtime secrets or assert live readiness."""
import ast
from pathlib import Path
import re
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]


def source_files():
    result = subprocess.run(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'],
                            cwd=ROOT, check=True, capture_output=True)
    for raw in result.stdout.split(b'\0'):
        if not raw:
            continue
        path = ROOT / raw.decode()
        # Never open runtime env/secret files. Only public example env is checked.
        if (path.is_file() and path.stat().st_size <= 2_000_000 and
                path.suffix in ('.py', '.ts', '.tsx', '.js', '.mjs', '.json', '.yml', '.yaml', '.md', '.sh') and
                not any(part.startswith('.env') or part in ('secrets', 'data', 'artifacts') for part in path.parts)):
            yield path


class ProductionSourceChecks(unittest.TestCase):
    def test_worker_image_is_isolated_nonroot_and_secret_free(self):
        dockerfile = (ROOT / 'deploy/worker.Dockerfile').read_text()
        self.assertIn('USER 10001:10001', dockerfile)
        self.assertIn('app.worker:app', dockerfile)
        self.assertIn('--no-access-log', dockerfile)
        self.assertIn('FORWARDED_ALLOW_IPS=""', dockerfile)
        self.assertNotIn('COPY . ', dockerfile)
        self.assertIn('**/.convex', (ROOT / '.dockerignore').read_text())
        self.assertNotIn('COPY backend/app /', dockerfile)
        copy_lines = '\n'.join(line for line in dockerfile.splitlines() if line.startswith('COPY '))
        for forbidden in ('app/main.py', 'app/store.py', '.env', 'data/', '.htpasswd'):
            self.assertNotIn(forbidden, copy_lines)
        compose = (ROOT / 'deploy/worker.compose.yml').read_text()
        for required in ('read_only: true', 'cap_drop: [ALL]', 'no-new-privileges:true',
                         'pids_limit: 64', 'mem_limit: 256m', 'SIGNALFOUNDRY_WORKER_ALLOW_PRIVATE_HTTP: "false"'):
            self.assertIn(required, compose)
        self.assertNotIn('\n    ports:', compose)
        self.assertNotIn('\n    volumes:', compose)

    def test_worker_imports_cannot_reach_demo_persistence(self):
        allowed = {'worker', 'worker_config', 'primitives', 'models', 'fixtures', 'research', 'safety', 'jev', '__init__'}
        for name in allowed:
            tree = ast.parse((ROOT / 'backend/app' / f'{name}.py').read_text())
            for node in ast.walk(tree):
                if isinstance(node, ast.ImportFrom) and node.level:
                    self.assertIn(node.module, allowed, f'{name} imported forbidden module {node.module}')
                if isinstance(node, ast.Import):
                    for imported in node.names:
                        self.assertNotIn(imported.name, ('sqlite3', 'app.main', 'app.store'))

    def test_only_blank_secret_placeholders_in_worker_example(self):
        example = (ROOT / 'deploy/worker.env.example').read_text()
        for line in example.splitlines():
            if line and not line.startswith('#'):
                key, value = line.split('=', 1)
                if any(word in key for word in ('TOKEN', 'KEY', 'SECRET', 'PASSWORD')):
                    self.assertEqual(value, '', f'{key} must be a blank operator placeholder')

    def test_high_confidence_credential_patterns_absent_from_current_source(self):
        # Targeted regressions, not a claim of comprehensive secret detection.
        # Construct signatures in pieces to avoid matching the scanner itself.
        patterns = [re.compile(r'\$2[aby]\$\d\d\$' + r'[A-Za-z0-9./]{53}'),
                    re.compile('sk_' + r'(?:live|test)_[A-Za-z0-9]{20,}'),
                    re.compile('whsec_' + r'[A-Za-z0-9]{20,}'),
                    re.compile('AKIA' + r'[A-Z0-9]{16}'),
                    re.compile('-----BEGIN ' + r'(?:RSA |EC |OPENSSH )?PRIVATE KEY-----')]
        findings = []
        for path in source_files():
            content = path.read_text(errors='replace')
            if any(pattern.search(content) for pattern in patterns):
                findings.append(str(path.relative_to(ROOT)))
        self.assertEqual(findings, [], 'Credential-pattern matches in files (values redacted): ' + ', '.join(findings))

    def test_provider_auth_tests_use_runtime_generated_fixtures(self):
        path = ROOT / 'backend/tests/test_jev.py'
        source = path.read_text()
        self.assertIn('secrets.token_urlsafe(', source)
        for node in ast.walk(ast.parse(source)):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == 'JevDecisionProvider':
                if node.args and isinstance(node.args[0], ast.Constant):
                    self.assertIsNone(node.args[0].value, 'Never hardcode provider test credentials')
        preview_test = (ROOT / 'scripts/test_deployment.py').read_text()
        self.assertIn('secrets.choice(', preview_test)
        self.assertNotIn("'a'*53", preview_test)


if __name__ == '__main__':
    print('Checking current source only; runtime configuration, deployments, and historical secret alerts are not verified.', flush=True)
    unittest.main(verbosity=2)
