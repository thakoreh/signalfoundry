# Architecture and boundaries

## Explicit modes

`saas` and `local-demo` are separate build/runtime modes. Both mode variables must agree with the compiled app. Missing or mismatched configuration fails closed. A running preview is not a multi-user SaaS environment.

### SaaS request flow

Browser → same-origin Next REST adapter → authenticated Convex queries/mutations/actions. Clerk owns identity and organization membership. Next verifies its session and checks an intent-only organization header against that session; the template JWT must match the same subject and organization. Convex independently verifies signature/issuer/audience and derives tenant identity only from signed claims.

Convex stores workspaces, campaigns, accounts, research jobs, usage counters, and a minimal billing projection. Public functions use shared tenant/admin wrappers. Entity IDs are checked against the verified tenant; private scheduler, research-save, and billing functions remain internal. Indexed bounded reads prevent accidental full-table scans.

Convex durable actions call the separate stateless Python worker over authenticated HTTPS. The worker never opens the demo database. It receives a bounded profile/campaign payload, researches supplied public company domains, and returns structured evidence. The worker pins validated DNS destinations and checks every redirect; explicit cloud-platform address exclusions supplement non-global IP rejection. Deployment egress policy is still required.

### Local-demo request flow

Next uses an explicit local-only API rewrite to FastAPI, which injects a fixed workspace and stores data in SQLite. This mode has no multi-user authentication. The existing protected/public preview configuration continues to describe this mode only.

## Durable research and persistence

Convex job creation, quota reservation and scheduler enqueue happen transactionally. Per-organization idempotency keys prevent repeated submissions from consuming quota twice. A maximum of two research jobs run globally, matching the default two-request worker capacity. Five total attempts use 15/30/60/120-second retry delays and 150-second leases; watchdogs recover dispatch/completion loss. Four domain lanes per worker request share an eight-slot bounded DNS pool.

Cancellation prevents future attempts and discards late results; a request already in flight cannot be retracted. Running cancelled jobs keep their slot until completion or lease expiry. Partial reruns preserve previous failed-domain records, timestamps, stable identities and review decisions. Profile changes do not retroactively change earlier evidence or scores.

Manual research needs a verified active matching unexpired subscription and configured commercial limits at both admission and dispatch. UTC calendar-month quota counts accepted distinct starts; failure/cancellation does not refund it. Retry attempts do not increment quota again. Operational safety caps are separate from commercial entitlements.

## Billing trust boundary

Admin-only actions select the server-configured Stripe price and return origin. They reuse deterministic Checkout operations and Stripe idempotency keys, query the customer's current subscriptions before creation, inspect prior Checkout state, and throttle every action attempt including cached retries.

The webhook accepts bounded raw bytes and verifies Stripe's signature/time tolerance before processing. The action retrieves authoritative subscription state and verifies its stored customer/organization binding. Internal mutations deduplicate event IDs, reject older event timestamps and prevent same-second stale snapshots from restoring access. No browser redirect or client-set claim establishes paid entitlement. Payment details are collected by Stripe-hosted pages.

## Evidence and product honesty

Research supplies URLs, extracted text and retrieval times. Rules evaluate evidence against an editable profile. Drafts use stored observations without inventing a relationship, purchase intent, email address, or verification result. They are never sent automatically.

Fictional demos use reserved `.example` domains and explicit flags; they are never fallback results for a failed real request. Unknown facts remain unknown. Website observations are not certified buying signals.

## Provider seams and limitations

- Discovery: fictional fixtures or user-supplied public company domains
- Decisions: explainable rules; optional server-side Jev adapter requires independent live verification
- Contact verification/licensed commercial lead data: unconfigured
- Writing: grounded templates for human review, with no sending capability
- Recovery, operational monitoring, legal/privacy policy and live provider acceptance: release gates in [production readiness](PRODUCTION_READINESS.md)

See [SaaS setup](SAAS_SETUP.md), [operations](OPERATIONS.md), and the authoritative validators/functions for implementation detail. No configured or verified integration should be inferred from a provider adapter alone.
