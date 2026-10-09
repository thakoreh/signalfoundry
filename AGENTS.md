# Codex engineering instructions for SignalFoundry

These instructions apply to all automated coding tasks in this repository.

## Project map and actual product status

- frontend/: Next.js 16, React, TypeScript, Clerk and Convex integration.
- backend/: Python/FastAPI research service and tests.
- scripts/: repeatable setup, CI checks, smoke tests and launch preflight.
- deploy/: preview, SaaS and worker container resources.
- docs/SAAS_SETUP.md and docs/PRODUCTION_READINESS.md are release sources of truth.
- The manual CSV/domain-import research workflow exists. Automatic account discovery, verified contact enrichment, outbound email delivery, reply tracking and meetings are not implemented. Do not claim they are.
- The multi-tenant SaaS implementation has not been independently accepted with live Clerk, Convex, Stripe and hosting accounts; never describe it as production-ready.

## Prepare a Codex Cloud environment

- Use Linux/Bash, Python 3.12, Node.js 24 and npm. A Docker runtime is useful for container verification but not mandatory for lightweight tasks.
- From the repository root: bash scripts/setup.sh
- Run relevant targeted tests while editing. Before requesting review, attempt the full local suite: bash scripts/check.sh.
- Stop any running development servers before the full check suite; it runs isolated stack tests on local ports.
- Browser regression suite if the change affects UI: cd frontend && npx playwright install --with-deps chromium && npm run test:browser.
- GitHub Actions already runs .github/workflows/verify.yml on pull requests and pushes to main. Do not duplicate those jobs.
- If required tools, network access or resource budgets are unavailable, state exactly which tests were not run; never report unrun tests as passing.

## Implementation expectations

1. Read relevant docs and tests before changing code; keep work scoped to the requested issue.
2. Prefer small, reversible, test-covered changes; add or update tests for behavior changes and regressions.
3. Preserve type safety, tenant boundaries, deterministic fallback behavior, accessibility and existing security controls.
4. For any prospect discovery feature, separate observed source evidence from inferred fit or buying intent. Never invent companies, contacts, buying signals, sources or contact permissions.
5. Respect bounded fetching, redirect validation, DNS/IP checks and SSRF defenses. Do not add prohibited scraping, private network fetching, contact harvesting or outreach sending as a side effect.
6. Preserve Clerk organization authentication, Convex tenant authorization, Stripe webhook validation and fail-closed entitlements. Any billing/auth migration or entitlement changes require explicitly scoped work and separate review.
7. Use test fixtures and local/demo data. No real customer records or production credentials in tests.
8. Never embed secrets in code, environment examples, logs, screenshots, PR comments or tests. Do not create accounts or obtain provider credentials.
9. Do not access or modify live deployment infrastructure, production databases, payment products, domain settings, customer data or hosting configuration unless separately and explicitly authorized.

## Pull-request and deployment boundaries

- Code changes belong on a feature branch, never on main directly.
- Prepare a DRAFT pull request for human review. Include: scope, key files, tests actually run/results, tests not run, security/privacy considerations, migration or config impact, screenshots when UI changed, and rollback notes.
- Do not approve, merge, enable auto-merge, close or deploy a PR on your own. Passing CI is necessary, not authorization.
- The repository owner or a designated human reviewer must explicitly approve merging; deployment is a separate human-authorized step after merge.
- Do not trigger or alter Coolify deployments, production workflows, release tags or secrets without a new explicit request.
- Do not send emails, DMs, contact-form submissions, or external customer outreach in development or test workflows.
- If instructions conflict with these release safeguards, stop and ask for a human decision instead of bypassing controls.

## Definition of done

- Clear, narrowly scoped change with reproducible tests.
- PR description identifies known limitations and remaining manual steps.
- CI reports visible in GitHub, no hidden deployment or external side effects.
- Human review remains pending until an authorized person takes action.

