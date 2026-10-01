"""Explicit provider seams. There are no fake discovery or contact integrations.

No key is read and no paid service is called by this MVP. Future adapters must be
server-side and preserve evidence references, unknowns, and real provider identity.
"""
from typing import Protocol
from .models import Account, Profile
from .safety import Page


class ProviderNotConfigured(RuntimeError):
    pass


class DiscoveryProvider(Protocol):
    def discover(self, profile: Profile, limit: int) -> list[str]: ...


class ContactProvider(Protocol):
    def contacts(self, domain: str) -> list[dict]: ...


class DecisionProvider(Protocol):
    name: str
    def evaluate(self, profile: Profile, page: Page, *, campaign_id: str) -> Account: ...


class UnconfiguredDiscovery:
    def discover(self, profile: Profile, limit: int) -> list[str]:
        raise ProviderNotConfigured('External discovery is not configured. Use fictional demo accounts or provide public business domains.')


class UnconfiguredContacts:
    def contacts(self, domain: str) -> list[dict]:
        raise ProviderNotConfigured('Contact enrichment is not configured. No email address or verification can be supplied.')
