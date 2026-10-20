# Clientrove customer engine: operator setup

The engine uses real search results and public company websites. DeepSeek Search
is the selected default. Hunter is optional for business contacts. Neither service
is activated merely because a key happens to exist: explicit enable flags are
required. Initial implementation tests used injected responses. One later,
explicitly authorized live DeepSeek search requested up to five example businesses
and returned four researched companies plus one website blocked with HTTP 403.
That example is not a broader relevance or deliverability benchmark. No Hunter
requests were made; the optional contact provider remains unconfigured.

## Accounts and credentials

1. Create your own [DeepSeek API account](https://platform.deepseek.com/) and
   provision a server API key. Check Search API access and account balance.
2. Optionally create a [Hunter account](https://hunter.io/) and provision its API
   key for Domain Search and Email Verifier access.
3. Before commercial release, verify that each selected provider plan/contract
   permits this customer-facing SaaS use, redistribution of contact results and
   CSV export. A trial allowance is not evidence of resale/redistribution rights.
   Review provider data-processing terms and disclose the actual subprocessors.

Keep keys in server process environment variables or the deployment secret
manager. Never place them in `NEXT_PUBLIC_*`, tracked files, browser storage,
screenshots, application logs, or chat. The API status response never includes keys.

```text
CLIENTROVE_SEARCH_PROVIDER=deepseek
CLIENTROVE_DEEPSEEK_ENABLED=true
DEEPSEEK_API_KEY=<server secret>

# Separate optional AI drafting feature; no email sending.
CLIENTROVE_DEEPSEEK_DRAFTS_ENABLED=true

# Optional: company research works without contact enrichment.
CLIENTROVE_HUNTER_ENABLED=true
HUNTER_API_KEY=<server secret>
```

For this PC, set these in the environment inherited by the Python backend before
starting/restarting `scripts/dev.py`. A frontend `.env.local` does not configure
the Python process. Missing values leave discovery disabled and do not spend credits.
Do not expose the unauthenticated local backend beyond its loopback binding.

For SaaS, put provider variables on the stateless Python **worker**, and configure
the existing worker URL/token on Convex. Existing Clerk organization identity,
worker authentication, Stripe entitlement, plan limits and monthly research
allowance remain required. Deploy the updated Convex schema/functions and worker
together; local Python tests do not demonstrate a deployed SaaS installation.

Brave remains an explicit alternative, never a paid fallback:

```text
CLIENTROVE_SEARCH_PROVIDER=brave
CLIENTROVE_BRAVE_SEARCH_ENABLED=true
BRAVE_SEARCH_API_KEY=<server secret>
```

## Scope and cost bounds

- Each new search makes one Search API request (up to 20 candidate URLs), attempts
  at most ten eligible public homepages with three workers, and returns at most
  the requested one to five unique researched businesses (default five).
- A blocked/unreadable, excluded, or redirect-duplicate candidate frees a result
  slot for another eligible URL from that same search response. No additional
  paid search is made. HTTP 403 and other access controls are respected; there is
  no proxy, login, browser impersonation, or access-control bypass. Source errors
  remain available as partial notes even when later candidates fill the list.
- Literal same-domain email addresses visible on a researched homepage can be
  returned without a contact provider, with source URL/time and `unverified`
  status. Names, roles, and deliverability are not inferred from these addresses.
- When Hunter is enabled, only selected, unique researched businesses are enriched,
  never blocked/discarded candidates. Each makes at most one Domain Search request
  and one Email Verifier request, capped at the requested number of results.
  No person/email guessing,
  SMTP probing, email sending, or automatic paid-provider retries occur.
- One active search and five starts per hour per workspace; SaaS also consumes
  the existing configured monthly research allowance and observes plan result limits.
- Retrying the same request key retrieves its original run instead of repeating
  paid work. A crashed/timed-out run fails after three minutes; it is not retried.
- Search calls, public-site fetches, response bytes and parallelism are bounded.
  Public-site transport validates DNS and every redirect against private addresses.

As checked against official documentation on October 19, 2026, DeepSeek lists
Search at $0.75 per 1,000 successful nonempty requests. Discovery does
not call DeepSeek Fetch or a language model. Separately enabled AI message drafts
make a real `deepseek-flash` chat-completion request after an explicit user click;
token usage is additional to Search pricing. Hunter search/verification usage is
additional and plan dependent. Confirm current terms and costs in your account;
one authorized example search has been inspected; relevance across markets has
not been benchmarked.

## Optional AI message drafts

AI drafting is separate from rules-based customer discovery. Set
`CLIENTROVE_DEEPSEEK_DRAFTS_ENABLED=true` on the backend/worker to opt in; it defaults
to false in hosted configuration and uses the existing server DeepSeek key. The
approved local launcher enables drafting when that encrypted key is present.
Only a qualified customer from a completed/partial saved search may be used.

Each **Draft message** click uses the saved business offering and short sourced
prospect facts to produce an editable subject/body with evidence references.
Review every claim. Customer-type wording is not evidence of buying intent, need
or guaranteed results. There is no automatic email sending or agent tool loop.

Five generation attempts per hour are allowed, including failed attempts. SaaS
also requires the active configured subscription and a monthly draft allowance
of `monthlyResearchLimit * min(5, domainsPerCampaignLimit)`, separate from search
starts. Successful profile/evidence snapshots reuse one cached AI original, with
no paid regeneration. Same-key retries never charge twice; an explicit new key
after a confirmed `DRAFT_FAILED` may admit a new attempt, subject to quota. An
uncertain network failure keeps its original key. Interrupted pending attempts
recover after 90 seconds on a later explicit request, without calling the model.

See [AI draft safeguards and exact contracts](AI_CUSTOMER_DRAFTS.md) for payload
bounds, cache provenance, source validation, storage request limits and offline
test coverage. Commercial contact-data embedding still needs compatible written
provider rights: Hunter's current [terms](https://hunter.io/terms-of-service) and
[content policy](https://hunter.io/transparency/content-policy) restrict competitive
services and sharing/reselling its data without written authorization.

## Facts, contact status, and limits

Provider search summaries are used only to locate websites; they never become
company facts. The engine independently reads each public homepage and retains
URLs, excerpts, retrieval times, rule-based match reasons and explicit unknowns.
Discovery ranking compares the explicitly chosen buyer category and location
against source wording; it does not award buying-intent points for incidental
blog words such as funding or hiring. A service-area mention is not an office
address, proof of current project needs, or an independent geographic verification.
Results are candidates for review, not proven buyers. Location, buying intent,
decision authority, company size and completeness can remain unknown.

Hunter addresses must match the returned company domain. “Provider verified”
requires the explicit verifier status `valid`, no catch-all/disposable/webmail
flags, and no contradicting deliverability result. A score alone never verifies an
address. `accept_all`, `unknown`, incomplete verification and failure remain
unverified/unavailable. Verification is a dated provider report, not guaranteed
delivery. Contact roles are source values, not inferred decision authority.

Search snapshots are private to the active organization (or local demo tenant)
and persist for refresh/review. Define customer-facing retention and deletion
policy before commercial launch. CSV export includes contact status, source and
verification notes, alongside company facts; cells are escaped against formulas.

## REST contract

- `GET /api/customers/engine`: provider configuration/status and `max_results: 5`.
  `ready` means configured, not a successful live provider health check.
- `POST /api/customers/search`: JSON `{target, geography, limit, idempotency_key}`.
  Target is 2–200 characters; geography is optional/empty or at most 120;
  limit is an integer 1–5; request key is 8–128 alphanumeric/underscore/hyphen.
- `GET /api/customers/searches/{id}`: run status, stage, effective search query,
  accounts, safe errors and timestamps. States are queued, running, complete,
  partial or failed. An empty successful result is distinct from provider failure.
- `POST /api/customers/searches/{searchId}/accounts/{accountId}/draft`: JSON
  `{idempotency_key}`; returns `subject`, `body`, `evidence_ids`, `warnings`,
  `generation_engine: "deepseek"`, `created_at`. No caller-supplied facts are accepted.

DeepSeek queries are planned to fit its 128 Unicode-character limit while keeping
the full target preferences on the saved SaaS run. There is no silent provider
switch when balance, access, limits or network errors prevent a search.

## Official API references

- [DeepSeek Search guide](https://api-docs.deepseek.com/guides/search/)
- [DeepSeek Search reference](https://api-docs.deepseek.com/api/search/)
- [DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing/)
- [DeepSeek chat completions](https://api-docs.deepseek.com/api/create-chat-completion/)
- [DeepSeek JSON output](https://api-docs.deepseek.com/guides/json_mode/)
- [Brave Search API](https://brave.com/search/api/)
- [Hunter API reference](https://hunter.io/api-documentation/v2)
