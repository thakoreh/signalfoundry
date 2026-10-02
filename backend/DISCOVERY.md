# Discovery-first worker contract

This is an implementation for review, not an activated provider subscription or
permission to spend. No keys, agreements, deployments, or paid requests were
created by this change. Tests are offline. Live commercial acceptance remains a
launch gate, including the actual provider contract and account-specific pricing.

## Endpoints

All four endpoints use POST JSON and the existing server-only bearer boundary:
exact worker host/transport, no browser Origin, 64 KiB body ceiling, bounded
admission, sanitized errors, and no-store responses. The worker does not import
the local SQLite service and does not persist or cache provider data.

- `/worker/discovery-status` accepts `{}`. Response: `enabled`, `providers`
  (`discovery`, `contacts`, `verification`), `max_target_count`,
  `max_cost_microusd`, `blockers`. Each provider has `configured`, `licensed`,
  `reason`, and `max_cost_microusd`. Readiness performs no network request.
- `/worker/discover`: common fields below plus `profile`, `target_count` (1–30),
  `offering_website` (nullable). Returns `accounts`, `errors` (at most 20),
  `cost_microusd`, `spend_uncertain`.
- `/worker/contacts`: common fields plus `profile`, `account_id`, `domain`,
  `max_contacts` (1–3; defaults to 3). Returns `account_id`, `contacts`, `errors`,
  `cost_microusd`, `spend_uncertain`.
- `/worker/verify`: common fields plus `account_id`, `contacts` (at most 3).
  Returns the contact response shape. No live verifier is implemented. It returns
  `not_checked` / `unverified`, a configuration warning, and zero cost.

Common fields are `org_id`, `operation_id`, `campaign_id`, and
`max_cost_microusd` (0–20,000,000). IDs accept 1–160 alphanumeric, underscore,
hyphen, or colon characters. These scope identifiers are accepted only from the
authenticated caller; they are not independently user-authorized by the worker.
Unknown fields, client keys, custom endpoints and strict-type coercions are
rejected. The caller must authorize tenant ownership, freeze campaign targeting,
claim each operation at most once, and reserve/enforce durable global and tenant
budgets before dispatch. IDs are not an in-memory idempotency cache. Never retry
an ambiguous paid call simply because the worker is stateless.

## Provider behavior and evidence

Exa receives target criteria only, one `auto`/`company` request, up to 30 results,
without content extraction or synthesis add-ons. Its results are URL candidates,
not facts. Duplicate, self, directory, reserved and malformed domains are filtered.
At most 30 company homepages are then read through the existing DNS-pinned SSRF
reader, four lanes, eight seconds per fetch and a 100-second discovery admission
deadline. Cross-company redirects are rejected. Rules qualify actual page text;
this path makes no Jev request and cannot introduce an unbudgeted decision charge.
Company size/location and buying intent remain unknown unless existing explicit
evidence supports them. Empty/failed discovery never substitutes fixtures.

PDL receives one Person Search query per account with an exact normalized
`job_company_website` term and buyer-role phrases on `job_title.text`. The adapter
also rejects mismatched employer domains in returned data. It retains only names,
roles, work email, a source profile URL and provenance; no private email fallback,
phone, salary, birth date, raw person object or extra profiles are stored.
`work_email` is provider-reported, never independently verified. Employment and
email-check timestamps remain null. Missing people/emails remain missing.

The transport uses only fixed official HTTPS endpoints, public DNS pinning,
certificate verification, a ten-second deadline and a 512,000-byte response cap.
Redirects/compression are rejected. No retries, browser cookies, environment
proxies or provider response bodies appear in public errors/logs. Only offline
`httpx.MockTransport` may replace this boundary in tests.

`cost_microusd` is a conservative reservation consumed, **not an invoice or exact
provider cost**. Exa consumes its reviewed per-call cap; PDL consumes the requested
record count times its reviewed unit cap, even for fewer matches. Provider/network
failures after attempted dispatch retain that cap with `spend_uncertain=true`.
Preflight gating failures consume zero. Convex must retain the whole unresolved
reservation when its own response is lost. Provider account spend ceilings are
still required because local estimates cannot enforce a vendor's billing system.

## Server configuration, all disabled by default

The same approved global limits must be set on the worker and caller:

