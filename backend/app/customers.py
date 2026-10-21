"""Bounded real-provider discovery. No generated contacts, sending, or retries."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
import os
import json
import logging
import re
import time
from typing import Annotated, Literal
from urllib.parse import urlsplit

import httpx
from pydantic import Field, StringConstraints

from .models import Account, Contact, Evidence, Profile, ScoreComponent, StrictModel
from .primitives import new_id
from .research import RulesDecisionProvider, excerpt_for
from .safety import FetchError, fetch_public_page, normalize_url

MAX_PUBLIC_ATTEMPTS = 10
PUBLIC_WORKERS = 3
SEARCH_DEADLINE_SECONDS = 90


class _ProviderLogFilter(logging.Filter):
    def filter(self, record):
        # httpx INFO includes the full request URL. Hunter authenticates using a
        # query parameter, so never emit its provider request records, even when
        # an operator enables HTTP debug logging globally.
        return 'api.hunter.io' not in record.getMessage()


logging.getLogger('httpx').addFilter(_ProviderLogFilter())


class CustomerSearchRequest(StrictModel):
    target: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=200)]
    geography: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)] = ''
    limit: int = Field(default=5, ge=1, le=5)
    idempotency_key: Annotated[str, StringConstraints(pattern=r'^[A-Za-z0-9_-]{8,128}$')]


class DiscoveryRequest(StrictModel):
    profile: Profile
    website: str | None
    search_id: Annotated[str, StringConstraints(pattern=r'^[A-Za-z0-9_-]{1,128}$')]
    target: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=200)]
    geography: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)] = ''
    limit: int = Field(default=5, ge=1, le=5)


class DiscoveryResult(StrictModel):
    accounts: list[Account] = Field(max_length=5)
    errors: list[str] = Field(max_length=20)
    query: str


class CustomerSearch(StrictModel):
    id: str
    status: Literal['queued', 'running', 'complete', 'partial', 'failed']
    stage: str
    query: str
    accounts: list[Account] = Field(default_factory=list, max_length=5)
    errors: list[str] = Field(default_factory=list, max_length=20)
    created_at: str
    updated_at: str


class ProviderError(Exception):
    """Contains only fixed, safe text. Never retain HTTP exceptions or raw bodies."""


def _enabled(provider: str) -> bool:
    return os.environ.get(f'CLIENTROVE_{provider}_ENABLED') == 'true' and bool(os.environ.get(f'{provider}_API_KEY', '').strip())


def engine_status() -> dict:
    from .customer_drafts import draft_status
    provider = os.environ.get('CLIENTROVE_SEARCH_PROVIDER', 'deepseek')
    configured = provider in ('deepseek', 'brave') and _enabled('DEEPSEEK' if provider == 'deepseek' else 'BRAVE_SEARCH')
    return {
        'discovery': {'provider': provider if provider in ('deepseek', 'brave') else 'unconfigured', 'status': 'ready' if configured else 'unconfigured',
                      'detail': 'Configured for bounded web search; provider health is checked when searching.' if configured else 'Customer discovery has not been connected yet.'},
        'contacts': {'provider': 'hunter', 'status': 'ready' if _enabled('HUNTER') else 'unconfigured',
                     'detail': 'Configured for contact lookup and email verification.' if _enabled('HUNTER') else 'Contact verification is not connected. Publicly listed business emails, when present, remain unverified.'},
        'max_results': 5,
        'drafts': draft_status(),
    }


def provider_json(provider: str, endpoint: str, params: dict, *, cost=None, transport=None) -> dict:
    from .cost_admission import paid_call, CostDenied
    if transport is not None and not isinstance(transport, httpx.MockTransport):
        raise ProviderError('Only an offline mock transport may be injected.')
    operation = provider + ':' + endpoint
    if operation not in ('deepseek:search', 'brave:search', 'hunter:domain-search', 'hunter:email-verifier'):
        raise ProviderError('Unsupported provider operation.')
    if provider == 'hunter' and cost:
        cost = cost.child(params.get('domain') or params.get('email'))
    try:
        return paid_call(cost, operation, params, lambda: _provider_json_transport(provider, endpoint, params, transport=transport))
    except CostDenied as error:
        raise ProviderError(str(error)) from None


def _provider_json_transport(provider: str, endpoint: str, params: dict, *, transport=None) -> dict:
    """Only fixed provider endpoints; no env proxies, redirects, or response-body errors."""
    method, request_options = 'GET', {'params': params}
    if provider == 'deepseek' and endpoint == 'search':
        url = 'https://api.deepseek.com/v1/tools/search'
        query, count = params.get('query'), params.get('count')
        if not isinstance(query, str) or not query.strip() or len(query) > 128 or type(count) is not int or not 1 <= count <= 20 or params.get('need_content') is not False:
            raise ProviderError('The planned customer search is invalid.')
        headers = {'Authorization': 'Bearer ' + os.environ['DEEPSEEK_API_KEY'], 'Content-Type': 'application/json'}
        method, request_options = 'POST', {'json': params}
    elif provider == 'brave' and endpoint == 'search':
        url = 'https://api.search.brave.com/res/v1/web/search'
        headers = {'X-Subscription-Token': os.environ['BRAVE_SEARCH_API_KEY']}
    elif provider == 'hunter' and endpoint in ('domain-search', 'email-verifier'):
        url = f'https://api.hunter.io/v2/{endpoint}'
        params = {**params, 'api_key': os.environ['HUNTER_API_KEY']}
        request_options = {'params': params}
        headers = {}
    else:
        raise ProviderError('Unsupported provider operation.')
    try:
        deadline = time.monotonic() + 8
        with httpx.Client(timeout=6, follow_redirects=False, trust_env=False, transport=transport) as client:
            with client.stream(method, url, **request_options, headers={**headers, 'Accept': 'application/json'}) as response:
                if response.status_code != 200:
                    raise ProviderError(f'{provider.title()} could not complete this request. Check its configuration or allowance.')
                raw = bytearray()
                for chunk in response.iter_bytes():
                    if time.monotonic() > deadline:
                        raise ProviderError(f'{provider.title()} request timed out.')
                    raw.extend(chunk)
                    if len(raw) > 1_048_576:
                        raise ProviderError(f'{provider.title()} returned too much data.')
                result = json.loads(raw)
                if not isinstance(result, dict):
                    raise ValueError()
                return result
    except ProviderError:
        raise
    except Exception:
        raise ProviderError(f'{provider.title()} could not be reached or returned an unreadable response.') from None


_DIRECTORIES = ('linkedin.com', 'facebook.com', 'instagram.com', 'youtube.com', 'twitter.com', 'x.com',
                'google.com', 'bing.com', 'reddit.com', 'wikipedia.org', 'yelp.com', 'g2.com',
                'capterra.com', 'clutch.co', 'crunchbase.com', 'apollo.io', 'hunter.io', 'indeed.com')


def business_url(raw: str, own: str | None = None) -> str | None:
    try:
        url = normalize_url(raw)
        host = urlsplit(url).hostname.removeprefix('www.')
        own_host = urlsplit(normalize_url(own)).hostname.removeprefix('www.') if own else None
        if (own_host and (host == own_host or host.endswith('.' + own_host))) or any(host == value or host.endswith('.' + value) for value in _DIRECTORIES):
            return None
        # Search pages, PDFs, articles, and directories are not company identities.
        path = urlsplit(url).path.lower()
        if any(part in path for part in ('/blog/', '/news/', '/article/', '/directory/', '/search', '.pdf')):
            return None
        return f'https://{host}/'
    except (FetchError, ValueError, AttributeError):
        return None


def _public_source(raw) -> str | None:
    try:
        return normalize_url(raw) if isinstance(raw, str) else None
    except FetchError:
        return None


def _clip_words(value: str, size: int) -> str:
    if len(value) <= size:
        return value
    clipped = value[:size]
    return clipped.rsplit(' ', 1)[0] if ' ' in clipped and value[size:size + 1] != ' ' else clipped


def plan_query(target: str, geography: str, provider: str) -> str:
    target = re.sub(r'["\r\n\t]+', ' ', target).strip()
    geography = re.sub(r'["\r\n\t]+', ' ', geography).strip()
    parts = [target, geography, 'official website']
    query = ' '.join(part for part in parts if part)
    if provider != 'deepseek' or len(query) <= 128:
        return query
    place = _clip_words(geography, 64)
    budget = 128 - len(place) - len(' official website') - (1 if place else 0)
    return ' '.join(part for part in (_clip_words(target, budget), place, 'official website') if part)


def source_business_name(page) -> str:
    """Prefer a source's brand segment/copyright over its marketing headline."""
    host = urlsplit(page.url).hostname.removeprefix('www.')
    domain_word = host.split('.')[0].replace('-', '').lower()
    choices = [part.strip() for part in re.split(r'\s*[|–—]\s*', page.title) if part.strip()]
    copyright_name = re.search(r'(?:©|Copyright)\s*(?:\d{4}\s*)?(.{2,100}?)(?=\s+[Aa]ll [Rr]ights [Rr]eserved|\.|$)', page.text)
    if copyright_name:
        choices.append(re.sub(r'\s+\d{4}$', '', copyright_name.group(1)).strip())
    def score(name):
        words = re.findall(r'[a-z0-9]+', name.lower())
        return sum(len(word) for word in words if len(word) >= 3 and word in domain_word)
    best = max(choices, key=score, default=host)
    if score(best) > 0 and len(best) <= 100:
        return best
    if len(choices) > 1 and len(choices[-1]) <= 80:
        return choices[-1]
    return host


