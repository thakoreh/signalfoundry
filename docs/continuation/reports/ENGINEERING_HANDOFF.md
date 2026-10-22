# SignalFoundry deadline engineering handoff

**Verdict:** verified local release-candidate checkpoint, not production-ready. Dependency CI blocker is fixed in source and locally audited. The useful day-two safety/review slices are implemented and tested. The full owner goal remains incomplete and PR 7 stays DRAFT.

**Fixed deadline:** October 21, 2026 at 00:02:39 America/Toronto. This report records the state reached before that deadline; it does not waive the original requirements.

## Published source

- Branch: `codex/clientrove-release-candidate`
- Published base: `09a986f3afa045fc85c83c77c491316fd5ca1fd7`
- Dependency checkpoint: `e429af4`
- Product checkpoint: `eef5ddf0f7ab7df27385d6e8cf6b60e0f3a0c367`
- Date/revisit checkpoint: `320edf317cd8d53924fba71c977227fe674089ec`
- Critical safety/UI checkpoint: `c929cbaf0019909ff21bce3633f25842cf67c281`
- `git ls-remote` readback matched `c929cbaf0019909ff21bce3633f25842cf67c281`.
- PR: #7, OPEN, DRAFT, base `cfd22af0e693a4854e3e2c46e034ccf5a39127f3`.

## What changed

### CI blocker

`backend/requirements.lock.txt` now pins `certifi==2026.10.19`, replacing vulnerable `2026.7.22`. Direct PyPI availability and OSV `PYSEC-2026-4320` data were checked. The advisory says `2026.10.19` is the fixed release. Local audit output is in `pip-audit-eef5ddf.txt` and ends with `No known vulnerabilities found`.

### Local day-two sales loop

- **Reply taxonomy:** existing seven states plus `referral`, `source_question`, `auto_reply`, and `bounce`, shared by backend and frontend labels.
- **Source challenge:** text such as “Where did you get my email?” overrides a generic question selection and creates durable suppression. Later correction does not clear the suppression.
- **Bounce:** the current address is stored in a bounded invalid-address list and the current recipient is blocked. This does not infer that the entire company is invalid; another address still needs fresh evidence.
- **Company safety:** any inbound reply marks cold work stopped and pauses same-tenant/same-canonical-domain sibling threads inside the existing `BEGIN IMMEDIATE` transaction. Reported meeting changes pause siblings too. No new service or scheduler was added.
- **Next up:** read-only `GET /api/outreach/next-up` is now consumed by the default returning local `/workspace` UI. It has loading, empty, error, refresh, one primary action, and a route into the existing thread without creating a new search. Reads do not reserve, spend, generate, send, or mutate.
- **Completion:** interested/question work disappears after a later recorded outbound answer and reappears only after a newer inbound reply.
- **Company guard:** oldest active cold thread owns a tenant + canonical domain; new same-company losers are paused during the existing transaction, and approval/readiness cannot make a loser actionable.
- **Revisit dates:** `not_now` and `auto_reply` expose compact date/time + IANA timezone controls. DST gaps and offset mismatches reject; both explicit Toronto folds pass; incomplete pairs become `awaiting_review` while preserving the pasted inbound body.
- **Manual answer facts:** the Conversations view now displays the actual saved profile description, buyer roles, industries, and geographies next to the human editor. Price/integration details explicitly remain `Unknown` when not stored.

## Actual verification

- `bash scripts/check.sh`: **PASS** at `320edf3`; current `c929cba` focused verification: backend 167 tests, frontend typecheck/lint, landing 97 tests. Exact-head CI run `39540683162` passed source, container, and GitGuardian.
  - Frontend: typecheck and lint passed; Node 60 passed; Convex 76 passed; landing 97 passed in the current focused suite; Next production build passed at the prior full script checkpoint.
  - Packaging, deployment, launcher, full-stack, proxy, preview, preflight, worker, and secret-source checks passed.
- `pip-audit -r backend/requirements.lock.txt --no-deps --disable-pip`: **PASS** — saved in `pip-audit-eef5ddf.txt`.
- `git diff --check`: **PASS** before commit.
- GitGuardian: **PASS** for published head `eef5ddf`.
- The focused new tests were written RED first, observed failing for the missing contracts, then passed GREEN before the full suite.

### CI readback

CI run `39540683162` is green for exact head `c929cbaf0019909ff21bce3633f25842cf67c281`: `source-checks=SUCCESS`, `container-checks=SUCCESS`, and GitGuardian `SUCCESS`. PR 7 remains OPEN/DRAFT.

## Journey acceptance matrix

| Journey | Status at this checkpoint | Evidence / gap |
|---|---|---|
| J1–J6 first-session foundation | Existing published baseline | Prior review evidence exists; no fresh browser walk claimed for this head. |
| J7 reason to return | Partial | Next-up API exists; durable dated departure summary is missing. |
| J8 Next up | **Implemented locally** | Returning `/workspace` calls the projection, renders empty/error/item states, and links to the selected existing thread; browser proof after this final push is still pending. |
| J9 log/classify | Partial | All 11 states and core safety consequences are implemented; dates, referral-contact creation, and durable correction audit remain. |
| J10 answer | Partial | Human answer editor now has saved facts beside it; answered interested/question work is removed from Next up; AI reply remains disabled and no mailbox is connected. |
| J11 follow up | Partial | Dated revisit contract now exists for `not_now`/`auto_reply`; no durable max-two server admission, manual send report sequence, or automated followup scheduler yet. |
| J12 meeting | Partial | Existing reported meeting states remain safe; timed booking, timezone, after-time prompts, and approved confirmation are not built. |
| J13 honest progress | Deferred | No personal funnel projection or deduplicated all-time metrics yet. |
| J14 next batch | Deferred | No saved-profile next-batch projection with contacted/suppressed company markers yet. |

## Explicitly still unmet

Global/tenant monetary reserve-settle-history guard; real auth/tenant hosted parity; provider/offline prerequisites; mailbox/calendar integration; privacy/export/delete; backup/restore; operations/alerts; final 14-step security/UX acceptance; physical-phone and screen-reader verification; and production readiness remain unmet. No live provider, paid request, external email, mailbox, calendar, deployment, or account connection was used.

Referral currently records a safe blocked state on the original thread; it does **not** create a new contact with fresh basis/verification. Auto-reply is recorded but not counted as a human reply. Cold followups are not represented as scheduled work, so no max-two claim is made.

## Review / rollback

Review the two commits in order: `e429af4`, then `eef5ddf`. Rollback is a branch-local revert of the product checkpoint, followed by the dependency checkpoint only if the owner explicitly chooses to restore the vulnerable lock (not recommended). Keep the PR draft; the owner alone decides readiness, merge, and release.

Existing screenshot inventory: `<HISTORICAL_LOCAL_ARTIFACT_ROOT>/journey-ux/screenshots/`, including desktop/390px/320px outreach and conversation captures. Those images predate `eef5ddf`; they are prior evidence, not fresh proof of this new UI.
