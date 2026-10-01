# SignalFoundry Python services

Production SaaS uses only the stateless `app.worker:app` service; Clerk handles
identity, Convex owns all tenant data, and Stripe handles billing. Worker contract,
authentication, deployment boundaries, and verification are documented in
[`deploy/worker.README.md`](../deploy/worker.README.md). The worker neither imports
nor exposes the SQLite demo below.

## Isolated local-demo API

Python 3.11+ / FastAPI / SQLite local-demo backend. Run from this directory:

```sh
python -m pip install -r requirements.lock.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Run the deterministic, offline automated tests:

```sh
python -m unittest discover -s tests -v
```

OpenAPI: http://127.0.0.1:8000/docs. The frontend proxies `/api/*` to this API.
`POST /api/campaigns` returns 201; successful other writes return 200.

## What works

- Analyze a public business page into an editable draft ICP using explicit keyword rules
- Persist the workspace, campaigns, researched accounts, review statuses, and evidence in `data/signalfoundry.sqlite3`
- Initialize a fictional demo profile with `POST /api/demo/reset {}`. Despite the route name, this **preserves all existing campaigns and accounts**
- Research eight explicitly fictional `.example` companies, or up to ten supplied public business URLs per manual campaign
- Rank results with explained score components; show source URLs and UTC retrieval times
- Shortlist/dismiss accounts, generate an unsent grounded outreach template, and download formula-safe CSV
- Re-run research without duplicate accounts, changed account IDs, or lost review statuses
- Preserve previous records on failed fetches and retain previous failed-domain results during partial re-runs

Existing account scores are snapshots. Editing the ICP does not silently rescore them; re-run a campaign to update its scores. A failed refresh may still have retained accounts: the response status refers to the latest run and its errors explain the failures. Research is a bounded synchronous operation; one run at a time, with 409 on overlapping requests. No job queue or background worker is claimed.

## Truthfulness and scope

This is a **local demo, not an authenticated multi-user SaaS**. The server injects a fixed local tenant and all repository queries include that tenant. No client-provided tenant selector exists. Tenant-scoped storage is tested, but it does not replace authentication or authorization. There is no login, billing, sending, CRM sync, lead database, or live contact enrichment.

Demo companies, locations, headcount bands, and statements are fictional fixtures. Every demo account and evidence record is marked `is_demo`. Fictional contacts never have a person name or email. Manual results never invent employee counts, location, contact names, email, verification status, or publication dates. Suggested buyer roles are clearly labeled as suggestions, not identified contacts. Industry is a website-language suggestion, not independently verified. Website signals may be old; retrieval time is never substituted for publication time.

`providers.py` defines discovery/contact/decision seams. External discovery and contact adapters fail explicitly with `ProviderNotConfigured`. Manual mode reads only the supplied page, following validated redirects; it does not scrape search results, load JavaScript, or crawl subresources. Some sites will be inaccessible from a restricted network, require JavaScript, deny bots, or exceed the fetch limit. These are reported as actionable errors.

## Rules rubric

- Keyword text matches: 0–40 points, full points at four configured matches (or all configured keywords if fewer)
- Target-industry language: 0–25 points; configured industry names or documented synonyms
- Buyer-role text matches: 0–15 points, full points at two configured roles (or all if fewer)
- Observable signal language: 0–20 points, full points at two listed signal terms
- Explicit exclusion language: −50 points
- Final score clamped to 0–100; `qualified_count` counts scores of 65 or above

Absent targeting dimensions earn zero points, not a free pass. Company size and geography are editable planning rules but **are not scored in this MVP**, because manual website extraction cannot reliably establish them. Every account discloses that limit. Confidence represents bounded evidence coverage (`low`/`medium`), not independently verified correctness, intent, or a verified contact.

## Safety boundaries

Bind **only to 127.0.0.1**, and keep both API and frontend private. This app does not provide a production security boundary.

- Hosts restricted to `localhost` / `127.0.0.1`; CORS/Origin restricted to their HTTP ports 3000, 3001, and 8000. Do not add arbitrary origins for public deployment
- Mutations require JSON, strict models reject unknown fields, and request bodies are capped at 64 KB
- Public HTTP(S) only, standard ports only, no credentials in URLs, no local/reserved hostnames or numeric IP literals
- All DNS answers checked for public routability; reject mixed public/private responses, mapped/tunnel/translation IPv6 addresses, loopback, link-local, deprecated IPv6 site-local, multicast, private, reserved, and documentation ranges
- Connections pinned to the validated IP with the original hostname retained for TLS certificate validation and Host header; no secondary DNS lookup, cookies, credentials, or environment proxies
- Every redirect revalidated, at most three redirects; HTML only, 512,000 response bytes, 24,000 extracted characters, overall eight-second fetch deadline, two-second DNS deadline
- A deadline-aware socket reader also bounds slow header/body trickling; compressed responses rejected; scripts/styles never executed
- CSV cells beginning with formula operators (including whitespace-prefixed operators) are apostrophe-escaped
- No external email sending endpoint; drafts quote bounded existing evidence and disclose their basis

Production work still needed: real identity/session management and tenant authorization, deployment network controls, rate limits, async job queue, migrations/backups, observability, approved provider contracts, crawl-policy handling, and applicable privacy/outreach compliance review.

## Optional Jev decision adapter

The default engine is `rules`, even if unrelated credentials exist. No provider calls run on import or startup. Demo research always uses local fixture rules. To intentionally enable the optional external adapter for **manual research**, the operator must configure both:

```sh
DECISION_ENGINE=jev
JEV_API_KEY=<your-server-side-key>
```

Do not put keys in frontend code or checked-in files. The application reads this specific key only after explicit `DECISION_ENGINE=jev`. Opting in permits sending your editable business ICP and up to 12,000 characters of each supplied public business page to Jev; calls may incur provider charges. The build/test process does not inspect existing keys and makes no live paid calls.

Verified documentation, September 30, 2026:
- https://docs.typesafe.ai/api
- https://docs.typesafe.ai/models

The live adapter uses the same DNS-validated, IP-pinned HTTPS transport with an absolute eight-second deadline (including DNS, TCP, TLS, headers, and body). Manual campaigns are at most 80 seconds of external fetch budgets in rules mode, or 160 seconds with Jev, plus small local processing overhead. Configure any local reverse proxy accordingly. No automatic provider retries occur.

The adapter pins `jev-1.13.0`, calls `POST https://api.typesafe.ai/v1/systemone` with server-side Bearer auth, and submits explicit choice and five-level score questions. The score is the expected **zero-based level** (0–4), mapped to 0–100; it is not assumed to already be normalized. Strict response validation checks model, answer keys/types, score range, finite probabilities, probability totals, confidence bounds, and score/distribution consistency. The rule-based exclusion penalty remains an explicit guard.

`Account.decision_engine` reports the engine actually used. Unconfigured keys, timeout, HTTP errors (including 401/422/429/529), malformed results, and oversized responses fall back to local rules with a reason in `unknowns`. No automatic retries or extra paid calls occur. Account confidence continues to mean evidence coverage; Jev's distribution-derived confidence is disclosed separately. `/health` reports the configured usable engine; it does not guarantee a future upstream call will succeed. The adapter has only mocked tests, **not a live integration verification**.

## Verification

The offline automated suite covers API workflows, SQLite restart persistence, tenant isolation, rollback, failure preservation, manual evidence/unknowns, reruns, status edits, CSV escaping, strict validation, local-origin checks, DNS/IP/redirect filtering, content and time budgets, a real socketpair HTTP parser round trip, and mocked Jev success/failure contracts. Public website fetching is validated with deterministic transports, not an unrestricted live-web crawl. Live paid Jev integration has not been run.