def _words(value: str) -> list[str]:
    def stem(word):
        if word.startswith('manag'):
            return 'manage'
        if word.endswith('ies'):
            return word[:-3] + 'y'
        if word.endswith('s') and not word.endswith(('ss', 'saas')):
            return word[:-1]
        return word
    return [stem(word) for word in re.findall(r'[a-z0-9]+', value.lower())]


def qualify_customer(profile: Profile, page, *, target: str, geography: str, search_id: str) -> Account:
    """Match explicit buyer categories and service-area text, not sender keywords or news."""
    account = RulesDecisionProvider().evaluate(profile, page, campaign_id=search_id)
    if any(part.label == 'Exclusion penalty' for part in account.score_breakdown):
        return account
    account.name = source_business_name(page)
    account.domain = account.domain.removeprefix('www.')
    identity_words = set(_words(page.title + ' ' + page.description))
    page_words = set(_words(page.text))
    noise = {'company', 'firm', 'business', 'provider', 'service', 'and', 'or'}
    categories = [value.strip() for value in re.split(r',|\bor\b', target) if value.strip()]
    matched, body_matched = [], []
    for category in categories:
        words = [word for word in _words(category) if word not in noise]
        if words and all(word in identity_words for word in words):
            matched.append(category)
        elif words and all(word in page_words for word in words):
            body_matched.append(category)
    category_points = 60 if matched else 30 if body_matched else 0
    category_reason = ('Homepage title or description matches your customer type: ' + ', '.join(matched)) if matched else (
        'Website text mentions your customer type; company identity needs review: ' + ', '.join(body_matched) if body_matched else
        'Available website text does not establish your requested customer type')
    ignored_places = {'on', 'ontario', 'canada', 'us', 'usa', 'united', 'state', 'uk', 'kingdom', 'province', 'region', 'area', 'and', 'or'}
    places = [word for word in _words(geography) if word not in ignored_places and len(word) > 2]
    if geography and not places:
        places = [word for word in _words(geography) if len(word) > 2]
    identity_places = [place for place in places if place in identity_words]
    body_places = [place for place in places if place in page_words]
    geography_points = (40 if places and len(identity_places) == len(places) else
                        25 if places and len(body_places) == len(places) else 10 if body_places else 0)
    geography_reason = ('Homepage service-area wording mentions: ' + ', '.join(body_places)) if body_places else (
        'The requested location is not established by the available website text' if geography else 'No location preference supplied')
    account.score_breakdown = [ScoreComponent(label='Customer-type language', points=category_points, max_points=60, reason=category_reason),
                               ScoreComponent(label='Service-area language', points=geography_points, max_points=40, reason=geography_reason)]
    account.score = category_points + geography_points
    # Text evidence of category/location is still not evidence of buying intent.
    account.confidence = 'medium' if matched and geography_points >= 25 else 'low'
    account.why_fit = [category_reason, geography_reason]
    account.why_now = ['Current buying intent has not been established.']
    account.evidence = [item for item in account.evidence if item.kind == 'company']
    for label, term in [('Customer-type wording', matched[0] if matched else body_matched[0] if body_matched else None),
                        ('Service-area wording', body_places[0] if body_places else None)]:
        if term:
            # Locate real source words; plural/company suffixes need not appear verbatim.
            source_term = next((word for word in re.findall(r'[A-Za-z]+', term) if word.lower() not in noise), term)
            account.evidence.append(Evidence(id=new_id('ev'), title=label, url=page.url, excerpt=excerpt_for(source_term, page.text),
                                             kind='fit', published_at=None, retrieved_at=account.researched_at, is_demo=False))
    account.industry = ', '.join(matched) if matched else 'Unknown'
    account.location = 'Website service-area mentions: ' + ', '.join(body_places) if body_places else 'Unknown'
    account.unknowns = [
        'Budget, current buying intent, and decision authority are unknown',
        'Website statements are source claims, not independently verified company records',
        'Service-area mentions do not establish an office address or current project location',
        'Company size and employee count remain unknown',
        'Match score measures website wording only; it is not a probability of becoming a customer',
    ]
    if not category_points:
        account.unknowns.append('The requested customer type is not established by the available page')
    if geography and geography_points < 25:
        account.unknowns.append('The full requested location is not established by the available page')
    return account


