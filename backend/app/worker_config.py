"""Fail-closed server-only worker configuration. No credential defaults."""
from dataclasses import dataclass, field
import os
import ipaddress
import re
from urllib.parse import urlsplit

from .safety import DNS_CAPACITY, FetchError, normalize_url


def worker_origin(value: str, allow_private_http: bool = False) -> str:
    """HTTPS between hosts; HTTP only explicit same-network service aliases.

    This validates configuration syntax, not deployment topology. The HTTP escape
    hatch MUST NOT be enabled for managed/cloud Convex: it cannot access a local
    container network. Its only purpose is same-host self-hosted development.
    """
    if not value or value != value.strip() or len(value) > 2048:
        raise ValueError('SIGNALFOUNDRY_WORKER_URL must be an exact worker origin')
    try:
        parsed = urlsplit(value)
        if (parsed.username is not None or parsed.password is not None or parsed.query or
                parsed.fragment or parsed.path not in ('', '/') or not parsed.hostname):
            raise ValueError('Worker origin must not contain credentials, paths, queries, or fragments')
        if parsed.scheme == 'http' and allow_private_http:
            if parsed.hostname not in ('research-worker', 'worker', 'localhost', '127.0.0.1') or parsed.port != 8001:
                raise ValueError('Private HTTP is limited to same-network worker service aliases on port 8001')
            return f'http://{parsed.hostname}:8001'
        if parsed.scheme != 'https':
            raise ValueError('Worker communication between hosts requires HTTPS')
        normalized = normalize_url(value)
        if normalized != value.rstrip('/') + '/':
            raise ValueError('Use one lowercase HTTPS worker origin without an explicit port')
        return normalized.rstrip('/')
    except FetchError as exc:
        raise ValueError('Worker URL must use a public HTTPS hostname') from exc


@dataclass(frozen=True)
class WorkerSettings:
    token: str = field(repr=False)
    origin: str
    engine: str = 'rules'
    max_jobs: int = 2
    parallel_domains: int = 4

    def __post_init__(self):
        # Environment does not expose these limits. Keep programmatic settings
        # aligned too: admitted domain lanes must fit the bounded DNS executor.
        if (type(self.max_jobs) is not int or type(self.parallel_domains) is not int or
                self.max_jobs < 1 or self.parallel_domains < 1 or
                self.max_jobs * self.parallel_domains > DNS_CAPACITY):
            raise ValueError('Worker concurrency must fit the bounded DNS capacity')

    @property
    def ready(self) -> bool:
        return bool(self.token and self.origin)

    @classmethod
    def from_environment(cls):
        token = os.environ.get('SIGNALFOUNDRY_WORKER_TOKEN', '')
        # Empty configuration keeps liveness available, but readiness and all
        # work fail closed. A placeholder cannot accidentally enable requests.
        if token and (not re.fullmatch(r'[A-Za-z0-9_-]{32,256}', token) or
                      token.lower().startswith(('replace', 'placeholder', 'your_', 'changeme'))):
            raise ValueError('SIGNALFOUNDRY_WORKER_TOKEN requires an operator-provided URL-safe secret of at least 32 characters')
        private = os.environ.get('SIGNALFOUNDRY_WORKER_ALLOW_PRIVATE_HTTP', 'false')
        if private not in ('true', 'false'):
            raise ValueError('SIGNALFOUNDRY_WORKER_ALLOW_PRIVATE_HTTP must be true or false')
        # Uvicorn reads this setting. Broad proxy trust would let public clients
        # spoof HTTPS; only explicit IP addresses or narrow networks are allowed.
        trusted = os.environ.get('FORWARDED_ALLOW_IPS', '')
        for entry in trusted.split(',') if trusted else []:
            try:
                network = ipaddress.ip_network(entry.strip(), strict=False)
                if network.prefixlen < (24 if network.version == 4 else 64):
                    raise ValueError()
            except ValueError as exc:
                raise ValueError('FORWARDED_ALLOW_IPS requires exact proxy IPs or narrow trusted networks, never wildcard') from exc
        raw_origin = os.environ.get('SIGNALFOUNDRY_WORKER_URL', '')
        origin = worker_origin(raw_origin, private == 'true') if raw_origin else ''
        engine = os.environ.get('DECISION_ENGINE', 'rules')
        if engine not in ('rules', 'jev'):
            raise ValueError('DECISION_ENGINE must be rules or explicit jev opt-in')
        return cls(token=token, origin=origin, engine=engine)
