"""Portable source-only archive; never include local data, keys or build output."""
import os
from pathlib import Path
import sys
import zipfile

EXCLUDED = {'.git', '.next', 'node_modules', '.venv', '__pycache__', '.pytest_cache', '.ruff_cache',
            'artifacts', '.runtime', '.convex', 'secrets', 'test-results', 'playwright-report', 'coverage',
            '.local', 'private', 'exports', 'backups'}


def linked(path):
    # Includes Windows junctions on Python 3.11 as well as ordinary symlinks.
    return path.is_symlink() or bool(getattr(path.lstat(), 'st_file_attributes', 0) & 0x400)


def package_source(root, output):
    root, output = Path(root).resolve(), Path(output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        for directory, names, files in os.walk(root):
            parent = Path(directory)
            names[:] = sorted(name for name in names if name not in EXCLUDED
                              and not linked(parent / name)
                              and (parent / name).relative_to(root).parts[:2] != ('backend', 'data'))
            for name in sorted(files):
                path = parent / name
                if name in EXCLUDED or linked(path) or not path.resolve().is_relative_to(root) or path.resolve() == output:
                    continue
                if name.startswith('.env') and name != '.env.example':
                    continue
                if path.suffix in {'.db', '.sqlite', '.sqlite3', '.pyc', '.htpasswd', '.pem', '.key', '.csv'} or name == '.htpasswd' or any(
                        marker in name for marker in ('.db-', '.sqlite-', '.sqlite3-')) or name.endswith('.tsbuildinfo'):
                    continue
                archive.write(path, Path('signalfoundry-mvp') / path.relative_to(root))


if __name__ == '__main__':
    source = Path(__file__).resolve().parents[1]
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else source / 'artifacts/signalfoundry-mvp-source.zip'
    package_source(source, target)
    print(target)
