# Architecture and boundaries

## Request flow

The browser calls same-origin `/api` endpoints through Next.js. Next.js proxies to the local FastAPI process. The API validates input, reads the current fixed local workspace, calls the research/decision layer and stores results through the SQLite repository. The browser never receives provider keys.

## Research and judgments are separate

A research source supplies a URL, extracted text and retrieval time. A judgment evaluates that evidence against the saved ideal customer profile. A draft uses those stored observations rather than inventing a relationship, purchase intent or contact detail.

An account is reviewable even when the evidence is incomplete. “Unknown” is a valid and useful result. A failed fetch does not become a positive fit signal. A score is an aid to prioritization, not a certification that the company will buy.

## Deterministic development and tests

Fictional demo fixtures use reserved `.example` domains and explicit demo flags. They are not fallbacks for a failed live request. Tests do not need paid services, real credentials or outbound messages. Provider tests replace network responses with validated fixtures.

## Persistence semantics

Campaigns, accounts, review state and evidence live in SQLite. Research reruns retain account identity and review status. API validation failures should leave previously saved workspace data unchanged. Scores are snapshots of the profile and evidence at research time; after changing the profile, rerun research before relying on old scores.

## Tenant boundary

The repository uses tenant-scoped queries to make later isolation straightforward to test. The current tenant is a fixed development value. This does not provide authentication or user isolation. A production identity layer must derive tenant identity from a validated server session and enforce it on every route, storage reference and job.

## Provider seams

- Candidate discovery: fictional fixtures or explicitly supplied company domains today; replaceable external discovery boundary
- Website research: public-page fetch and extraction, bounded and SSRF-protected
- Decisions: explainable rules by default, optional Jev adapter under server-only opt-in configuration
- Contact verification: no configured provider, explicitly unavailable
- Writing: grounded templates, human review, no sending

Use the backend source and README as authoritative implementation details. Do not assume future provider support exists because the architecture has a place for it.
