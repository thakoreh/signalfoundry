"""Fail-closed commercial gates. Reading configuration never makes a paid call.

These attestations record an operator's separately approved contract/budget;
setting a flag does not itself grant a provider license or approve spending.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
import os
import re
from typing import Mapping

MAX_TARGETS = 30
MAX_JOB_COST = 20_000_000


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def timestamp(value: datetime) -> str:
    return value.isoformat().replace('+00:00', 'Z')


def positive(value: str | None, maximum: int) -> int:
    return int(value) if value and re.fullmatch(r'[0-9]{1,12}', value) and 0 < int(value) <= maximum else 0


def parse_date(value: str) -> datetime | None:
    try:
        result = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return result.astimezone(timezone.utc) if result.tzinfo else None
    except (TypeError, ValueError):
        return None


@dataclass(frozen=True)
class ProviderPolicy:
    name: str
    api_key: str = field(default='', repr=False)
    key_approved: bool = False
    embedding: bool = False
    export: bool = False
    retention: bool = False
    retention_days: int = 0
    license_reference: str = ''
    license_expires_at: str = ''
    unit_cost_microusd: int = 0

    @property
    def licensed(self) -> bool:
        expires = parse_date(self.license_expires_at)
        return bool(self.embedding and self.export and self.retention and self.retention_days and
                    self.license_reference and expires and expires > utcnow())

    @property
    def configured(self) -> bool:
        # Reject malformed/placeholder keys without ever returning their contents.
        return bool(self.key_approved and 8 <= len(self.api_key) <= 512 and
                    not re.search(r'\s', self.api_key) and self.api_key.isascii() and
                    not self.api_key.lower().startswith(('replace', 'placeholder', 'your_', 'changeme')) and
                    self.unit_cost_microusd)

    def expires_at(self) -> str:
        expiry = parse_date(self.license_expires_at)
        if not self.licensed or expiry is None:
            raise ValueError('Commercial license approval is unavailable or expired')
        return timestamp(min(expiry, utcnow() + timedelta(days=self.retention_days)))

    def restrictions(self) -> list[str]:
        return ['Use only in the requesting customer workspace', 'No cross-customer cache or reuse',
                'Display and export only while the approved license remains active',
                'Delete at the recorded retention deadline or earlier contract termination',
                'Provider data is not independent identity, employment, or email verification']

    @classmethod
    def from_environment(cls, name: str, prefix: str, env: Mapping[str, str]):
        base = f'SIGNALFOUNDRY_{prefix}_'
        reference = env.get(base + 'LICENSE_REFERENCE', '').strip()
        if len(reference) > 240 or any(ord(c) < 32 for c in reference):
            reference = ''
        return cls(name=name, api_key=env.get(prefix + '_API_KEY', ''),
                   key_approved=env.get(base + 'API_KEY_APPROVED') == 'true',
                   embedding=env.get(base + 'EMBEDDING_APPROVED') == 'true',
                   export=env.get(base + 'EXPORT_APPROVED') == 'true',
                   retention=env.get(base + 'RETENTION_APPROVED') == 'true',
                   retention_days=positive(env.get(base + 'RETENTION_DAYS'), 365),
                   license_reference=reference, license_expires_at=env.get(base + 'LICENSE_EXPIRES_AT', ''),
                   unit_cost_microusd=positive(env.get(base + 'UNIT_COST_MICROUSD'), MAX_JOB_COST))


@dataclass(frozen=True)
class DiscoverySettings:
    exa: ProviderPolicy
    pdl: ProviderPolicy
    launch_approved: bool = False
    licensed_data_access: bool = False
    job_budget: int = 0
    monthly_budget: int = 0
    workspace_monthly_budget: int = 0

    @property
    def approved(self) -> bool:
        return bool(self.launch_approved and self.licensed_data_access and
                    0 < self.job_budget <= self.workspace_monthly_budget <= self.monthly_budget)

    @classmethod
    def from_environment(cls, env: Mapping[str, str] | None = None):
        env = os.environ if env is None else env
        return cls(exa=ProviderPolicy.from_environment('exa', 'EXA', env),
                   pdl=ProviderPolicy.from_environment('peopledatalabs', 'PDL', env),
                   launch_approved=env.get('SIGNALFOUNDRY_DISCOVERY_LAUNCH_APPROVED') == 'true',
                   licensed_data_access=env.get('SIGNALFOUNDRY_LICENSED_DATA_ACCESS_APPROVED') == 'true',
                   job_budget=positive(env.get('SIGNALFOUNDRY_DISCOVERY_JOB_BUDGET_MICROUSD'), MAX_JOB_COST),
                   monthly_budget=positive(env.get('SIGNALFOUNDRY_DISCOVERY_MONTHLY_BUDGET_MICROUSD'), 1_000_000_000),
                   workspace_monthly_budget=positive(env.get('SIGNALFOUNDRY_DISCOVERY_WORKSPACE_MONTHLY_BUDGET_MICROUSD'), 1_000_000_000))
