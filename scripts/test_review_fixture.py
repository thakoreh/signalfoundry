#!/usr/bin/env python3
"""Review seed is new-file-only and contains no real account/provider data."""
import hashlib
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from seed_local_review import seed


class ReviewFixtureTest(unittest.TestCase):
    def test_review_queue_has_all_expected_states_and_existing_file_is_untouched(self):
        from app.store import Repository
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'fictional-review.sqlite3'
            routes = seed(path)
            repo = Repository(path)
            self.assertTrue(repo.workspace().profile.company_name.startswith('FICTIONAL'))
            threads = repo.outreach_threads()['threads']
            self.assertEqual(len(threads), 5)
            self.assertTrue(all(thread['company_name'].startswith('FICTIONAL') for thread in threads))
            actions = {item['action'] for item in repo.outreach_next_up()['items']}
            self.assertTrue({'review_message', 'review_followup', 'answer_reply', 'report_meeting'} <= actions)
            self.assertTrue(routes['results'].startswith('/workspace/customers/search_'))
            before = hashlib.sha256(path.read_bytes()).digest()
            with self.assertRaises(ValueError): seed(path)
            self.assertEqual(hashlib.sha256(path.read_bytes()).digest(), before)
            command = [sys.executable, str(Path(__file__).with_name('seed_local_review.py')), '--db', str(path), '--fictional-only']
            self.assertEqual(subprocess.run(command, capture_output=True, timeout=15).returncode, 1)
            self.assertEqual(hashlib.sha256(path.read_bytes()).digest(), before)


if __name__ == '__main__': unittest.main()
