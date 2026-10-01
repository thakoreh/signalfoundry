#!/usr/bin/env python3
import os
import subprocess
import sys
import unittest
from unittest.mock import patch
from dev import port, stop


class LauncherTest(unittest.TestCase):
    def test_ports_are_bounded_and_browser_origins_stay_local(self):
        with patch.dict(os.environ, {'FRONTEND_PORT': '3001'}):
            self.assertEqual(port('FRONTEND_PORT', 3000), 3001)
        for value in ['4173', '0', '65536', 'nope']:
            with patch.dict(os.environ, {'FRONTEND_PORT': value}):
                with self.assertRaises(ValueError):
                    port('FRONTEND_PORT', 3000)

    def test_cleanup_stops_created_process(self):
        child = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'],
                                 start_new_session=(os.name == 'posix'))
        try:
            stop(child)
            self.assertIsNotNone(child.poll())
            stop(child)  # Cleanup is safe when already stopped.
        finally:
            if child.poll() is None:
                child.kill()
                child.wait()


if __name__ == '__main__':
    unittest.main()
