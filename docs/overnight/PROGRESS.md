# Release candidate progress — S1

Verdict: incomplete; no release-candidate acceptance claimed.

## Execution checkpoint
Owner-authorized narrow worker exception is effective in this run. Read OWNER_GOAL.md and CONTROL.md completely, worker SOUL, and all six required repository brief/requirement/outreach documents. No owner data/env/profile was copied or inspected. Source inspection confirms stale PR5/independent-approval wording in the brief and design requirements; correction is pending.

Command: `git fetch origin && git status --short --branch && git worktree list && git rev-parse HEAD origin/main` succeeded. Working tree initially clean, branch `codex/clientrove-release-candidate`; HEAD and origin/main both `cfd22af0e693a4854e3e2c46e034ccf5a39127f3`. Other worktrees left untouched. No app/test/browser execution or provider calls yet.

## Milestone 1 — baseline and draft PR

Installed only inspected existing lockfiles with `bash scripts/setup.sh` (success; log in control directory s1-setup.log). Live runtime: Node v24.13.0, npm 8.19.2, Python 3.11.14, uv 0.9.28. No owner configuration copied. Listener check showed no app on 3000/3001/8000; preserve unrelated Chrome 9222/gateway/dashboard listeners. Isolated app ports still not started.

Backend baseline: from backend, `../.venv/bin/python -m unittest discover -s tests -v` exited 0 (s1-baseline-backend.log). Initial root invocation was invalid (ModuleNotFoundError app), corrected cwd; not a product failure. Frontend `npm run typecheck` and `npm run test:landing -- --run landing-tests/outreach-workspace.test.tsx` exited 0 (s1-baseline-component.log). Existing Starlette httpx deprecation warning noted, no dependency changes to hide it.

Docs checkpoint `464e2ae412538c9387bcf96d9caa831c79b505c5` pushed and exact remote ref verified. DRAFT PR https://github.com/thakoreh/signalfoundry/pull/7 read back with isDraft=true and base main. A closed earlier PR6 referenced a now-absent remote branch, left untouched; new PR7 is this run's target. Full source-backed requirement map is CHECKLIST.md, owner journey additions copied into product requirements; stale brief/design branch and approving-review wording corrected.

## Superseded sender experiment (NOT working completion)

Bounded seam planned: sender/contact-basis approval safety plus actual manual-send snapshot honesty. Read frontend/AGENTS.md and installed Next use-client docs. No Convex edits. RED: `../.venv/bin/python -m unittest tests.test_outreach.OutreachTest.test_approval_requires_saved_sender_identity_and_address -v` failed as expected (OutreachError not raised). Minimal uncommitted backend fields + sender rejection now make that focused test pass (s1-sender-green.log). Existing outreach suite has regressions because its profiles lack sender fields; s1-sender-regressions.log. This is unfinished: do NOT commit/push these code changes as a working feature, request review, or accept stage yet. Need enrich legitimate fixtures, build usable local-only sender profile controls, include hashed footer and recipient contact-basis/region admission, stale identity approval invalidation, then actual-send snapshots. Current approval check alone is not sufficient and has no UI recovery yet.

## Milestone 2 — working reported changed-send slice

The incomplete sender experiment above was removed, not released. Sender/footer/contact-basis/US-Canada admission remains P0 and next priority. No original tracked regression was deleted or weakened. Instead a bounded working snapshot seam is now implemented: separate actual and approved subject/body, immutable approval hash, reported-only provenance and Conversations disclosure. Backend HTTP RED was 422 for unsupported changed-send fields; component RED was missing Sent with changes button. After implementation all 15 outreach tests and 9 outreach component tests passed; frontend typecheck/lint passed. Full backend `../.venv/bin/python -m unittest discover -s tests -v` exited 0 (s1-backend-full.log).

Fresh installed Chrome verification `node <control-dir>/s1_browser.mjs` exited 0 after fixing an exact-label locator (textarea label included contents). Real loopback fixture API/database, no mocked transport, no paid providers; external browser URLs blocked. Desktop1440/390/320 screenshots in control dir: s1-changed-send-{width}.png and s1-snapshot-history-320.png. Exercised approval, actual text reporting, separate historical approval, reload persistence and no horizontal page overflow. This is not the complete journey, integration, physical keyboard, screen-reader, 200% zoom or full unhappy-path proof. Setup/off-switch/rollback limitations are in S1_SETUP.md. Owned dev session proc_d38e5c500c48 uses ports3001/8017 and explicit s1-fixture.sqlite3. Do not mistake this fixture for owner data.

Next: checkpoint exact code, run exact-commit build and full required checks safely (do not collide with dev assets/processes), add sender/legal seam with TDD and usable profile UI, extend unhappy-path coverage, update PR review guide and request independent review. No stage acceptance yet. Research RESEARCH.md/SEAM_PLAN.md received; US legal freshness remains qualified. All remaining local journey gaps in CHECKLIST remain open; cost/hosted work must not displace them.
