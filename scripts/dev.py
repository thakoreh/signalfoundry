#!/usr/bin/env python3
"""Private two-process development launcher, compatible with macOS and Linux."""
from __future__ import annotations
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]


def port(name: str, default: int) -> int:
    try:
        value = int(os.environ.get(name, str(default)))
    except ValueError as exc:
        raise ValueError(f'{name} must be a port number') from exc
    if not 1 <= value <= 65535:
        raise ValueError(f'{name} must be between 1 and 65535')
    if name == 'FRONTEND_PORT' and value not in (3000, 3001):
        raise ValueError('Use FRONTEND_PORT=3000 or 3001; other browser origins are deliberately blocked')
    return value


def stop(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return
    try:
        if os.name == 'posix':
            os.killpg(process.pid, signal.SIGTERM)
        else:
            process.terminate()
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        if os.name == 'posix':
            os.killpg(process.pid, signal.SIGKILL)
        else:
            process.kill()
        process.wait(timeout=5)
    except ProcessLookupError:
        pass


def main() -> int:
    node = shutil.which('node')
    next_bin = ROOT / 'frontend/node_modules/next/dist/bin/next'
    if not node or not next_bin.is_file():
        raise SystemExit('Run ./scripts/setup.sh first; Node.js and frontend dependencies are required')
    api_port, ui_port = port('BACKEND_PORT', 8000), port('FRONTEND_PORT', 3000)
    env = {**os.environ, 'API_BASE_URL': f'http://127.0.0.1:{api_port}', 'NEXT_TELEMETRY_DISABLED': '1'}
    processes: list[subprocess.Popen] = []

    def interrupted(_signum, _frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, interrupted)
    try:
        processes.append(subprocess.Popen([
            sys.executable, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', str(api_port),
        ], cwd=ROOT / 'backend', env=env, start_new_session=(os.name == 'posix')))
        processes.append(subprocess.Popen([
            node, str(next_bin), 'dev', '--hostname', '127.0.0.1', '--port', str(ui_port),
        ], cwd=ROOT / 'frontend', env=env, start_new_session=(os.name == 'posix')))
        print(f'\nSignalFoundry: http://localhost:{ui_port}\nLocal demo only. Keep both services private.\n', flush=True)
        while all(p.poll() is None for p in processes):
            time.sleep(0.2)
        return next((p.returncode for p in processes if p.returncode is not None), 1)
    except KeyboardInterrupt:
        return 0
    finally:
        for process in reversed(processes):
            stop(process)


if __name__ == '__main__':
    raise SystemExit(main())