def published_contacts(page, timestamp: str) -> list[Contact]:
    """Only literal, visible same-domain email addresses; never infer people or patterns."""
    domain = urlsplit(page.url).hostname.removeprefix('www.').lower()
    found = re.findall(r'(?<![\w.+-])[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?![\w-])', page.text)
    addresses = list(dict.fromkeys(email for email in found if email.rsplit('@', 1)[1].lower() == domain))[:3]
    return [Contact(name=None, role='Published business email', email=email, verification_status='unverified', source_url=page.url,
                    note=f'Published on the company website, retrieved {timestamp}. Deliverability and recipient identity have not been verified; this may be a general inbox.')
            for email in addresses]


def customer_is_qualified(account: Account) -> bool:
    """Require sourced company-identity wording, before contact lookup or drafting.

    Geography and an incidental customer-type mention cannot compensate for
    missing identity evidence. This is a conservative wording gate, not a
    semantic assessment of need or buying intent.
    """
    return (
        not account.is_demo
        and not any(part.label == 'Exclusion penalty' for part in account.score_breakdown)
        and any(part.label == 'Customer-type language' and part.points >= 60 for part in account.score_breakdown)
        and any(not item.is_demo and item.kind in ('company', 'fit') and _public_source(item.url) for item in account.evidence)
    )


