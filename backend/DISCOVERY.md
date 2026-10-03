# Discovery-first worker contract

This is an implementation for review, not an activated provider subscription or
permission to spend. No keys, agreements, deployments, or paid requests were
created by this change. Tests are offline. Live commercial acceptance remains a
launch gate, including the actual provider contract and account-specific pricing.

## Capability selection (updated 2026-10-03)

Campaign creation accepts `enrich_contacts: boolean`, default **false**. Company
search is the complete default workflow: approved/licensed Exa plus the existing
launch, tenant subscription, and job/workspace/global budget gates are sufficient.
A missing PDL key, license, or access approval does not block company-only jobs.
The campaign snapshot freezes this selection in its job; omitted legacy campaign
and job fields also mean false. Manual campaigns cannot select contact enrichment.
All new fields on existing Convex tables are optional; no backfill is required.

`enabled` and `blockers` in discovery readiness describe company discovery.
`providers.contacts` independently describes optional named-contact readiness.
Selected contacts require separate PDL data-access approval on Convex and approved
worker credentials, commercial rights, retention, and a sufficient remaining
reservation. Known missing Convex approval rejects job start; missing worker
readiness rejects selected enrichment before the first paid request. After Exa
succeeds, PDL revocation, budget exhaustion, or provider failure preserves eligible
company results. Ambiguous dispatch still holds the full reservation; no paid retry
is introduced. Unselected jobs never dispatch contacts, even with valid PDL keys.
The company-search stage also discards any returned contact payload before
checkpointing. Finalization independently enforces the frozen job and campaign
selection, and account get/list/export/status/draft paths enforce campaign opt-in
for legacy rows. Selected discovery contacts require current PDL provenance and
rights; missing-provider records cannot bypass these gates. Manual research keeps
only clearly labelled role suggestions without a person name or email address.

Verification remains a separate unconfigured capability. Readiness cannot silently
enable it; neither company discovery nor named-contact enrichment attests identity,
employment, deliverability, or permission to contact anyone.

## Endpoints

All four endpoints use POST JSON and the existing server-only bearer boundary:
exact worker host/transport, no browser Origin, 64 KiB body ceiling, bounded
admission, sanitized errors, and no-store responses. The worker does not import
the local SQLite service and does not persist or cache provider data.

- `/worker/discovery-status` accepts `{}`. Response: `enabled`, `providers`
  (`discovery`, `contacts`, `verification`), `max_target_count`,
  `max_cost_microusd`, `blockers`. Each provider has `configured`, `licensed`,
  `reason`, and `max_cost_microusd`. Readiness performs no network request.
  Optional contact/verification failures are not company-discovery blockers.
- `/worker/discover`: common fields below plus `profile`, `target_count` (1–30),
  `offering_website` (nullable), and server-derived `excluded_domains` (at most
  100 exact domains; defaults to `[]`). Excluded candidates are removed before
  public website research. Returns `accounts`, `errors` (at most 20),
  `cost_microusd`, `spend_uncertain`.
- `/worker/contacts`: common fields plus `profile`, `account_id`, `domain`,
  `max_contacts` (1–3; defaults to 3), and `enrich_contacts` (boolean, defaults
  to false), plus server-derived `excluded_domains` (same bounded contract).
  An excluded company returns zero cost before PDL dispatch. Omitted/false
  selection returns no contacts, zero cost, and a warning
  before any provider request. Returns `account_id`, `contacts`, `errors`,
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

Exclusions come from tenant-scoped workspace suppressions and explicit campaign
Pass decisions, including legacy dismissed rows. They are exact company domains,
not inferred industry/geography rules. Convex resolves the bounded set before
claiming provider work and rechecks after readiness awaits immediately before
paid dispatch; cancelled/stale jobs cannot proceed. Oversized exclusion sets fail
closed instead of truncating. Returned candidates are checked again before later
enrichment and saving. A Pass/suppression while PDL is already in flight prevents
refreshing that company's evidence/contacts; the known dispatched cost is still
settled conservatively and further enrichment stops without shifting a cursor.

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

Only when explicitly selected, PDL receives one Person Search query per account with an exact normalized
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

On Convex, `SIGNALFOUNDRY_EXA_DATA_ACCESS_APPROVED=true` is also required for
company discovery and licensed company reads. `SIGNALFOUNDRY_PDL_DATA_ACCESS_APPROVED`
is independently required only for selected contacts and licensed contact reads.
`SIGNALFOUNDRY_LICENSED_DATA_EXPORT_APPROVED=true` still separately gates export.

For `PREFIX=EXA`, and separately for `PREFIX=PDL` only when enabling optional
named-contact enrichment, approve and set:

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
revocation must immediately disable the affected provider's data-access flag
(or the global licensed-data flag when all rights are revoked). Turning off new
discovery launch/spending does not alone revoke read rights for unexpired licensed
results; revoking Exa rights hides companies, while revoking PDL rights removes
contacts without hiding otherwise eligible companies. No cross-customer cache,
reuse, redistribution or shared contact pool is implemented or permitted by this
application. Flags are operator attestations, not a legal conclusion or license.

## Local mode

The local/preview app always reports disabled discovery at
`GET /api/discovery/status` (legacy alias `/api/discovery-status`). It can save a
`mode=discovery` draft with profile snapshot, target count, and optional
`enrich_contacts` selection, but research rejects
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
