"""Fail closed unless the exact preview origin and a bcrypt password file exist."""
from pathlib import Path
import os
import re
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from app.config import preview_origin


def render(origin: str, password_file: Path, template: Path) -> str:
    origin = preview_origin(origin)
    if not origin:
        raise ValueError('Set SIGNALFOUNDRY_PREVIEW_ORIGIN before starting the protected preview')
    if not password_file.is_absolute() or not re.fullmatch(r'/[a-zA-Z0-9_./-]+', str(password_file)):
        raise ValueError('The preview password file must be an absolute safe path')
    if password_file.stat().st_size > 1024:
        raise ValueError('The preview password file must contain exactly one bcrypt account')
    content = password_file.read_text().strip()
    # Support htpasswd -B output, cost 10-14. No plaintext, weak hash, or default login.
    if not re.fullmatch(r'[a-zA-Z0-9_-]{1,64}:\$2[aby]\$(?:1[0-4])\$[./A-Za-z0-9]{53}', content):
        raise ValueError('The preview password file must contain one bcrypt account (cost 10-14)')
    return (template.read_text().replace('@@ORIGIN@@', origin)
            .replace('@@HOST@@', origin.removeprefix('https://'))
            .replace('@@PASSWORD_FILE@@', str(password_file)))


def main():
    template = Path(__file__).with_name('nginx.conf.template')
    password_file = Path('/run/secrets/preview.htpasswd')
    config = render(os.environ.get('SIGNALFOUNDRY_PREVIEW_ORIGIN', ''), password_file, template)
    target = Path('/tmp/signalfoundry-nginx.conf')
    target.write_text(config)
    target.chmod(0o600)


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError) as error:
        # Validation messages contain no credential values.
        print(f'Protected preview cannot start: {error}', file=sys.stderr)
        raise SystemExit(1)
