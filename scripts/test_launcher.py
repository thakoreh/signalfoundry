#!/usr/bin/env python3
import os
import subprocess
import socket
import sys
import unittest
from unittest.mock import patch
from dev import port, stop, require_free_ports


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

    def test_busy_preview_and_equal_ports_are_rejected_before_any_child_is_started(self):
        with socket.socket() as owned:
            owned.bind(('127.0.0.1', 0)); owned.listen(1)
            number = owned.getsockname()[1]
            with patch('subprocess.Popen') as launch, self.assertRaisesRegex(ValueError, 'already occupied'):
                require_free_ports(number)
            launch.assert_not_called()
        with self.assertRaisesRegex(ValueError, 'different ports'):
            require_free_ports(3000, 3000)


if __name__ == '__main__':
    unittest.main()