@dataclass(frozen=True)
class ContactLookup:
    contact: Contact | None = None
    rejected_email: str | None = None


def enrich_contact(domain: str, timestamp: str, *, cost=None) -> ContactLookup:
    result = provider_json('hunter', 'domain-search', {'domain': domain, 'limit': 1}, cost=cost)
    data = result.get('data', {})
    if not isinstance(data, dict) or data.get('webmail') or data.get('disposable'):
        return ContactLookup()
    rows = data.get('emails', [])
    if not isinstance(rows, list) or not rows or not isinstance(rows[0], dict):
        return ContactLookup()
    row = rows[0]
    email = row.get('value')
    if not isinstance(email, str) or not re.fullmatch(r'[^\s@,;<>]{1,64}@[A-Za-z0-9.-]{1,253}', email) or email.rsplit('@', 1)[1].lower() != domain.lower():
        return ContactLookup()
    verification = provider_json('hunter', 'email-verifier', {'email': email}, cost=cost).get('data', {})
    if not isinstance(verification, dict):
        raise ProviderError('Hunter returned an unreadable verification response.')
    # A high confidence score or catch-all domain does not establish verification.
    status = verification.get('status', 'unknown')
    if status == 'invalid' or verification.get('result') == 'undeliverable' or verification.get('disposable') is True:
        return ContactLookup(rejected_email=email)
    verified = (status == 'valid' and verification.get('email') == email and verification.get('result') in ('deliverable', None)
                and verification.get('accept_all') is False and verification.get('disposable') is False
                and verification.get('webmail') is False and not data.get('accept_all'))
    source = next((url for item in row.get('sources', [])[:20] if isinstance(item, dict)
                   and (url := _public_source(item.get('uri')))), None)
    name = ' '.join(str(row.get(key) or '') for key in ('first_name', 'last_name')).strip()[:240] or None
    role = str(row.get('position') or 'Role not provided by source')[:240]
    return ContactLookup(contact=Contact(name=name, role=role, email=email, verification_status='verified' if verified else 'unverified',
                   source_url=source, note=f'Hunter lookup and verifier checked {timestamp}. Provider status: {str(status)[:40]}. '
                   + ('Provider reports valid; this does not guarantee delivery or decision authority.' if verified else 'Validity is not established; do not treat this address as verified.')))


