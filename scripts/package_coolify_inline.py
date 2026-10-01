#!/usr/bin/env python3
"""Generate a private, source-embedded Coolify Dockerfile without a Git repository.

This is an alternative transport for the source, not an additional deployment.
The allowlist deliberately excludes all databases, credentials, and run output.
"""
import base64
import gzip
import hashlib
import io
from pathlib import Path
import tarfile
import textwrap

ROOT = Path(__file__).resolve().parents[1]


def source_paths(root=ROOT):
    paths = []
    for relative in ('backend/app', 'frontend/app', 'frontend/components', 'frontend/lib'):
        for path in (root / relative).rglob('*'):
            if path.suffix in ('.py', '.tsx', '.ts', '.css') and path.is_file() and not path.is_symlink():
                paths.append(path)
    for relative in ('backend/requirements.lock.txt', 'frontend/package.json',
                     'frontend/package-lock.json', 'frontend/next.config.ts',
                     'frontend/next-env.d.ts', 'frontend/tsconfig.json', 'frontend/proxy.ts',
                     'deploy/start.sh', 'deploy/render_config.py', 'deploy/healthcheck.py',
                     'deploy/nginx.conf.template'):
        paths.append(root / relative)
    return sorted(paths)


def generate(root=ROOT):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode='w', format=tarfile.PAX_FORMAT) as archive:
        for path in source_paths(root):
            data = path.read_bytes()
            info = tarfile.TarInfo(path.relative_to(root).as_posix())
            info.size, info.mode = len(data), 0o644
            archive.addfile(info, io.BytesIO(data))
    encoded = base64.b64encode(gzip.compress(output.getvalue(), mtime=0)).decode()
    heredoc = "COPY <<'SIGNALFOUNDRY_PRIVATE_SOURCE' /tmp/signalfoundry-source.tar.gz.b64\n" + '\n'.join(textwrap.wrap(encoded, 120)) + "\nSIGNALFOUNDRY_PRIVATE_SOURCE\nRUN base64 -d /tmp/signalfoundry-source.tar.gz.b64 | tar -xz -C /build && rm /tmp/signalfoundry-source.tar.gz.b64\n"
    dockerfile = (root / 'Dockerfile').read_text()
    dockerfile = '# syntax=docker/dockerfile:1\n# Private source snapshot. Store only in the authorized Coolify project.\n' + dockerfile
    dockerfile = dockerfile.replace('COPY frontend/package.json frontend/package-lock.json ./\n', heredoc)
    dockerfile = dockerfile.replace('COPY frontend/ ./\n', '')
    dockerfile = dockerfile.replace('COPY backend/requirements.lock.txt ', 'COPY --from=frontend-build /build/backend/requirements.lock.txt ')
    dockerfile = dockerfile.replace('COPY backend/app/ ', 'COPY --from=frontend-build /build/backend/app/ ')
    dockerfile = dockerfile.replace('COPY deploy/ ', 'COPY --from=frontend-build /build/deploy/ ')
    return dockerfile


if __name__ == '__main__':
    target = ROOT / 'artifacts/signalfoundry-coolify-inline.Dockerfile'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(generate())
    print(f'{target}\nSHA256 {hashlib.sha256(target.read_bytes()).hexdigest()}\n{target.stat().st_size} bytes; no runtime data or passwords')
