# Clerk + Convex + Stripe release candidate

This branch adds a deployable SaaS architecture, but **is not a verified live production launch**. No provider project, credential, billing product, domain, or live deployment was created by this work. Keep the existing preview separate from customer data.

## Boundaries

- Next.js is the authenticated browser/API gateway. Clerk owns sign-in, sign-up, account recovery, sessions, and organization membership.
- Convex is the only SaaS system of record. It owns tenant authorization, profiles, campaigns, accounts, durable research jobs, quota counters, and billing state. There is no SaaS SQLite fallback.
- Python is a private, stateless research worker. It does bounded public-site fetching and deterministic evaluation. It stores no customer database. The optional Jev adapter remains explicit opt-in and requires separate provider verification.
- Stripe-hosted Checkout and Customer Portal handle payment entry. Only verified webhook processing and a freshly retrieved Stripe subscription can establish commercial entitlement. A redirect, session URL, browser claim, or Clerk billing claim cannot grant access.
- `local-demo` retains the previous single-workspace SQLite workflow and preview container. It is deliberately separate from `saas` and unsuitable for customer isolation.

## Configuration ownership

Configure each environment independently. Use the hosting platform's secure settings; never paste secrets into chat, commit them, or put them in `NEXT_PUBLIC_*` variables. The source examples contain empty values only. Generating credentials or granting persistent provider access requires the account owner's explicit action/approval.

### Frontend (build and runtime)

| Variable | Purpose |
|---|---|
| `SIGNALFOUNDRY_MODE=saas` | Explicit server mode |
| `NEXT_PUBLIC_SIGNALFOUNDRY_MODE=saas` | Matching browser build mode |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key; intentionally public |
| `CLERK_SECRET_KEY` | Server-only Clerk key |
| `CLERK_JWT_TEMPLATE=convex` | Clerk token template used by the server adapter |
| `CONVEX_URL` | Exact `https://<deployment>.convex.cloud` backend URL |
| `APP_URL` | Exact canonical application origin, HTTPS in production |

The separate SaaS web image is `deploy/saas.Dockerfile`; build with the approved public Clerk key and APP_URL as build arguments, and provide server secrets only at runtime. `/readyz` checks configuration only, without authenticating or contacting providers.

Rebuild after changing public build variables. Never reuse a local-demo image for SaaS by changing only runtime environment variables.

### Clerk account configuration (not performed)

1. Select the intended Clerk application and separate test/live instances.
2. Enable Organizations and require an active organization. Supported roles are `org:admin` and `org:member`; unknown/custom roles are rejected until explicitly mapped in code.
3. Enable the Convex integration/token template with audience `convex`. Ensure the signed token contains the active organization's ID and role. The backend accepts Clerk's compact v2 `o.id`/`o.rol` or signed `org_id`/`org_role`; conflicting representations are rejected.
4. Set the actual Clerk issuer domain in Convex. Configure allowed origins, redirect URLs, sign-in methods, recovery, verification, and MFA according to the organization's security policy.
5. Test two users in two organizations, invitation/removal, expired sessions, role changes, sign-out, and organization switching. Membership revocation takes effect as provider tokens expire/refresh; verify the chosen token lifetime meets your requirements.

Clerk's stock sign-in UI provides recovery. `/recover` routes users there; the app does not implement or store password/reset tokens.

### Convex deployment configuration (not performed)

Run the Convex CLI only after selecting an authorized development deployment. This repository includes schema-derived bootstrap `_generated` files so local typechecks/tests do not require cloud provisioning. Regenerate them with official codegen against the selected deployment, review the diff, and typecheck before publishing functions.

| Variable | Purpose |
|---|---|
| `CLERK_JWT_ISSUER_DOMAIN` | Actual Clerk issuer URL; no fallback |
| `SIGNALFOUNDRY_WORKER_URL` | Exact worker HTTPS origin reachable from Convex |
| `SIGNALFOUNDRY_WORKER_TOKEN` | Worker authentication secret, server-side only |
| `STRIPE_SECRET_KEY` | Stripe server key for the same intended environment |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for this environment's webhook endpoint |
| `STRIPE_PRICE_ID` | Approved recurring price; not created or chosen by code |
| `STRIPE_PORTAL_CONFIGURATION_ID` | Dedicated optional Portal configuration; set it on shared Stripe accounts to avoid another app's default |
| `SIGNALFOUNDRY_MONTHLY_RESEARCH_LIMIT` | Approved positive integer job quota |
| `SIGNALFOUNDRY_DOMAINS_PER_CAMPAIGN_LIMIT` | Approved integer 1–10 |
| `APP_URL` | Exact HTTPS application origin for Stripe return URLs |

Without a complete commercial policy, paid research is disabled. Only an `active`, unexpired subscription on the configured price qualifies. Trials, past-due, canceled, unsupported multi-item subscriptions, and unknown prices fail closed. Quotas count accepted manual research starts per UTC calendar month, not Stripe billing cycle; retries do not double-charge the quota and failure/cancellation does not refund it. This policy must be approved before launch or changed with tests to match the offered plan.

### Worker

See [worker setup](../deploy/worker.README.md). Set the same server-only authentication secret in Convex and the worker. Permit requests only through HTTPS and restrict ingress/egress at the infrastructure boundary. Do not publish the legacy FastAPI `/api` demo server as the SaaS backend. Configure CPU/memory/concurrency and monitor readiness. The provided worker image is separate from the preview image.

### Stripe account configuration (not performed)

1. Choose the intended account/environment, product, recurring price, currency, taxes, refund/cancellation policy and limits. There is no built-in price or invented free trial.
2. Configure a Customer Portal for that account.
3. Register `https://<deployment>.convex.site/stripe/webhook` and supply its signing secret to that same Convex deployment. Subscribe to `customer.subscription.created`, `.updated`, `.deleted`, `checkout.session.completed`, and `checkout.session.async_payment_succeeded`.
4. Use Stripe test mode to verify Checkout, abandoned Checkout, failed payment, renewal, cancellation, duplicate/reordered deliveries and retries after a provider outage. Inspect Stripe's delivery logs and the Convex billing projection.
5. Only then configure the independently approved live credentials and run a controlled live acceptance check.

The handler verifies the raw request signature with timestamp tolerance and bounds the body. It looks up the stored customer binding and checks server-set organization metadata on the retrieved subscription. Unknown/unbound customers cannot create an entitlement. Event IDs deduplicate updates; older event timestamps cannot restore stale access.

## Environment separation and migration

Do not import the old `local-demo` workspace into all organizations. Any import must be an explicit, reviewed tenant-specific migration with a backup and dry-run. There is no automatic SQLite-to-Convex migration, destructive reset, or application of live schema changes here. New Convex tables can be deployed to an empty approved environment; future changes to populated fields must use expand/backfill/contract migrations.

## Official references checked during implementation

- [Convex + Clerk](https://docs.convex.dev/auth/clerk)
- [Clerk session token claims](https://clerk.com/docs/guides/sessions/session-tokens)
- [Stripe webhook verification](https://docs.stripe.com/webhooks)
- [Stripe subscription events](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Stripe Checkout session API](https://docs.stripe.com/api/checkout/sessions/create)
