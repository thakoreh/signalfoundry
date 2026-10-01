# SignalFoundry handoff: next steps

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
