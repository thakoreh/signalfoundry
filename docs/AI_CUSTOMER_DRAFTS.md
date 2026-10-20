# Grounded AI customer message drafts

Drafts use one real DeepSeek chat-completion request after an explicit **Draft message** click. They do not send email, trigger outreach, browse, run tools, or create an autonomous agent loop. The subject and message are editable in the browser. Resetting edits restores the cached AI original without a provider call.

## Configuration and provider contract

Both `CLIENTROVE_DEEPSEEK_DRAFTS_ENABLED=true` and a server-side `DEEPSEEK_API_KEY` are required. The draft flag is separate from search and defaults to false in hosted configuration. No browser-visible key or custom provider URL is supported. The approved local launcher enables the feature when the encrypted local key is configured.

The implementation uses the official fixed `https://api.deepseek.com/chat/completions` endpoint, `deepseek-flash`, JSON output, disabled thinking, a 600-token output cap, no redirects or environment proxies, a bounded response size and timeout, and no provider retries. This follows DeepSeek's current [chat-completion contract](https://api-docs.deepseek.com/api/create-chat-completion/) and [JSON-output guide](https://api-docs.deepseek.com/guides/json_mode/). JSON output is validated locally against an exact schema; provider response text is never used as an error message.

Only the saved business offering, prospect name and up to five short sourced company/fit excerpts are sent to DeepSeek. The prompt treats all supplied content as untrusted data. Contact records, evidence URLs and entire fetched pages are not passed as separate fields. Excerpts may still contain information visible in source material; users must review what is used. Returned source IDs must belong to that prospect's saved evidence. Generated URLs, email addresses, URI destinations, phone numbers and novel numeric claims are rejected. These checks reduce common failures; they cannot prove every generated semantic claim. The UI always requires human review and makes no promise of a customer's needs, intent or results.

## Admission, caching and quotas

Only completed/partial saved searches and a customer owned by that search may be used. The customer must pass the same conservative admission rule as discovery: non-demo, no exclusion component, at least 60 customer-type identity points, and public company/fit evidence. A location score or body-only keyword mention cannot satisfy this check. This wording gate is not a semantic assessment of buying intent.

Local caching hashes the full business profile, account/provenance/contact snapshot, model and prompt version. SaaS uses the immutable completed search/account and current saved profile version. Each successful snapshot has one AI original; a fresh request key cannot regenerate a successful draft. Profile/evidence changes can create a new snapshot.

Every attempted generation, including failed attempts, counts toward five attempts per hour. SaaS additionally requires the configured active subscription and limits monthly draft attempts to `monthlyResearchLimit * min(5, domainsPerCampaignLimit)` without consuming research-start units. This is a bounded initial allowance, not finalized commercial pricing. Reservation and quota writes are transactional and tenant-scoped.

Retries with the same request key never make another model call. A pending snapshot deduplicates across keys. A confirmed terminal failure returns structured `DRAFT_FAILED`; only a new explicit request key after that failure may admit another attempt, subject to quota. An uncertain network failure must retain the original key. A later explicit request recovers a pending attempt older than 90 seconds into a recorded failure without calling the provider; a further explicit retry can then use a new key. Late completion is bound to its original attempt and cannot overwrite a retry. Successful cache hits are free of provider/quota charges, and fresh cache-key aliases are capped at 100 per snapshot per hour to bound storage growth. Existing request keys remain reusable. There is no automatic regeneration or retry.

The local API is `POST /api/customers/searches/{searchId}/accounts/{accountId}/draft` with `{ "idempotency_key": "..." }`. SaaS maps that request to tenant-authenticated `customerDrafts.generate`; only the internal reservation reads the saved profile/customer and calls the authorized stateless worker. Client-supplied profiles, evidence, org IDs and contact addresses are not accepted.

Successful response fields: `subject`, `body`, `evidence_ids`, `warnings`, `generation_engine: "deepseek"`, `created_at`. The public worker route requires the existing server token/transport boundary; the isolated image includes only the explicit worker module allowlist.

## Validation boundary

Offline tests cover provider JSON contracts, disabled mode, source IDs, malformed/truncated/oversized responses, destination/number checks, tenant/search/customer boundaries, weak-fit rejection, idempotency, explicit failed-attempt retry, pending deduplication, cache provenance changes and bounded quota/storage. No live model call or deployment is established by those tests. Live review and hosted deployment must be reported separately.
