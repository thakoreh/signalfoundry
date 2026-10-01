#!/usr/bin/env python3
"""Protected-preview configuration tests, without production credentials."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('preview_config', ROOT / 'deploy/render_config.py')
config = importlib.util.module_from_spec(spec)
spec.loader.exec_module(config)


class DeploymentTest(unittest.TestCase):
    def test_missing_or_weak_auth_cannot_start(self):
        with tempfile.TemporaryDirectory() as tmp:
            password_file = Path(tmp) / 'preview.htpasswd'
            template = ROOT / 'deploy/nginx.conf.template'
            with self.assertRaises(FileNotFoundError):
                config.render('https://preview.company.com', password_file, template)
            for invalid in ('', 'preview:plaintext', 'preview:{SHA}weak', 'preview:$apr1$weak',
                            'preview:$2y$04$' + 'a'*53, 'preview:$2y$12$' + 'a'*53 + '\nother:password'):
                password_file.write_text(invalid)
                with self.subTest(value=invalid[:20]), self.assertRaises(ValueError):
                    config.render('https://preview.company.com', password_file, template)

    def test_gateway_protects_all_paths_and_preserves_boundaries(self):
        with tempfile.TemporaryDirectory() as tmp:
            password_file = Path(tmp) / 'preview.htpasswd'
            # Syntactically valid placeholder, never a real account or credential.
            password_file.write_text('preview:$2y$12$' + 'a'*53)
            rendered = config.render('https://preview.company.com', password_file, ROOT / 'deploy/nginx.conf.template')
            self.assertNotIn('@@', rendered)
            self.assertNotIn('a'*53, rendered)
            self.assertIn('auth_basic_user_file ' + str(password_file), rendered)
            self.assertEqual(rendered.count('location '), 1)
            self.assertIn('location / {', rendered)
            self.assertNotIn('auth_basic off', rendered)
            self.assertIn('if ($allowed_origin = 0) { return 403; }', rendered)
            self.assertIn('if ($http_forwarded != "") { return 403; }', rendered)
            self.assertIn('if ($http_x_forwarded_proto != "https") { return 426; }', rendered)
            self.assertIn('proxy_set_header Authorization "";', rendered)
            self.assertIn('proxy_pass http://127.0.0.1:3000', rendered)
            for bad_origin in ('', 'http://preview.company.com', 'https://evil.com; return 200;'):
                with self.assertRaises(ValueError):
                    config.render(bad_origin, password_file, ROOT / 'deploy/nginx.conf.template')

    def test_explicit_public_access_needs_no_password_and_keeps_request_guards(self):
        rendered = config.render('https://preview.company.com', Path('/missing/preview.htpasswd'),
                                 ROOT / 'deploy/nginx.conf.template', public_access=True)
        self.assertIn('auth_basic off;', rendered)
        self.assertNotIn('auth_basic_user_file', rendered)
        self.assertIn('if ($allowed_origin = 0) { return 403; }', rendered)
        self.assertIn('if ($http_x_forwarded_proto != "https") { return 426; }', rendered)
        self.assertIn('limit_req zone=preview_requests', rendered)
        self.assertNotIn('@@', rendered)
        with self.assertRaises(ValueError):
            config.render('http://preview.company.com', Path('/missing/preview.htpasswd'),
                          ROOT / 'deploy/nginx.conf.template', public_access=True)

    def test_container_does_not_publish_or_copy_private_application_data(self):
        dockerfile = (ROOT / 'Dockerfile').read_text()
        self.assertIn('USER 10001:10001', dockerfile)
        self.assertIn('EXPOSE 8080', dockerfile)
        self.assertNotIn('EXPOSE 8000', dockerfile)
        self.assertNotIn('COPY . ', dockerfile)
        compose = (ROOT / 'deploy/compose.preview.yml').read_text()
        self.assertNotIn('\n    ports:', compose)
        self.assertIn('mem_limit: 768m', compose)
        self.assertIn('signalfoundry-data:/app/data', compose)
        self.assertIn('no-new-privileges:true', compose)


if __name__ == '__main__':
    unittest.main()
