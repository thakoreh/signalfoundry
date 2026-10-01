import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.config import preview_origin
from app.main import create_app


class PreviewTest(unittest.TestCase):
    def test_exact_origin_validation(self):
        self.assertEqual(preview_origin('https://preview.company.com'), 'https://preview.company.com')
        self.assertIsNone(preview_origin(''))
        for origin in ('http://preview.company.com', 'https://*.company.com', 'https://preview.company.com/',
                       'https://preview.company.com:443', 'https://user:pass@preview.company.com',
                       'https://127.0.0.1', 'https://preview.local', 'https://a..com', 'https://-a.com',
                       'https://preview.company.com\nmalicious'):
            with self.subTest(origin=origin), self.assertRaises(ValueError):
                preview_origin(origin)

    def test_public_preview_cannot_load_or_create_fictional_data(self):
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ, {
                'SIGNALFOUNDRY_PREVIEW_ORIGIN': 'https://preview.company.com',
                'SIGNALFOUNDRY_PUBLIC_ACCESS': 'true',
                'SIGNALFOUNDRY_DB_PATH': str(Path(tmp) / 'preview.sqlite3')}):
            with TestClient(create_app(testing=True)) as client:
                headers={'Origin':'https://preview.company.com'}
                self.assertEqual(client.post('/api/demo/reset',json={},headers=headers).status_code,410)
                self.assertEqual(client.post('/api/campaigns',json={'name':'Demo','mode':'demo','domains':[]},headers=headers).status_code,410)
                self.assertIsNone(client.get('/api/workspace').json()['profile'])

    def test_public_preview_health_does_not_claim_password_protection(self):
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ, {
                'SIGNALFOUNDRY_PREVIEW_ORIGIN': 'https://preview.company.com',
                'SIGNALFOUNDRY_PUBLIC_ACCESS': 'true',
                'SIGNALFOUNDRY_DB_PATH': str(Path(tmp) / 'preview.sqlite3')}):
            with TestClient(create_app(testing=True)) as client:
                self.assertEqual(client.get('/api/health').json()['mode'], 'public-preview')

    def test_preview_origin_and_data_path_are_explicit(self):
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ, {
                'SIGNALFOUNDRY_PREVIEW_ORIGIN': 'https://preview.company.com',
                'SIGNALFOUNDRY_DB_PATH': str(Path(tmp) / 'persistent' / 'preview.sqlite3')}):
            with TestClient(create_app(testing=True)) as client:
                response = client.get('/api/health', headers={'Origin': 'https://preview.company.com'})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()['mode'], 'protected-preview')
                self.assertTrue((Path(tmp) / 'persistent' / 'preview.sqlite3').is_file())
                for origin in ('https://evil.com', 'https://preview.company.com.evil.com', 'http://preview.company.com', 'null'):
                    self.assertEqual(client.get('/api/workspace', headers={'Origin': origin}).status_code, 403)
                # API Host is still loopback-only: public routing must go through the frontend/gateway.
                self.assertEqual(client.get('/api/workspace', headers={'Host': 'preview.company.com'}).status_code, 400)
                self.assertEqual(client.post('/api/demo/reset', content='{}', headers={
                    'Origin': 'https://preview.company.com', 'Content-Type': 'text/plain'}).status_code, 415)
