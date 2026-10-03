"""Bounded Exa/PDL adapters. Fixed endpoints, no retries, redirects, or cache.

Official contracts checked 2026-10-02; see DISCOVERY.md. All tests use only
httpx.MockTransport. Neither imports nor readiness probes contact providers.
"""
from __future__ import annotations
from dataclasses import dataclass
import http.client
import json
import re
import time
from typing import Literal, Protocol
from urllib.parse import urlsplit

import httpx

from .discovery_config import DiscoverySettings, ProviderPolicy, timestamp, utcnow
from .models import Contact, Profile
from .safety import FetchError, PinnedHTTPSConnection, normalize_url, resolve_public

EXA_URL = 'https://api.exa.ai/search'
PDL_URL = 'https://api.peopledatalabs.com/v5/person/search'
MAX_PROVIDER_BYTES = 512_000
PROVIDER_TIMEOUT = 10.0
# Current fast/auto pricing is $0.007 for <=10, then $0.001/additional result.
# The configured Exa per-call reservation must cover the maximum 30-result call.
EXA_MINIMUM_RESERVATION = 27_000
DIRECTORIES = frozenset(('linkedin.com', 'crunchbase.com', 'zoominfo.com', 'pitchbook.com',
    'bloomberg.com', 'wikipedia.org', 'facebook.com', 'instagram.com', 'x.com',
    'twitter.com', 'youtube.com', 'tiktok.com', 'wellfound.com'))


class ProviderUnavailable(ValueError):
    """Only static redacted messages escape provider boundaries."""


class ProviderFailure(ValueError):
    pass


def canonical_domain(raw: str) -> str:
    host = urlsplit(normalize_url(raw)).hostname
    return host[4:] if host.startswith('www.') else host


def safe_text(value, limit: int = 240) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    if not value or len(value) > limit or any(ord(c) < 32 for c in value):
        return None
    return value


def safe_source(value) -> str | None:
    if not isinstance(value, str):
        return None
    try:
        url = normalize_url(value)
        # Source links must not contain provider credentials or other query data.
        parsed = urlsplit(url)
        return f'{parsed.scheme}://{parsed.hostname}{parsed.path}'
    except FetchError:
        return None


def usable_email(value) -> str | None:
    value = safe_text(value, 254)
    if not value or not re.fullmatch(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}", value):
        return None
    try:
        canonical_domain(value.rsplit('@', 1)[1])
    except FetchError:
        return None
    return value


class ProviderHTTP:
    def __init__(self, *, transport=None):
        if transport is not None and not isinstance(transport, httpx.MockTransport):
            raise ValueError('Only offline MockTransport can replace the bounded live transport')
        self.transport = transport

    def post(self, url: str, key: str, payload: dict) -> dict:
        if url not in (EXA_URL, PDL_URL):
            raise ProviderUnavailable('Unsupported provider endpoint')
        headers = {'X-Api-Key': key, 'Content-Type': 'application/json', 'Accept': 'application/json',
                   'Accept-Encoding': 'identity', 'Connection': 'close'}
        body = json.dumps(payload, ensure_ascii=True, allow_nan=False).encode()
        if len(body) > 32_000:
            raise ProviderUnavailable('Provider request exceeds its safe limit')
        try:
            if self.transport is not None:
                with httpx.Client(transport=self.transport, follow_redirects=False, trust_env=False) as client:
                    response = client.post(url, headers=headers, content=body)
                    if response.status_code != 200 or response.headers.get('content-encoding', 'identity').lower() not in ('', 'identity'):
                        raise ProviderFailure('Provider request failed; no automatic retry was made')
                    if len(response.content) > MAX_PROVIDER_BYTES:
                        raise ProviderFailure('Provider response exceeded its safe limit')
                    raw = response.content
            else:
                parsed = urlsplit(url)
                deadline = time.monotonic() + PROVIDER_TIMEOUT
                ip = resolve_public(parsed.hostname, 443, min(2.0, PROVIDER_TIMEOUT))[0]
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError()
                connection = PinnedHTTPSConnection(parsed.hostname, ip, 443, remaining)
                response = None
                try:
                    connection.request('POST', parsed.path, body=body, headers=headers)
                    response = connection.getresponse()
                    if response.status != 200 or response.getheader('Content-Encoding', 'identity').lower() not in ('', 'identity'):
                        raise ProviderFailure('Provider request failed; no automatic retry was made')
                    chunks, size = [], 0
                    while True:
                        if time.monotonic() >= deadline:
                            raise TimeoutError()
                        chunk = response.read1(min(16384, MAX_PROVIDER_BYTES + 1 - size))
                        if not chunk:
                            break
                        size += len(chunk)
                        if size > MAX_PROVIDER_BYTES:
                            raise ProviderFailure('Provider response exceeded its safe limit')
                        chunks.append(chunk)
                    raw = b''.join(chunks)
                finally:
                    if response is not None:
                        response.close()
                    connection.close()
            parsed = json.loads(raw)
            if not isinstance(parsed, dict):
                raise ValueError()
            return parsed
        except (ValueError, TypeError, OSError, http.client.HTTPException, httpx.HTTPError) as exc:
            # Never expose response bodies, keys, request details, or raw errors.
            if isinstance(exc, ProviderFailure):
                raise
            raise ProviderFailure('Provider response was unavailable or invalid; no automatic retry was made') from None


