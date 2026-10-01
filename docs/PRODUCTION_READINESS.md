# Production readiness

This project demonstrates a usable research workflow. It is not ready to accept paying customers or untrusted multi-user traffic.

## Before any hosted beta

- Add real authentication and server-derived tenant identity; never accept tenant identifiers as proof of authorization
- Replace the shared local workspace with isolated tenant/user data and test cross-tenant access at every resource boundary
- Add CSRF protections, session security, rate limits, usage quotas and abuse controls appropriate to the chosen hosting topology
- Put research in a durable worker queue with per-tenant limits, cancellation, retries, idempotency and progress events
- Run crawlers in isolated, egress-controlled workers with an outbound allow/deny policy, DNS-rebinding protection, strict redirect handling and observability
- Migrate SQLite to PostgreSQL through explicit migrations; configure backups, restore exercises and retention/deletion policies
- Add a tested provider for real candidate discovery; obey its license, privacy obligations and request limits
- Add real contact enrichment and email verification only under an authorized vendor contract; retain provenance and verification timestamps
- Treat sourced text as untrusted. Protect decision/generation adapters against prompt injection, require supported facts and validate outputs
- Validate targeting judgments against labeled examples; calibrate thresholds rather than treating model confidence as truth
- Add audit logs, provider health metrics and cost ceilings, without storing sensitive data or secrets in logs
- Complete dependency/security review, accessibility testing, legal/privacy review and operational incident preparation

## Before outbound automation or revenue

- User-reviewed sending authorization, connected mailbox scopes, unsubscribe/suppression rules and jurisdiction-specific compliance
- Delivery reputation controls and explicit limits; the MVP sends no email
- Billing provider, metering, plan entitlements, cancellation/refund terms and auditability
- Domain/name availability and trademark clearance; “SignalFoundry” is a working title only

## Intentional limits

- One local workspace and no identity verification
- Single-page public website extraction rather than complete web search or deep crawling
- No purchased lead database, CRM sync, contact verification or mailbox integration
- Static evidence-grounded draft templates instead of an enabled generative provider
- Synchronous, bounded small-batch research rather than production job orchestration
- Demo signals are fictional. Real pages produce evidence at retrieval time; unknown publication dates stay null