- `SIGNALFOUNDRY_DISCOVERY_LAUNCH_APPROVED=true`
- `SIGNALFOUNDRY_LICENSED_DATA_ACCESS_APPROVED=true`
- `SIGNALFOUNDRY_DISCOVERY_JOB_BUDGET_MICROUSD`: 1–20,000,000
- `SIGNALFOUNDRY_DISCOVERY_MONTHLY_BUDGET_MICROUSD`: 1–1,000,000,000
- `SIGNALFOUNDRY_DISCOVERY_WORKSPACE_MONTHLY_BUDGET_MICROUSD`: 1–1,000,000,000

Require job ≤ workspace monthly ≤ global monthly. Worker validation checks the
configuration/each request, while Convex owns the durable cumulative ledger.

For each `PREFIX` of `EXA` and `PDL`, separately approve and set:

- `PREFIX_API_KEY`: server secret; never a browser variable
- `SIGNALFOUNDRY_PREFIX_API_KEY_APPROVED=true`
- `SIGNALFOUNDRY_PREFIX_EMBEDDING_APPROVED=true`
- `SIGNALFOUNDRY_PREFIX_EXPORT_APPROVED=true`
- `SIGNALFOUNDRY_PREFIX_RETENTION_APPROVED=true`
- `SIGNALFOUNDRY_PREFIX_RETENTION_DAYS`: 1–365, no greater than the actual contract
- `SIGNALFOUNDRY_PREFIX_LICENSE_REFERENCE`: operator's approved contract reference
- `SIGNALFOUNDRY_PREFIX_LICENSE_EXPIRES_AT`: timezone-aware future ISO timestamp
- `SIGNALFOUNDRY_PREFIX_UNIT_COST_MICROUSD`: approved conservative cost cap

For example `SIGNALFOUNDRY_EXA_EMBEDDING_APPROVED`, not the literal word PREFIX.
Exa's unit cap is a complete search call and must be at least 27,000 microUSD to
cover this implementation's maximum 30 auto results at reviewed list pricing.
PDL's unit cap is one person record under the actual plan; it has no default.
Re-review prices before activation and whenever plan/pricing changes. Do not copy
these declarations into an environment as a substitute for obtaining permission.

Each result expires at the earlier of provider-contract end and retrieval plus
approved retention. The caller must independently enforce each account/contact
expiry at display/export and actually delete data and backups according to its
contract. An Exa account's expiry does not extend PDL contact rights. License
revocation must immediately disable licensed-data access. No cross-customer cache,
reuse, redistribution or shared contact pool is implemented or permitted by this
application. Flags are operator attestations, not a legal conclusion or license.

## Local mode

The local/preview app always reports disabled discovery at
`GET /api/discovery/status` (legacy alias `/api/discovery-status`). It can save a
`mode=discovery` draft with profile snapshot and target count, but research rejects
it before any network/provider activity. Manual mode remains available where
previously allowed and now freezes a supplied/current profile snapshot.
`POST /api/campaigns/suggest-brief {website}` previews website inference without
mutating workspace targeting; public read-only previews reject it.

## Official references checked 2026-10-02

- [Exa Search](https://exa.ai/docs/reference/search): fixed POST endpoint,
  API-key header, category and result fields; company searches do not accept
  `excludeDomains`, so filtering is local
- [Exa pricing](https://exa.ai/docs/admin/pricing): auto search is $0.007 through
  10 results and $0.001 per additional result; contents/summaries are not requested
- [PDL Person Search](https://docs.peopledatalabs.com/docs/reference-person-search-api):
  fixed v5 endpoint, record billing, size 1–100 and default 10 requests/minute;
  this implementation restricts size to 3. Pace shared-account calls accordingly
- [PDL authentication](https://docs.peopledatalabs.com/docs/authentication) and
  [person mapping](https://docs.peopledatalabs.com/docs/elasticsearch-mapping):
  header authentication, exact employer field and analyzed job-title subfield
- [PDL subscription agreement](https://privacy.peopledatalabs.com/policies?name=services-subscription-agreement):
  the linked legal portal did not expose readable agreement text to the research
  tool. Actual embedding, export, retention, termination/deletion and end-customer
  rights are **not verified**. Obtain and review the signed agreement/order form
  before setting approval flags. An ordinary API key proves none of those rights

Offline verification: `cd backend && python -m unittest discover -s tests -v`.
Live provider behavior, real billing, email deliverability and commercial rights
have not been validated by the offline suite.
