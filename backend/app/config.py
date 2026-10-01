"""Exact-origin configuration for the optional, gateway-protected preview."""
import os
import re
from urllib.parse import urlsplit


def preview_origin(value: str | None = None) -> str | None:
    value = os.environ.get('SIGNALFOUNDRY_PREVIEW_ORIGIN', '') if value is None else value
    if not value:
        return None
    # Deliberately no wildcards, path, credentials, IP literal, port, or trailing slash.
    if not re.fullmatch(r'https://[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?', value):
        raise ValueError('SIGNALFOUNDRY_PREVIEW_ORIGIN must be one exact lowercase HTTPS origin')
    host = urlsplit(value).hostname
    labels = host.split('.')
    if (len(host) > 253 or len(labels) < 2 or labels[-1].isdigit() or
            any(not label or len(label) > 63 or label.startswith('-') or label.endswith('-') for label in labels) or
            labels[-1] in ('localhost', 'local', 'internal', 'test', 'invalid', 'onion', 'home', 'lan')):
        raise ValueError('SIGNALFOUNDRY_PREVIEW_ORIGIN must use a valid public DNS hostname')
    return value
