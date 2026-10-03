"""Strict, stateless server-to-server discovery stage contracts."""
from typing import Annotated
from pydantic import Field, StringConstraints
from .models import Account, Contact, Profile, StrictModel, URLText, ExclusionDomain, MAX_RESEARCH_EXCLUSIONS
from .discovery_config import MAX_JOB_COST, MAX_TARGETS

Identifier = Annotated[str, StringConstraints(pattern=r'^[A-Za-z0-9_:-]{1,160}$')]


class ScopedStage(StrictModel):
    org_id: Identifier
    operation_id: Identifier
    campaign_id: Identifier
    max_cost_microusd: int = Field(ge=0, le=MAX_JOB_COST)


class DiscoverRequest(ScopedStage):
    excluded_domains: list[ExclusionDomain] = Field(default_factory=list, max_length=MAX_RESEARCH_EXCLUSIONS)
    profile: Profile
    target_count: int = Field(ge=1, le=MAX_TARGETS)
    offering_website: URLText | None = None


class ContactsRequest(ScopedStage):
    excluded_domains: list[ExclusionDomain] = Field(default_factory=list, max_length=MAX_RESEARCH_EXCLUSIONS)
    enrich_contacts: bool = False
    profile: Profile
    account_id: Identifier
    domain: URLText
    max_contacts: int = Field(default=3, ge=1, le=3)


class VerifyRequest(ScopedStage):
    account_id: Identifier
    contacts: list[Contact] = Field(max_length=3)


class StageResult(StrictModel):
    errors: list[str] = Field(default_factory=list, max_length=20)
    # Conservative approved charge reservation, not a provider invoice estimate.
    cost_microusd: int = Field(default=0, ge=0, le=MAX_JOB_COST)
    spend_uncertain: bool = False


class DiscoverResponse(StageResult):
    accounts: list[Account] = Field(default_factory=list, max_length=MAX_TARGETS)


class ContactsResponse(StageResult):
    account_id: Identifier
    contacts: list[Contact] = Field(default_factory=list, max_length=3)


class ProviderReadiness(StrictModel):
    configured: bool
    licensed: bool
    reason: str
    max_cost_microusd: int = Field(default=0, ge=0, le=MAX_JOB_COST)


class DiscoveryProviders(StrictModel):
    discovery: ProviderReadiness
    contacts: ProviderReadiness
    verification: ProviderReadiness


class DiscoveryStatus(StrictModel):
    enabled: bool
    providers: DiscoveryProviders
    max_target_count: int = MAX_TARGETS
    max_cost_microusd: int = 0
    blockers: list[str] = Field(default_factory=list)


def local_discovery_status() -> DiscoveryStatus:
    reason = 'Automatic discovery requires an authenticated SaaS workspace and approved commercial providers'
    unavailable = ProviderReadiness(configured=False, licensed=False, reason=reason)
    return DiscoveryStatus(enabled=False, providers=DiscoveryProviders(discovery=unavailable,
        contacts=unavailable, verification=ProviderReadiness(configured=False, licensed=False,
        reason='No independent email verification provider is configured')), blockers=[reason])
