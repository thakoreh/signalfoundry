# Discovery-first campaigns: reviewer handoff

## Current scope — 2026-10-02

Branch `feat/discovery-first-campaigns` starts from merged main
`496834f1df134a70a065d6b1de9c22dd531056b5` (premium motion/carousel PR #2).
This is one new **draft review PR**. Preserve concurrent work on main. The owner’s
other agent reviews and deploys; this change does not authorize merge or deployment.

The core workflow is now offering URL/description → generated **editable** target
brief → explicit review → Find customers → company discovery/public evidence and
rules qualification → named contact lookup → optional independent verification →
shortlist/drafts/export. Manual import is secondary. Company size and geography
are search criteria, not established firmographic facts. Consumer/community
acquisition is future work; this first implementation is deliberately B2B.

### Implemented

- Description-only local targeting hypotheses and URL-based profile previews,
  editable buyer roles, industry, size, geography, signals and exclusions
- Campaign-specific immutable profile snapshots for research and drafts, so
  changing a workspace profile cannot silently retarget an existing campaign
- Real Exa company search and PDL Person Search adapters with fixed official
  endpoints, public-DNS pinning, bounded requests/results and no automatic paid
  retries. Jev is an optional manual qualifier and is never the lead source
- Convex stages with transactional tenant/global monthly budget reservations,
  per-job ceilings, exact-operation claims, conservative consumed reservations,
  cancellation, partial-result retention and unknown-spend holds
- A shared-account PDL rate gate spaced at least 6.1 seconds between claims,
  respecting the documented default 10 requests/minute
- Source/license references, retrieval and expiry times, independently checked
  email fields, per-provider access revocation, display/export filtering and
  bounded scheduled physical retention sweeps. No provider cache or shared
  cross-customer contact pool exists
- Existing Clerk organization/role boundaries, Stripe configuration and billing
  requirements, manual research, evidence and landing motion remain in place

### Honest limitations

No provider keys, subscriptions, prices, credentials, access grants, contracts,
paid calls, outreach, schema pushes or deployments were created. No independent
email verifier is configured or implemented: returned work emails remain visibly
unverified, never guessed. Worker readiness performs no provider requests.

Actual PDL embedding, end-customer display, export, storage, termination/deletion
and resale rights are **not established** by the readable API docs. Its legal
portal did not expose the agreement text. Obtain the actual signed order form and
agreement and review Exa’s applicable contract before activation. A key or an
ordinary subscription alone does not prove commercial product-embedding rights.
The flags below attest to separate approvals; they do not grant rights themselves.

## Environment and approval gates

Read [the exact worker contract and environment names](backend/DISCOVERY.md).
Keep all approval values absent/false until the owner separately authorizes
access, legal terms and an explicit total spend ceiling.

On Convex, configure the already-approved worker HTTPS URL/token and normal
Clerk/Stripe settings as before. Discovery additionally requires:

- `SIGNALFOUNDRY_DISCOVERY_LAUNCH_APPROVED`
- `SIGNALFOUNDRY_LICENSED_DATA_ACCESS_APPROVED`
- `SIGNALFOUNDRY_EXA_DATA_ACCESS_APPROVED`
- `SIGNALFOUNDRY_PDL_DATA_ACCESS_APPROVED`
- `SIGNALFOUNDRY_LICENSED_DATA_EXPORT_APPROVED` for CSV export of provider data
- `SIGNALFOUNDRY_DISCOVERY_JOB_BUDGET_MICROUSD`
- `SIGNALFOUNDRY_DISCOVERY_WORKSPACE_MONTHLY_BUDGET_MICROUSD`
- `SIGNALFOUNDRY_DISCOVERY_MONTHLY_BUDGET_MICROUSD`

The worker separately requires approved Exa/PDL secrets, embedding/export/retention
rights, contract reference/end date, approved retention days and per-call/per-record
conservative cost ceilings. Budgets are integer microUSD (1 USD = 1,000,000).
Job ≤ workspace monthly ≤ global monthly; job maximum is $20. No default paid
budget exists. Set matching worker/Convex limits and vendor account hard caps.
These local caps are conservative reservations, not a guarantee about vendor invoices.
Unknown outcomes hold the full job reservation and require manual reconciliation;
there is no automatic refund or re-dispatch of a paid step.

Per-provider access flags allow disabling PDL contacts while preserving Exa company
evidence, or disabling all licensed data immediately. Export is a separate grant.
On contract termination, disable access first and complete provider-required
physical deletion/backups/export-customer obligations. Scheduled live-record
expiry cannot revoke CSVs already downloaded or erase external backups.

## Data migration and staging

New campaign/job fields are optional for existing Convex rows. New tables track
spend, usage and provider pacing. Existing manual jobs/campaigns stay readable;
new campaigns freeze their targeting snapshot. No populated schema was pushed.
Before deploying, run official Convex codegen, review the additive schema and
exercise a separately authorized staging migration and two-organization test.

## Verification and launch acceptance

Local tests and exact-head CI results are recorded in `docs/DISCOVERY_VERIFICATION.md`.
Unit tests use synthetic identities and offline provider transports; they cannot
certify real provider licensing, billing, deliverability or deployed integration.

Before production activation:

1. Review the draft diff and exact-head source/container/browser CI plus desktop,
   mobile and tablet screenshots; rerun after any integration or fix
2. Validate Clerk sessions/organization switches, existing Stripe behavior and
   legacy/manual campaigns against the approved staging environment
3. Obtain and record explicit commercial/data-use approvals and total spend limits;
   configure keys only via approved secure setup, never browser variables or source
4. With separate live-test authorization, verify the real Exa/PDL contracts,
   target-quality/coverage, empty/429/timeout behavior, billed usage versus ledger,
   cancellation before/between stages and worker restart/no-duplicate behavior
5. Verify independent per-provider expiry/revocation, physical purge, backup
   deletion, export permissions and human-review outreach/privacy obligations
6. Add and approve an independent verification provider before claiming verified
   email; consumers/communities and outreach sending remain out of scope

## Rollback

First disable discovery launch and licensed-data access/export gates. Cancel queued
runs; uncertain in-flight spend must remain reserved for reconciliation. Preserve
ledger records. An authorized rollback may redeploy the recorded prior frontend/
worker image, but **do not narrow the Convex mode/schema while discovery rows still
exist**. Keep the additive schema compatible or migrate/archive discovery rows via
an independently approved procedure. Deletion obligations and provider contract
retention still apply. Do not reset main, merge this PR, deploy, or delete customer
data as part of this review task.

---

## Historical landing and release handoff (superseded where noted above)

# SignalFoundry premium landing: reviewer and deployment handoff

## Scope and review boundary — 2026-10-02

This is a presentation-only redesign on `design/premium-research-story`, based on main `6748d517aed74d8b90a75647996e812809b08b85`. Rechecked remote branches before implementation; no newer redesign branch or open PR existed. Recheck main and any external-agent work before merging.

The owner requested one reviewable branch/PR per repository. The owner's other agent reviews and deploys. **Do not merge or deploy without that separate authorization.** No deployed environment, account, secret, provider configuration, billing behavior, database, or Convex function was changed by this work.

### Motion revision requested after the first review

The owner specifically asked for more Explee-like animation, fluid motion, and carousel behavior. The live reference was inspected again in the cloud browser: animated hero signal paths, moving testimonial rows, staggered content, and sticky stacking workflow cards. This revision uses original product visuals and does not copy Explee assets, testimonials, numbers, contact/sending capabilities, or commercial claims.

- The research walkthrough is now a real horizontally translating four-slide carousel, with 7-second automatic progression, a progress indicator, wrapping Previous/Next controls, tabs/Arrow/Home/End keyboard control, and horizontal pointer/touch swipe
- Autoplay runs only while at least 35% of the carousel is visible and the document is visible. Mouse hover pauses it; keyboard focus, manual selection, or a touch interaction stops it until explicitly restarted. Hidden slides are inert and removed from the accessibility tree
- Explicit Play/Pause controls and a page-wide motion control are provided. System reduced motion disables autoplay and transitions, even if Play is attempted; all content stays available. Decorative motion pauses outside the viewport and in hidden tabs
- Original signal-path particles, a moving evidence ribbon, layered/staggered slide entrances, and a softly floating evidence card provide visible rhythm; the ribbon becomes a readable wrapped layout with motion off
- Background-tab suspension is separate from the user pause layout, so hiding/showing the page cannot reflow the ribbon. Its initial reduced-motion layout uses the native media query rather than a hydration-time assumption. A held primary touch anywhere in the carousel, including links and controls, immediately stops autoplay
- All motion uses local React/CSS/SVG. No animation package, external font, video asset, or runtime dependency is added. No scroll hijacking or automatic live research

Local revision verification: the complete aggregate suite passed (91 backend, 41 frontend node, 64 Convex, typecheck, lint, build, and integration checks); the final focused landing suite passes 34 cases. The browser suite now contains 62 cases, including two normal-speed retained motion videos. Actual browser execution, screenshots, recordings, audits and containers must be checked on the exact PR head in CI. The first motion CI run on `e9bf708` passed 61/62 browser cases and all containers; the sole failure was an incorrect test setup that auto-scrolled the carousel below its visibility threshold during a hover test. The test now validates a visible hit-tested pointer target without scrolling. Run `37042617945` on `1c2cbd2` passed all jobs, but detailed review found one mobile touch case that passed on retry. Its trace showed overlapping swipe animations followed by a tap auto-scrolled to the bottom viewport edge. The refined test waits for the actual rendered animation endpoint, centers and hit-tests a real touch target, and repeats three swipe/decision cycles without fixed sleeps. Final-head CI must pass after this test refinement; keep any retry/flaky result visible in the review. Earlier passing results below are historical and do not certify this revision.

### What changed

- Focused centered hero, readable research proof, a quieter signal-line visual, clearer section pacing, and responsive cards
- Four controllable carousel stages: ICP, account import, evidence, shortlist/export
- Keyboard tab controls (Arrow keys, Home/End), Previous/Next, a reversible sample shortlist, and persisted in-memory selection when switching stages
- Sample interactions make no requests, storage writes, real imports, research jobs, exports, or account changes; explicit labels distinguish saved illustrative research from live output
- Native fragment anchors address the reproduced `#examples#workflow` / `#examples#faq` defect; signup/signin return paths remain unchanged
- Reduced-motion support, explicit playback controls, and no scroll hijacking, external fonts, runtime video, or animation dependency
- Legal-page branding retained; existing authentication, billing, tenant isolation, workspace, API, and backend code preserved

## Verification completed locally

- Complete `bash scripts/check.sh` passed: 91 backend tests; packaging, deployment, launcher, preflight and worker checks; 41 frontend node tests; 64 Convex tests; 14 landing/DOM tests (15 after the focused accessibility-review additions); TypeScript; ESLint; production build; proxy integration; full-stack API workflow; public-preview standalone and hostile-header checks
- Separate `scripts/test_saas_failclosed.py` passed: SaaS build with missing providers fails closed; no legacy/demo API fallback
- DOM regressions exercise roving keyboard focus, repeated stage transitions, wrapping controls, reversible shortlist state, native anchor contracts, no network/storage/download effects, and honest product boundaries
- Dependency audit at the initial test checkpoint reported zero vulnerabilities including dev dependencies; exact final-head CI repeats the repository audits

Local browser navigation to the loopback preview was refused (`ERR_BLOCKED_BY_CLIENT`). This is **not** a visual QA pass. The PR adds 40 Chromium CI cases across desktop 1188/1440 and mobile/tablet 360/390/768, keyboard/menu/hash behavior, reduced motion, stable panel heights, and source screenshots. Inspect the `landing-browser-evidence` artifact for the final commit. The initial full CI run passed on `51b794b` (run `37009106124`), including all 35 browser cases, three Docker builds, worker-container smoke, dependency audits, fail-closed checks, and Gitleaks. Downloaded desktop/tablet/mobile screenshots were visually inspected. Review then corrected mobile navigation keyboard order, compact tab naming, and word spacing when mobile headings hide a line break, with targeted regression assertions. The refinement run also passed on `908950e` (run `37009983088`). A final contrast check darkened two small research labels and added five viewport-specific foreground-contrast regressions, bringing the browser suite to 40 cases. Recheck the final PR head CI; do not use an earlier run as proof of the newer head.

## Environment and migrations

No new environment variables, secrets, migrations, provider grants, or runtime dependencies. `jsdom` and `@playwright/test` are test-only dependencies. CI uses Node 24. Use the repository’s recommended Node 24 locally. jsdom is pinned to 26.1.0 to avoid raising the existing Node compatibility floor.

To reproduce: `bash scripts/setup.sh`, `bash scripts/check.sh`, then in `frontend`: `npx playwright install --with-deps chromium` and `npm run test:browser`. Browser tests require a local-demo production build. The fail-closed SaaS check replaces `.next`; rebuild with both `SIGNALFOUNDRY_MODE=local-demo` and `NEXT_PUBLIC_SIGNALFOUNDRY_MODE=local-demo` before browser testing. Browser test server uses loopback port 4302.

## Before deployment

1. Review the complete diff and **all exact-head CI jobs**, including browser screenshots. Keep this PR draft until the owner/reviewer accepts the design and gates
2. Resolve any overlap with newer remote work; rerun all affected checks after integration
3. In an authorized staging deployment, test real Clerk sign-in/sign-up/organization recovery, existing workspace research/import/draft/export, and Stripe boundaries with the already-approved test setup. Mock/local checks do not prove live provider behavior
4. Visually check Safari/iOS, Android Chrome, 200% zoom, real touch navigation, screen-reader announcements and contrast; Chromium CI does not prove every accessibility/browser combination
5. Measure real deployment performance under mobile throttling. No production LCP/INP/CLS guarantee is claimed from unit tests
6. Preserve all production launch gates in the previous handoff below

## Rollback

No data migration is involved. If an authorized deployment needs rollback, redeploy its recorded pre-redesign image/commit or revert the landing redesign commit(s), including their tests/workflow additions, on a reviewed branch. Do not reset main or disturb unrelated external-agent work. Existing provider configuration and customer data require no rollback for this presentation-only change.

---

## Previous release-candidate handoff (retained history)

## Current status and source of truth

This branch contains a Clerk + Convex + Stripe **release candidate**, not a verified live production launch. The existing main baseline was fetched and checked before publication: `5dac4f2adc0ee6ba81e643074d3f2095018e45f7`. Its explicit no-password public-preview option and preceding Coolify/NGINX fixes are preserved.

The no-password choice applies to the **legacy local-demo preview**. It does not disable Clerk authentication or tenant authorization in SaaS mode. Never place real customer data in the shared preview workspace.

Implementation commits: `d6b2884` (SaaS hardening) and `d220a7b` (release-package privacy exclusions). Publication may use an equivalent tree with connector-created commit identifiers; review the actual branch head and its CI.

No cloud account, credential, Stripe product/price, live migration, or deployment was created. No paid calls or outreach were made. Do not merge or deploy this branch without the owner's next approval and the release gates below.

## 1. Review the branch and CI

- Review the draft pull request and run the `Verify release candidate` workflow on the exact head commit
- Preserve the existing public-preview deployment unless explicitly authorized to replace it
- Fix any CI failure before calling the candidate validated; do not label skipped/unavailable checks as passes
- Read [verification evidence](docs/VERIFICATION.md), [architecture](docs/ARCHITECTURE.md), [SaaS setup](docs/SAAS_SETUP.md), and [launch gates](docs/PRODUCTION_READINESS.md)

Local evidence: 72 backend tests, 28 frontend tests, 47 Convex tests; clean typecheck/lint; both Next build modes; local full-stack/proxy/preview checks; worker HTTP smoke; fail-closed SaaS configuration; dependency audits and Gitleaks. All provider identities and payments in these tests are mocks. Docker and live provider/browser acceptance were not available locally.

## 2. Obtain the owner's environment choices

Use the existing intended accounts/projects if available. Ask the owner to identify the Clerk application, Convex development/production deployments, Stripe account/test environment, application domain, worker hosting location, approved recurring price, currency, taxes, refund/cancellation policy, and commercial research limits.

Use secure platform settings/handoffs for credentials. Never ask for passwords or secret keys in chat. Do not create credentials, OAuth grants, projects, prices, paid resources, or persistent provider access without the required explicit authorization.

## 3. Configure Clerk and Convex in an approved development environment

- Enable Clerk Organizations with supported `org:admin` and `org:member` roles
- Configure the Convex integration/token template and verified issuer. Signed tokens must carry the active organization and role
- Configure frontend server/build variables and Convex environment variables listed in [SAAS_SETUP.md](docs/SAAS_SETUP.md)
- Run official Convex codegen against the selected deployment. The checked-in `_generated` files are labeled local bootstraps, not proof of a backend push
- Typecheck again, deploy only to the approved development environment, then run actual database/auth/scheduler tests
- Test two organizations and two users, membership removal, role changes, expired sessions, recovery/logout, organization switching during in-flight operations and ID substitution on every entity

## 4. Deploy the correct components, with approval

- Existing root `Dockerfile`: legacy local-demo preview only, including its explicit public/no-password setting
- `deploy/saas.Dockerfile`: SaaS Next frontend, with Clerk and server-side Convex access
- `deploy/worker.Dockerfile`: private stateless Python research worker, with no demo API/database
- Convex: sole SaaS database and durable scheduler

Do not convert a demo build to SaaS using only runtime variables; rebuild matching modes. Configure TLS, exact trusted proxy addresses, private worker ingress, egress restrictions, resource limits, readiness probes and safe secret storage. `/readyz` is configuration readiness, not proof all providers work. Test actual containers and restart behavior on the target host. The worker token belongs only in server-side settings.

## 5. Configure and test Stripe before enabling commercial research

- Approve and configure the recurring `STRIPE_PRICE_ID`, monthly job limit and domains-per-campaign limit
- Current policy: only an active matching unexpired subscription qualifies; UTC calendar-month quota counts accepted distinct manual job starts. Retry attempts do not count again; failure/cancellation does not refund quota. No free-trial/pricing policy is invented
- Configure Stripe Customer Portal and the signed Convex webhook endpoint documented in [SAAS_SETUP.md](docs/SAAS_SETUP.md)
- Test Checkout, abandonment, payment failure, delayed/out-of-order/replayed webhooks, renewals, cancellation, resubscription, and outages using the actual Stripe test account
- A Checkout return URL is not entitlement. Access is granted only through server-verified subscription reconciliation
- Approve live credentials/setup separately; never charge a real customer as an unapproved test

## 6. Close operational and product release gates

- Resolve the historical GitGuardian incident on commit `88c895f` using its exact occurrence. Passing Gitleaks does not dismiss another scanner's alert. Rotate a real exposed credential at its issuing service; source removal alone is insufficient
- Rehearse encrypted Convex backup/export and restore into isolated staging; agree on recovery objectives
- Configure alert ownership for readiness, job failures/backlog/capacity, auth failures, billing webhooks and resource usage
- Approve privacy notice, product terms, retention/deletion/export handling, company/support identity and data-provider licensing
- Licensed lead discovery, contact/email verification and automatic sending remain unavailable. Fictional demos and public-site observations must remain honestly labeled
- Complete actual browser/mobile/accessibility acceptance with configured Clerk components; local browser access was blocked during this implementation

## Handoff completion criterion

A reviewed exact commit with passing CI, approved configuration, successful real-provider staging acceptance, operational recovery evidence and explicit deployment authorization. Until then, describe this as a release candidate with outstanding launch gates.
