# Verification record

Verified September 30, 2026. This record distinguishes executable checks from unverified integrations.

## Passed

- Clean virtual-environment installation from the pinned dependency lock and all 45 backend tests
- 45 deterministic backend tests: complete API workflow, input validation, atomic persistence, tenant-scoped access, account rerun/status preservation, SSRF and redirect defenses, overall deadlines, response-size limits, Jev response validation and explicit fallbacks
- 8 live-HTTP smoke checks: health/mode, demo profile, persisted ranked accounts, shortlist round trip, evidence-grounded draft, CSV row count, rejected unsafe/invalid input, profile preservation
- 3 real Next.js proxy integration checks: trusted local hosts pass, hostile/lookalike hosts cannot read the local API, and a 31.26-second upstream response completes successfully
- Packaging privacy regression: runtime database directories, database sidecars, local environment files, dependencies and build outputs excluded from source archive
- Shell script syntax checks

- Frontend: TypeScript typecheck, ESLint, all 11 unit/regression tests, and optimized Next.js production build
- Full production-stack HTTP check: rendered frontend page plus all 8 smoke checks through Next.js into FastAPI against an isolated temporary database
- Development launcher: two tests for allowed ports and safe process-group cleanup
- Independent code/security review: reported Host-boundary, deadline, signal-count, async-state and archive-privacy findings corrected and rechecked; no remaining blocking findings in reviewed code

## Integration limits

- Execution was tested on Linux. README recommends WSL 2 Ubuntu for Windows shell compatibility, but WSL 2, native Windows and macOS were not separately tested; no Docker setup is included

- Jev was checked against its official contract and tested using mocked responses. No live credential, paid request, provider account or real Jev success is claimed
- Public website transport was exercised with deterministic network/socket tests. Unrestricted live-web research was not verified from this restricted execution environment
- External candidate-discovery and contact-verification providers are intentionally not configured
- No email was sent; no signup, billing, public deployment or repository push was performed

## Browser verification limit

The managed cloud browser rejected local preview navigation to `http://localhost:3000` with `net::ERR_BLOCKED_BY_CLIENT`. No browser restriction was bypassed. Browser interaction, visual appearance, responsive behavior and screenshots must not be reported as verified from this attempt.

## How to reproduce

Run `./scripts/setup.sh`, then `./scripts/check.sh`. Stop existing development servers first; production integration checks use local ports 8000 and 3001. For local manual acceptance, start `./scripts/dev.sh` and follow `docs/DEMO_WALKTHROUGH.md`.

In a supported browser, additionally check: editing and reopening the ICP; repeated selection of the active campaign; creating/rerunning a demo campaign; search/filter/sort; zero-signal accounts; account drawer close/reopen during status updates; draft generation/copy; CSV export; loading/error states; keyboard escape/tab focus; and narrow viewports. Company size and geography are planning fields only and do not affect MVP scoring.
