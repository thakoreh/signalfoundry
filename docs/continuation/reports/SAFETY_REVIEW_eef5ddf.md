# Deadline safety review — eef5ddf

## Verdict
**REWORK required for the eef5ddf seam.** Three P1 findings are recorded in `findings.jsonl`. The commit is a useful early backend seam, but it is not an accepted Next-up/company-safety checkpoint: the queue is not reachable from the returning UI, completed reply work remains queued, and same-company cold ownership is not enforced before approval.

## Scope
- Reviewed exactly `eef5ddf0f7ab7df27385d6e8cf6b60e0f3a0c367`, parent `e429af4`, against `origin/main` `cfd22af0e693a4854e3e2c46e034ccf5a39127f3`.
- Review tree: `<LOCAL_HOME>/microsaas-projects/signalfoundry-rc-review` (detached at pinned SHA; generated `frontend/next-env.d.ts` drift preserved).
- No product source files changed.

## Findings
1. **P1 `eef-next-up-not-wired`** — `GET /api/outreach/next-up` exists, but no frontend caller or returning-workspace queue exists. Browser evidence: `http://127.0.0.1:3002/workspace` rendered the business onboarding screen, `document.body.innerText` had `NEXT_UP_NOT_VISIBLE`, and performance entries contained only `/api/workspace`; the endpoint itself returned 200 when probed. Screenshot: `<LOCAL_HOME>/.config/browser-harness/tmp/shot.png`.
2. **P1 `eef-next-up-stale-after-answer`** — fresh SQLite reproduction recorded an inbound `interested` reply, saved/approved/sent a human answer, then `outreach_next_up()` still returned the same thread with `action=answer_reply`. `next_up()` only checks for any inbound and the reply state; it does not check for a later outbound answer or a durable completion state.
3. **P1 `eef-company-single-active-missing`** — fresh SQLite reproduction created two searches/accounts for the same canonical `business.com`; both threads were independently approved and returned `paused=False`, `suppressed=False`, `ready_for_manual_action=True`. `start()` only enforces `(tenant, search, account)` uniqueness; approval has no same-company ownership check. Sibling pause runs only after inbound/meeting.

## Actual checks
- Backend focused: `PYTHONPATH=. python -m pytest tests/test_outreach.py -q` → **27 passed, 7 subtests passed**.
- Backend full: `PYTHONPATH=. python -m unittest discover -s tests -q` → **163 tests OK**.
- Frontend focused: `npm run test:landing -- outreach-workspace.test.tsx` → **43 passed**.
- Frontend landing suite: `npm run test:landing` → **17 files, 95 tests passed**.
- Frontend typecheck: `npm run typecheck` → **passed**.
- Frontend `format:check` → **failed** on 13 files, including `components/outreach-workspace.tsx` and `lib/outreach.ts`; no formatting changes made during review.
- Local browser: fresh backend DB, providers off, backend `8018`, frontend `3002`; both servers and review browser target stopped afterward.

## CI/dependency truth
- PR #7 is still draft; current PR head has advanced to `320edf317cd8d53924fba71c977227fe674089ec`, so its in-progress CI is **not a verdict on pinned eef5ddf**.
- Current PR checks: `source-checks` **IN_PROGRESS**, `container-checks` **IN_PROGRESS**, GitGuardian **SUCCESS**; merge state **BLOCKED**.
- `origin/main` is an ancestor of pinned eef5ddf. The lockfile certifi change is present: `2026.7.22` → `2026.10.19` in `e429af4`.
- Independent `pip-audit` could not run in the installed environment: `No module named pip_audit`; no install or waiver was attempted.

## Unimplemented requirements observed, separate from the three defects
Dated not-now/OOO snoozes and timezone validation, referral contact creation with fresh evidence, bounded max-two followups and due dates, timed meeting reports/confirmation, funnel/next-batch projections, and the original auth/tenant/cost/privacy/provider prerequisites remain outside this early seam. They are reported as unfinished scope, not treated as reasons to invent functionality or claim completion.