def discover_customers(body: DiscoveryRequest, *, fetch_page=fetch_public_page, call=None, cost=None) -> DiscoveryResult:
    if call is None:
        call = lambda provider, endpoint, params: provider_json(provider, endpoint, params, cost=cost)
    state = engine_status()
    if state['discovery']['status'] != 'ready':
        raise ProviderError('Customer discovery is not configured. Connect the search provider first.')
    deadline = time.monotonic() + SEARCH_DEADLINE_SECONDS
    provider = state['discovery']['provider']
    # DeepSeek limits queries to 128 Unicode characters. Keep target and location
    # represented, while retaining the complete preferences on the saved search.
    query = plan_query(body.target, body.geography, provider)
    params = {'query': query, 'count': 20, 'need_content': False} if provider == 'deepseek' else {'q': query, 'count': 20, 'safesearch': 'strict', 'text_decorations': False}
    result = call(provider, 'search', params)
    web = result.get('web', {})
    rows = result.get('results') if provider == 'deepseek' else web.get('results') if isinstance(web, dict) else None
    if not isinstance(rows, list):
        raise ProviderError('The search provider returned an unreadable result list.')
    candidates, seen = [], set()
    for row in rows[:20]:
        if not isinstance(row, dict):
            continue
        url = business_url(row.get('url'), body.website)
        if url and url not in seen:
            candidates.append(url)
            seen.add(url)
    profile = body.profile.model_copy(update={'industries': [part.strip() for part in body.target.split(',') if part.strip()][:12]})
    def research(url):
        label = urlsplit(url).hostname
        if time.monotonic() > deadline - 22:
            return None, f'{label}: Search deadline reached.'
        try:
            page = fetch_page(url)  # DNS pinned public reader rechecks every redirect.
            if not business_url(page.url, body.website):
                return None, f'{label}: Redirect did not resolve to an eligible business website.'
            account = qualify_customer(profile, page, target=body.target, geography=body.geography, search_id=body.search_id)
            if not customer_is_qualified(account):
                return None, None
            account.why_fit.append(f'Retrieved for target “{body.target}”; search relevance is not proof of customer fit.')
            account.unknowns.append('Search matches are candidates. Review company identity and suitability before outreach.')
            visible_contacts = published_contacts(page, account.researched_at)
            if visible_contacts:
                account.contacts = visible_contacts
                account.unknowns.append('Published website emails are unverified; named decision-makers have not been established')
            if not _enabled('HUNTER'):
                account.unknowns.append('Contact enrichment is not connected; published emails, when present, have not been verified')
            return account, None
        except FetchError as exc:
            return None, f'{label}: {exc}'
        except Exception:
            return None, f'{label}: Public website research could not complete safely.'

    def enrich_selected(account):
        # Admission and final-domain deduplication happen before paid contact
        # lookup. A discarded duplicate or blocked page never consumes credits.
        visible_contacts = [item for item in account.contacts if item.email]
        if time.monotonic() > deadline - 28:
            if not visible_contacts:
                account.contacts = [Contact(name=None, role='Unknown', email=None, verification_status='not_available', source_url=None,
                                            note='Contact lookup was not attempted within the research time budget.')]
            account.unknowns.append('Contact verification was not attempted within the research time budget')
            return account, f'{account.domain}: Contact lookup was not attempted within the research time budget.'
        error = None
        try:
            lookup = enrich_contact(account.domain, account.researched_at, cost=cost)
            if lookup.rejected_email:
                visible_contacts = [item for item in visible_contacts if item.email.casefold() != lookup.rejected_email.casefold()]
                account.contacts = visible_contacts
                if not visible_contacts:
                    account.unknowns = [item for item in account.unknowns if not item.startswith('Published website emails are unverified;')]
                account.unknowns.append('A provider-rejected email address was excluded from the results')
            contact = lookup.contact
            if contact:
                account.contacts = [contact] + [item for item in visible_contacts if item.email != contact.email]
            elif not visible_contacts:
                account.contacts = [Contact(name=None, role='Unknown', email=None, verification_status='not_available', source_url=None,
                                            note='Hunter reported the discovered email as ineligible; it was excluded.' if lookup.rejected_email else 'Hunter returned no eligible contact for this business domain.')]
        except Exception as exc:
            if not visible_contacts:
                account.contacts = [Contact(name=None, role='Unknown', email=None, verification_status='not_available', source_url=None,
                                            note='Contact lookup could not finish. No address was guessed.')]
            detail = str(exc) if isinstance(exc, ProviderError) else 'Contact lookup could not complete safely.'
            error = f'{account.domain}: {detail}'
        return account, error

    accounts, errors, domains = [], [], set()
    cursor = 0
    with ThreadPoolExecutor(max_workers=PUBLIC_WORKERS, thread_name_prefix='customer-search') as pool:
        while len(accounts) < body.limit and cursor < min(len(candidates), MAX_PUBLIC_ATTEMPTS):
            if time.monotonic() > deadline - 22:
                errors.append('Public website research stopped at its time budget; some candidates were not checked.')
                break
            # Never research/enrich more successes than can be retained. Failed,
            # excluded, and redirect-duplicate candidates free slots for a later
            # batch from this same search response, without another search call.
            size = min(body.limit - len(accounts), MAX_PUBLIC_ATTEMPTS - cursor)
            batch = candidates[cursor:cursor + size]
            cursor += len(batch)
            selected = []
            for account, error in pool.map(research, batch):
                if error:
                    errors.append(error)
                if account and account.domain not in domains:
                    selected.append(account)
                    domains.add(account.domain)
            if _enabled('HUNTER'):
                for account, error in pool.map(enrich_selected, selected):
                    accounts.append(account)
                    if error:
                        errors.append(error)
            else:
                accounts.extend(selected)
        if len(accounts) < body.limit and cursor >= MAX_PUBLIC_ATTEMPTS and cursor < len(candidates):
            errors.append('Public website research reached its ten-attempt limit; some candidates were not checked.')
    accounts.sort(key=lambda account: (-account.score, account.name))
    return DiscoveryResult(accounts=accounts, errors=errors, query=query)
