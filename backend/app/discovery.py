"""Stateless bounded stages; the authenticated caller owns durable dedupe/budgets.

A failed/ambiguous dispatched request retains its full conservative reservation.
There is no worker cache, persistence, per-customer reuse, or paid retry.
"""
from concurrent.futures import ThreadPoolExecutor
import time

from .discovery_config import DiscoverySettings, MAX_TARGETS, timestamp, utcnow
from .discovery_models import (ContactsRequest, ContactsResponse, DiscoverRequest,
    DiscoverResponse, DiscoveryProviders, DiscoveryStatus, ProviderReadiness, VerifyRequest)
from .discovery_providers import (EXA_MINIMUM_RESERVATION, ExaDiscoveryProvider,
    PDLContactProvider, ProviderFailure, ProviderUnavailable, canonical_domain)
from .research import RulesDecisionProvider
from .safety import FetchError, fetch_public_page

DISCOVERY_DEADLINE_SECONDS = 100.0


class DiscoveryService:
    def __init__(self, settings: DiscoverySettings, *, transport=None):
        self.settings = settings
        self.exa = ExaDiscoveryProvider(settings, transport=transport)
        self.pdl = PDLContactProvider(settings, transport=transport)

    def status(self) -> DiscoveryStatus:
        def readiness(policy, cost, price_ok=True):
            configured = bool(policy.configured and price_ok and cost <= self.settings.job_budget)
            reason = ('Ready for bounded requests' if configured and policy.licensed and self.settings.approved else
                      'Requires approved server credentials, commercial embedding/export/retention terms, and explicit budgets')
            return ProviderReadiness(configured=configured, licensed=policy.licensed, reason=reason,
                                     max_cost_microusd=cost if configured else 0)
        discovery = readiness(self.settings.exa, self.settings.exa.unit_cost_microusd,
                              self.settings.exa.unit_cost_microusd >= EXA_MINIMUM_RESERVATION)
        contacts = readiness(self.settings.pdl, self.settings.pdl.unit_cost_microusd * 3)
        blockers = []
        if not self.settings.approved:
            blockers.append('Discovery launch, licensed-data access, and job/workspace/global budgets require operator approval')
        for label, provider in (('Company discovery', discovery), ('Contact discovery', contacts)):
            if not provider.configured or not provider.licensed:
                blockers.append(f'{label} is not configured or commercially licensed')
        return DiscoveryStatus(enabled=not blockers, providers=DiscoveryProviders(discovery=discovery,
            contacts=contacts, verification=ProviderReadiness(configured=False, licensed=False,
            reason='Independent email verification is not configured; discovered emails remain unverified')),
            max_target_count=MAX_TARGETS, max_cost_microusd=self.settings.job_budget if self.settings.approved else 0,
            blockers=blockers)

    def discover(self, body: DiscoverRequest, *, fetch_page=fetch_public_page, parallel_domains=4) -> DiscoverResponse:
        cost = self.settings.exa.unit_cost_microusd
        deadline = time.monotonic() + DISCOVERY_DEADLINE_SECONDS
        try:
            candidates = self.exa.search(body.profile, body.target_count, body.offering_website, body.max_cost_microusd)
        except (ProviderUnavailable, FetchError) as exc:
            return DiscoverResponse(errors=[str(exc)])
        except ProviderFailure as exc:
            return DiscoverResponse(errors=[str(exc)], cost_microusd=cost, spend_uncertain=True)
        # No Jev call here: only the approved Exa reservation can be spent.
        rules = RulesDecisionProvider()
        def evaluate(candidate):
            if time.monotonic() >= deadline - 8:
                return None, 'Company website research deadline reached; no further requests were made'
            try:
                page = fetch_page(f'https://{candidate.domain}/')
                if canonical_domain(page.url) != candidate.domain:
                    return None, f'{candidate.domain}: Website redirected to a different company domain; review required'
                account = rules.evaluate(body.profile, page, campaign_id=body.campaign_id)
                account.domain = candidate.domain
                account.source_provider = 'exa'
                account.source_url = candidate.source_url
                account.retrieved_at = timestamp(utcnow())
                account.license_reference = self.settings.exa.license_reference
                account.license_expires_at = self.settings.exa.expires_at()
                account.license_restrictions = self.settings.exa.restrictions()
                account.contacts = []
                account.unknowns = [x for x in account.unknowns if 'No contact-enrichment provider' not in x]
                account.unknowns.append('Contact discovery and independent email verification have not completed')
                return account, None
            except FetchError as exc:
                return None, f'{candidate.domain}: {exc}'
            except Exception:
                return None, f'{candidate.domain}: Website research could not complete safely'
        with ThreadPoolExecutor(max_workers=min(4, parallel_domains), thread_name_prefix='discovery') as pool:
            results = list(pool.map(evaluate, candidates))
        accounts = sorted((account for account, _ in results if account is not None), key=lambda a: a.score, reverse=True)
        errors = [error for _, error in results if error]
        if not candidates:
            errors.append('No eligible company websites were returned for these criteria; no leads were fabricated')
        elif len(accounts) < body.target_count:
            errors.append('Fewer companies than requested had eligible, safely readable website evidence')
        return DiscoverResponse(accounts=accounts, errors=errors[:20], cost_microusd=cost)

    def contacts(self, body: ContactsRequest) -> ContactsResponse:
        cost = self.settings.pdl.unit_cost_microusd * body.max_contacts
        try:
            contacts = self.pdl.search(body.profile, body.domain, body.max_contacts, body.max_cost_microusd)
            return ContactsResponse(account_id=body.account_id, contacts=contacts, cost_microusd=cost,
                errors=[] if contacts else ['No matching named contacts were returned; names and emails were not inferred'])
        except (ProviderUnavailable, FetchError) as exc:
            return ContactsResponse(account_id=body.account_id, errors=[str(exc)])
        except ProviderFailure as exc:
            return ContactsResponse(account_id=body.account_id, errors=[str(exc)], cost_microusd=cost, spend_uncertain=True)

    def verify(self, body: VerifyRequest) -> ContactsResponse:
        # No adapter or keys are accepted via request fields. In particular, a
        # provider-supplied work_email is never a deliverability attestation.
        contacts = [c.model_copy(update={'verification_status': 'unverified' if c.email else 'not_available',
                    'email_status': 'not_checked', 'email_checked_at': None, 'email_verification_provider': None})
                    for c in body.contacts]
        return ContactsResponse(account_id=body.account_id, contacts=contacts,
            errors=['Independent email verification is not configured; emails remain unverified'])
