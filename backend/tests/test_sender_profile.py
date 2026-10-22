"""Sender profile compatibility, using fresh fictional data only."""
import tempfile
from pathlib import Path
import unittest
from app.fixtures import DEMO_PROFILE
from app.models import Profile
from app.store import Repository


class SenderProfileTest(unittest.TestCase):
    def test_old_profile_opens_and_legacy_save_preserves_saved_sender(self):
        with tempfile.TemporaryDirectory() as directory:
            repo = Repository(Path(directory) / 'fixture.sqlite3')
            old = Profile.model_validate(DEMO_PROFILE.model_dump())
            repo.save_profile(old)
            self.assertEqual(repo.workspace().profile.sender_name, '')
            sender = Profile.model_validate({**old.model_dump(), 'sender_name': 'Alex Fixture',
                'mailing_address': '100 Example Street, Toronto ON M5V 1A1',
                'sender_contact': 'alex@example.com'})
            repo.save_profile(sender)
            legacy = Profile.model_validate({key: value for key, value in old.model_dump().items()
                                            if key not in ('sender_name', 'mailing_address', 'sender_contact')})
            repo.save_profile(legacy)
            saved = Repository(repo.db_path).workspace().profile
            self.assertEqual(saved.sender_name, sender.sender_name)
            self.assertEqual(saved.mailing_address, sender.mailing_address)
            self.assertEqual(saved.sender_contact, sender.sender_contact)
            self.assertEqual(saved.description, old.description)
