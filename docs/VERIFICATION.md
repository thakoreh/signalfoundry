# Verification record

Date: 2026-10-01 UTC. Scope: `harden/clerk-convex-stripe`, based on remote main `5dac4f2adc0ee6ba81e643074d3f2095018e45f7`. This record replaces the earlier local-MVP verification narrative; it must not be read as live SaaS certification.

## Passed locally on Linux

- 72 backend Python tests: original demo/API behavior plus stateless worker auth/readiness, no database imports, token redaction, concurrency, DNS/body deadlines, pinned DNS, redirects, cloud-platform IP rejection, CSV safety and mocked Jev contracts
- 28 frontend Node tests: existing UI utilities, strict runtime/build modes, host/origin controls, closed REST mappings, admin/tenant guards, token/session and organization-intent binding, billing expiry display, and preservation of request headers
- 47 Convex tests using `convex-test`: anonymous/cross-org access, roles, input bounds, durable job transitions, cancellation/lease recovery, idempotency, quota/configuration gates, occupied worker retry, partial rerun preservation; Stripe raw-signature validation, duplicate/reordered events, subscription binding, Checkout retry parameters, duplicate-subscription prevention, resubscription and attempt throttling
- Full frontend TypeScript check and ESLint, with zero errors or warnings
- Production Next build in local-demo mode; existing full-stack API workflow through Next with a disposable SQLite database
- Real rewrite integration, including a response exceeding 31 seconds and hostile host/proxy-header rejection
- Standalone preview regression: exact HTTPS-origin emulation, profile/demo/research/export and six hostile-header cases. This does **not** run NGINX or TLS
- Production Next build in SaaS mode with no provider credentials; real local HTTP checks prove setup-state rendering, readiness 503, API 503, and no fallback to the demo backend
- Worker process HTTP smoke in an isolated subprocess, both missing-token and runtime-generated-token modes, using fictional data only
- Five offline source/security gates and existing packaging/deployment/launcher tests
- npm production dependency audit: zero reported vulnerabilities at the time checked
- pip-audit 2.9.0 against all 16 pinned Python runtime dependencies: zero known vulnerabilities reported at the time checked
- Gitleaks 8.28.0: zero findings in all five inherited commits and current source at the time checked. Binary checksum verified against the official release

No live secrets are used in tests. Contract mocks and fixture identities are not proof of an actual provider integration.

## Independent review corrections

Fixed and regression-tested: partial research losing prior evidence/review statuses, same-second stale Stripe snapshots restoring access, unstable idempotent Checkout parameters, duplicate subscriptions through stale local billing state, completed-session resubscription, repeated cached billing calls bypassing throttles, organization-switch request intent, cloud-platform address SSRF, DNS/worker capacity mismatch, and prematurely exhausted busy-worker retry windows.

An independent recheck found no remaining blocking issue in those corrected areas. That statement is scoped to the code and tests reviewed, not an external penetration test or broad security guarantee.

## Never run or still blocked

- Official Convex codegen/push and tests against a real Convex deployment. Checked-in generated files are transparently labeled local type bootstraps
- Real Clerk sign-in/recovery/invitation/removal/MFA/session-expiry flows and two-organization browser acceptance
- Stripe test-mode or live Checkout/Portal/payment lifecycle, registered webhook delivery, customer cancellation/renewal and tax behavior
- Actual Convex-to-worker HTTPS, distributed scheduler/restart behavior and provider failure injection in the target environment
- Docker image build/runtime: Docker is absent here. CI defines image builds and worker smoke, but CI has not run for this unpublished branch
- Interactive browser QA: the cloud browser rejected the local URL with `ERR_BLOCKED_BY_CLIENT`; HTTP rendering checks are not a substitute
- Target NGINX/TLS/firewall/proxy configuration, load testing, security assessment, monitoring/alerts, encrypted backup/restore rehearsal
- Original GitGuardian incident resolution. Gitleaks passing and dynamic test fixtures cannot determine what GitGuardian detected or rotate a real exposed credential
- Licensed lead/contact data, verification, outbound email, commercial policy/legal/privacy approval

## Reproduce

Run `bash scripts/setup.sh`, then `bash scripts/check.sh`. Separately run:

- `python scripts/production_preflight.py`
- `.venv/bin/python scripts/production_worker_checks.py`
- `python scripts/test_saas_failclosed.py` (replaces the local `.next` output with a SaaS build)
- `cd frontend && npm audit --omit=dev --audit-level=moderate`
- `GITLEAKS_BIN=/path/to/gitleaks bash scripts/scan_secrets.sh`

With Docker available, build the image tags expected by `.github/workflows/verify.yml` and run `python scripts/production_container_smoke.py`. Its absence is a failure/not-run result, never a skipped pass.

Before release, run all required CI and live acceptance gates against the exact reviewed release commit. See [launch checklist](PRODUCTION_READINESS.md).