class CommercialProvider:
    def __init__(self, settings: DiscoverySettings, policy: ProviderPolicy, *, transport=None):
        self.settings, self.policy = settings, policy
        self.http = ProviderHTTP(transport=transport)

    def require(self, cost: int, allowance: int):
        if not self.settings.approved or not self.policy.configured or not self.policy.licensed:
            raise ProviderUnavailable('Provider requires approved server credentials, licenses, retention, and budgets')
        if cost <= 0 or cost > allowance or allowance > self.settings.job_budget:
            raise ProviderUnavailable('The remaining approved budget cannot cover this provider request')


@dataclass(frozen=True)
class CompanyCandidate:
    domain: str
    source_url: str


class ExaDiscoveryProvider(CommercialProvider):
    def __init__(self, settings: DiscoverySettings, *, transport=None):
        super().__init__(settings, settings.exa, transport=transport)

    def search(self, profile: Profile, target_count: int, offering_website: str | None, allowance: int) -> list[CompanyCandidate]:
        cost = self.policy.unit_cost_microusd
        self.require(cost, allowance)
        if cost < EXA_MINIMUM_RESERVATION or not 1 <= target_count <= 30:
            raise ProviderUnavailable('Exa requires a reviewed cost cap covering at most 30 search results')
        own_domain = canonical_domain(offering_website) if offering_website else None
        # Do not transmit the user's company description/name. Target criteria only.
        parts = ['Find official business websites of companies matching these target criteria.']
        for label, values in (('Industries', profile.industries), ('Company sizes', profile.company_sizes),
                ('Regions', profile.geographies), ('Keywords', profile.keywords), ('Exclude', profile.exclusions)):
            if values:
                parts.append(f'{label}: {", ".join(values)}')
        payload = {'query': '\n'.join(parts), 'type': 'auto', 'category': 'company',
                   'numResults': target_count, 'moderation': True}
        # company category does not support excludeDomains; filter locally instead.
        data = self.http.post(EXA_URL, self.policy.api_key, payload)
        results = data.get('results')
        if not isinstance(results, list) or len(results) > target_count:
            raise ProviderFailure('Company provider returned an invalid result count')
        candidates, seen = [], set()
        for result in results:
            if not isinstance(result, dict):
                continue
            source = safe_source(result.get('url'))
            if source is None:
                continue
            domain = canonical_domain(source)
            if (domain == own_domain or domain in seen or
                    any(domain == blocked or domain.endswith('.' + blocked) for blocked in DIRECTORIES)):
                continue
            seen.add(domain)
            candidates.append(CompanyCandidate(domain=domain, source_url=source))
        return candidates


class PDLContactProvider(CommercialProvider):
    def __init__(self, settings: DiscoverySettings, *, transport=None):
        super().__init__(settings, settings.pdl, transport=transport)

    def search(self, profile: Profile, domain: str, limit: int, allowance: int) -> list[Contact]:
        self.require(self.policy.unit_cost_microusd * limit, allowance)
        if not 1 <= limit <= 3 or not profile.buyer_roles:
            raise ProviderUnavailable('Choose at least one buyer role before contact discovery')
        domain = canonical_domain(domain)
        payload = {'query': {'query': {'bool': {'filter': [
            {'term': {'job_company_website': domain}},
            {'bool': {'should': [{'match_phrase': {'job_title.text': role.lower()}} for role in profile.buyer_roles],
                      'minimum_should_match': 1}}]}}}, 'size': limit, 'dataset': 'resume', 'pretty': False}
        data = self.http.post(PDL_URL, self.policy.api_key, payload)
        rows = data.get('data')
        if data.get('status') != 200 or not isinstance(rows, list) or len(rows) > limit:
            raise ProviderFailure('Contact provider returned an invalid response')
        contacts, seen = [], set()
        retrieved = timestamp(utcnow())
        for row in rows:
            if not isinstance(row, dict):
                continue
            name, role = safe_text(row.get('full_name')), safe_text(row.get('job_title'))
            if not name or not role:
                continue
            try:
                if canonical_domain(row.get('job_company_website')) != domain:
                    continue
            except FetchError:
                continue
            email = usable_email(row.get('work_email'))
            key = (name.casefold(), role.casefold(), email.casefold() if email else '')
            if key in seen:
                continue
            seen.add(key)
            contacts.append(Contact(name=name, role=role, email=email,
                verification_status='unverified' if email else 'not_available',
                source_url=safe_source(row.get('linkedin_url')), provider='peopledatalabs',
                retrieved_at=retrieved, employment_verified_at=None, email_checked_at=None,
                email_status='not_checked', email_verification_provider=None,
                note='Provider-reported person and employer; current employment, buying authority, and email deliverability are unverified.',
                license_reference=self.policy.license_reference, license_expires_at=self.policy.expires_at(),
                license_restrictions=self.policy.restrictions()))
        return contacts


@dataclass(frozen=True)
class EmailCheck:
    status: Literal['valid', 'invalid', 'catch_all', 'unknown']
    checked_at: str
    provider: str


class EmailVerificationProvider(Protocol):
    """A future reviewed adapter must separately verify deliverability, never employment.

    Only explicit 'valid' may produce verification_status='verified'; catch-all
    and unknown must remain unverified. This protocol grants no live access.
    """
    def check(self, email: str, max_cost_microusd: int) -> EmailCheck: ...


class UnconfiguredEmailVerifier:
    def check(self, email: str, max_cost_microusd: int) -> EmailCheck:
        raise ProviderUnavailable('Independent email verification is not configured')
