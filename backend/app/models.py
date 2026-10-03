"""Strict API models. All limits also apply to stored user-created content."""
from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=240)]
LongText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=3000)]
URLText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2048)]

MAX_RESEARCH_EXCLUSIONS = 100
ExclusionDomain = Annotated[str, StringConstraints(min_length=3, max_length=253, pattern=r'^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$')]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    @field_validator('*', mode='before')
    @classmethod
    def reject_controls(cls, value):
        def check(item):
            if isinstance(item, str) and any(ord(c) < 32 and c not in '\n\t\r' for c in item):
                raise ValueError('Control characters are not allowed')
        check(value)
        if isinstance(value, list):
            for item in value:
                check(item)
        return value


class Profile(StrictModel):
    company_name: Text
    description: LongText
    industries: list[Text] = Field(max_length=12)
    company_sizes: list[Text] = Field(max_length=12)
    geographies: list[Text] = Field(max_length=12)
    buyer_roles: list[Text] = Field(max_length=12)
    keywords: list[Text] = Field(max_length=20)
    exclusions: list[Text] = Field(max_length=20)


class AnalyzeRequest(StrictModel):
    website: URLText


class EmptyRequest(StrictModel):
    pass


class CampaignCreate(StrictModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    mode: Literal['demo', 'manual', 'discovery']
    domains: list[URLText] = Field(default_factory=list, max_length=10)
    profile_snapshot: Profile | None = None
    target_count: int = Field(default=10, ge=1, le=30)
    offering_website: URLText | None = None
    enrich_contacts: bool = False

    @model_validator(mode='after')
    def valid_domains(self):
        if self.enrich_contacts and self.mode != 'discovery':
            raise ValueError('Named-contact enrichment is only available for discovery campaigns')
        if self.mode == 'manual' and not self.domains:
            raise ValueError('Manual research requires at least one public business domain')
        if self.mode == 'discovery' and self.domains:
            raise ValueError('Discovery campaigns do not accept manually supplied domains')
        if self.mode == 'demo' and self.domains:
            raise ValueError('Demo campaigns use fictional fixtures; leave domains empty')
        return self


ReviewReason = Literal['wrong_industry', 'wrong_geography', 'wrong_size',
                       'existing_customer', 'competitor', 'not_relevant', 'other']


class AccountStatus(StrictModel):
    status: Literal['new', 'shortlisted', 'dismissed']
    reason: ReviewReason | None = None
    suppress_workspace: bool = False
    preserve_workspace_suppression: bool = False

    @model_validator(mode='after')
    def valid_feedback(self):
        if self.preserve_workspace_suppression and (self.status == 'dismissed' or self.reason is not None or 'suppress_workspace' in self.model_fields_set):
            raise ValueError('Preserving existing suppression requires a non-dismissed status, no reason, and no suppression change')
        if self.status != 'dismissed' and (self.reason is not None or self.suppress_workspace):
            raise ValueError('Pass reasons and workspace suppression require dismissed status')
        return self


class RestoreSuppression(StrictModel):
    domain: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=253)]


class Workspace(StrictModel):
    id: str
    name: str
    website: str | None
    profile: Profile | None
    created_at: str


class Campaign(StrictModel):
    id: str
    name: str
    mode: Literal['demo', 'manual', 'discovery']
    status: Literal['draft', 'researching', 'complete', 'partial', 'failed']
    created_at: str
    updated_at: str
    account_count: int
    qualified_count: int
    domains: list[str]
    errors: list[str]
    profile_snapshot: Profile | None = None
    target_count: int = Field(default=10, ge=1, le=30)
    offering_website: str | None = None
    enrich_contacts: bool = False


class Evidence(StrictModel):
    id: str
    title: str
    url: str
    excerpt: str
    kind: Literal['fit', 'signal', 'company']
    published_at: str | None
    retrieved_at: str
    is_demo: bool


class Contact(StrictModel):
    name: str | None
    role: str
    email: str | None
    verification_status: Literal['unverified', 'not_available', 'verified']
    source_url: str | None
    note: str
    provider: str | None = None
    retrieved_at: str | None = None
    employment_verified_at: str | None = None
    email_checked_at: str | None = None
    email_status: Literal['valid', 'invalid', 'catch_all', 'unknown', 'not_checked'] | None = None
    email_verification_provider: str | None = None
    license_reference: str | None = None
    license_expires_at: str | None = None
    license_restrictions: list[str] = Field(default_factory=list, max_length=12)


class ScoreComponent(StrictModel):
    label: str
    points: int
    max_points: int
    reason: str


class Account(StrictModel):
    id: str
    campaign_id: str
    name: str
    domain: str
    description: str
    industry: str
    employee_range: str
    location: str
    score: int = Field(ge=0, le=100)
    confidence: Literal['low', 'medium', 'high']
    decision_engine: Literal['rules', 'jev']
    status: Literal['new', 'shortlisted', 'dismissed']
    review_reason: ReviewReason | None = None
    reviewed_at: str | None = None
    suppress_workspace: bool = False
    why_fit: list[str]
    why_now: list[str]
    unknowns: list[str]
    evidence: list[Evidence]
    contacts: list[Contact]
    is_demo: bool
    researched_at: str
    score_breakdown: list[ScoreComponent]
    source_provider: str | None = None
    source_url: str | None = None
    retrieved_at: str | None = None
    license_reference: str | None = None
    license_expires_at: str | None = None
    license_restrictions: list[str] = Field(default_factory=list, max_length=12)


class Draft(StrictModel):
    subject: str
    body: str
    basis: list[str]
    engine: Literal['grounded_template']
    warning: str
