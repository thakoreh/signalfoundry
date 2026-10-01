# Operations and recovery runbook

This is a runbook to rehearse before launch. It is not evidence that any infrastructure was configured.

## Service inventory

- Next.js: customer-facing gateway, Clerk sessions and bounded REST mapping to Convex
- Convex: tenant system of record, durable scheduler, counters and billing projection
- Research worker: private stateless Python process; `/healthz` liveness and `/readyz` readiness
- Clerk and Stripe: external identity and billing authorities

The existing combined `Dockerfile` remains **local-demo/preview only**. It must not be relabeled the SaaS application. The worker uses `deploy/worker.Dockerfile`. Deploy the SaaS Next app separately with `deploy/saas.Dockerfile` and the approved build/runtime settings. Its public `/readyz` is a non-sensitive configuration probe only; it does not assert successful provider access.

## Health, monitoring and privacy

Record request IDs, status codes, latency, retry/attempt counts and stable failure categories. Never log authorization headers, API keys, raw webhooks, payment details, complete fetched pages, or customer profile bodies. Worker logs are deliberately bounded and redacted. Convex logs and provider dashboards still require access controls and retention policy.

Alert on sustained readiness failure, failed/retrying jobs, stuck running jobs past their lease, saturated concurrency, quota/rate-limit spikes, Stripe delivery failures, authentication errors and elevated Next 5xx. Set an on-call owner and escalation window. Application health responses are configuration checks; a healthy process is not proof all providers work.

## Research incidents

1. Identify the affected job and organization using authenticated admin tooling; do not copy personal payloads into tickets.
2. Check worker readiness, networking, concurrency, timeouts and Convex scheduled-function status.
3. Retry with the original job idempotency key after a transient failure only if the existing job is still active. Starting a new terminal job is a new quota-consuming operation.
4. Cancellation stops acceptance of results and future scheduled attempts; it cannot retract a public HTTP request already in flight.
5. Compare retained account results. Do not delete prior evidence to hide failures.

Safety ceilings are operational protections, not marketed commercial promises. The selected monthly research quota is an approved business setting. Accepted starts count even when failed/cancelled; inform customers consistently.

## Billing incidents

A browser return from Checkout is never evidence of payment or access. Check the signed webhook delivery, matching Stripe account/environment, stored customer binding, subscription metadata, approved price, and current status/period. Re-deliver the original event from Stripe after resolving configuration/network issues. Event deduplication prevents repeated state changes. Do not manually edit an organization's entitlement based on a support message.

Billing API actions permit at most 10 attempts per organization per minute, including cached/idempotent retries, plus a separate new-operation hourly limit.

Older event timestamps are ignored. A non-entitled snapshot wins against an entitled snapshot from the same second; if a legitimate same-second reactivation remains blocked, use a newly generated authoritative Stripe event after verifying the account. Never force a paid status in the browser or bypass webhook verification.

## Backup and restore rehearsal

1. Agree on recovery-point and recovery-time objectives before customer launch.
2. Configure the chosen Convex plan's available backup/export mechanism. Export with the official CLI to an encrypted, access-restricted destination; verify actual completion and retention.
3. Export application source/release identifier and nonsecret configuration inventory separately. Store secrets only in the authorized secrets manager.
4. Restore a complete snapshot into an **isolated approved staging deployment**, preserving document IDs and relations. Never test destructive imports against production.
5. Regenerate types, run schema/invariant checks, verify organization isolation and account/job links, and test billing in test mode. Production customer/subscription identifiers must not be sent to a different Stripe environment.
6. Record time, result, row/count checks and recovery gaps. Delete temporary exports under the approved retention policy.

The stateless worker needs no database backup. The legacy demo SQLite file is unrelated to SaaS backups; back it up separately only if its owner needs it.

## Release and rollback

Run the full checks for the exact commit, then approved staging acceptance. Publish frontend and compatible Convex functions in a backwards-compatible order. New required fields on populated Convex tables require an expand/backfill/contract migration; do not deploy incompatible schema and old frontend combinations.

Keep the prior release and a tested rollback plan. Rolling back frontend code does not undo database writes or Stripe events. Do not auto-restore an old database snapshot over newer payments/customer activity. Pause customer mutations first if necessary using an approved maintenance procedure, then reconcile provider state before reopening.

## Credentials and historical alert

The GitGuardian alert on original commit `88c895f` remains unresolved until its exact occurrence is inspected. Dynamic test fixtures reduce new scanner noise but do not prove the old alert harmless. If a real credential is found, the account owner must revoke/rotate it at the issuing service and verify dependent workloads; deleting a string from a new commit is not remediation.

## Data lifecycle gate

Define retention periods and a verified organization deletion/export process before launch. The current release does not claim a completed privacy deletion/export integration across Clerk, Convex, Stripe, backups and providers. Do not advertise compliance certifications or unlimited retention.
