# Production launch gates

Status: **release-candidate implementation; launch blocked pending configuration and independent environment verification**. Local tests and mocks cannot prove Clerk, Convex, Stripe, live worker networking, or container operations in your account.

## Implemented for review

- Explicit SaaS vs local-demo modes, fail-closed configuration, Clerk session/org authentication boundary
- Convex tenant-scoped indexed data model and authorization wrappers; admin/member restrictions
- Durable bounded research jobs with retry, idempotency, cancellation and quota accounting
- Stateless authenticated worker, bounded SSRF-resistant fetches and sanitized errors
- Server-side Stripe Checkout/Portal, signature-checked webhook processing, deduplicated subscription projection and fail-closed commercial entitlements
- Reproducible local checks and CI definition; separate worker deployment specification

These are code capabilities, not claims that cloud accounts are configured or the release is operationally ready.

## Must pass before customer access

- [ ] Review and approve the code/PR; required CI passes on the exact release commit
- [ ] Build and run both container images on the target architecture; verify non-root filesystem, readiness, restarts, grace periods, limits, and no exposed demo API
- [ ] Select/configure Clerk, Convex, Stripe test and live projects separately; official codegen and approved Convex deployment pass
- [ ] Complete actual two-user/two-organization browser acceptance: login/recovery/logout, switch org while requests are in flight, member vs admin, removed member, expired JWT, ID substitution on every entity/API
- [ ] Test real Convex scheduler behavior across worker timeouts, duplicated requests, worker restart, cancellation races and quota exhaustion
- [ ] Approve Stripe price, currency, commercial limits, tax, cancellation/refund policy; finish test-mode billing and webhook replay/out-of-order tests
- [ ] Resolve the original GitGuardian incident using its exact filename/line and incident evidence; no current-code cleanup can prove the historical alert is false or rotate a secret
- [ ] Configure TLS, network isolation, allowed host/origin, secrets management, rotation, provider budgets and abuse controls
- [ ] Connect metrics/log alerts; verify worker-not-ready, job failure/backlog, billing webhook failure, high auth errors and resource usage alerts reach an owner
- [ ] Rehearse backup/export and isolated restore; record recovery point/time objectives and authorized rollback plan
- [ ] Approve privacy notice, product terms, data retention/deletion, business/site research policy, legal company identity and support contact
- [ ] Decide whether licensed discovery/contact verification is needed. It remains unconfigured; no real contact verification is claimed
- [ ] Finish accessibility, responsive UI and target-browser acceptance with the real auth widgets

## Product honesty

Demo accounts/evidence remain explicitly fictional. Public website observations are not verified buying events. Manual research accepts supplied public company domains only. Contact discovery, email verification, automatic sending and commercial lead-data licensing are not supplied. Drafts are human-reviewed suggestions and are never sent.

See [setup](SAAS_SETUP.md), [operations](OPERATIONS.md), and [verification evidence](VERIFICATION.md).
