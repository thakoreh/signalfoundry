# Focused workspace UX/spec/source review

Exact clean detached source: **618b10121f2c0c4e38b56c19e6c798c615170d75**. Scope: `8bfa7b0..618b101` only. **Changes need repair before acceptance:** one P1 transport mismatch and two P2 correctness gaps below. No product changes were made.

## Actionable findings

### P1 — Dashboard assumes a full thread while requesting compact summaries

`frontend/components/outreach-dashboard.tsx:55` types GET `/outreach` as `OutreachThread[]`. Actual no-search response in `backend/app/outreach.py:546` projects only 13 summary fields; it excludes `messages`, `recipient_status`, `approval`, `meeting_at` and `meeting_timezone`. The current dashboard mock supplies these absent fields, masking the mismatch.

Reproduced against four actual fictional in-process HTTP snapshots, then fed the JSON unchanged to the real component: clicking **Replies** throws `Cannot read properties of undefined (reading 'some')` at dashboard line85. A recorded meeting's local time is absent in Meetings. An invalid-recipient status cannot be accurately derived from the existing summary either. This conflicts with the requested working Replies/Meetings dashboard and truthful status/readiness.

Use an explicit, validated minimal dashboard projection/summary type carrying the needed facts, or adapt the UI to real available fields. Do not solve this by loading every thread's raw private message body into the aggregate dashboard. Add a real-wire contract fixture rather than relying solely on fabricated full-thread mocks.

### P2 — Default reply state overrides real approval/send status

`status()` checks any truthy `reply_state` before actual inbound/outbound or approval. Local threads start with `awaiting_review` even with no inbound. Actual approved and sent snapshots both render **Needs review**, respectively instead of **Message approved** and **Awaiting reply**. This is a separate ordering/domain bug: adding missing transport fields alone will not fix it. Derive received-reply labels only when a real inbound exists; otherwise distinguish current approval, reported send and unsaved/unapproved work. Preserve the difference between reported and provider-confirmed facts.

### P2 — Missing selected-thread response falls back to another conversation

`frontend/components/prepare-outreach.tsx:52–60` validates a matching thread but falls back to `/workspace/outreach/search_a` if none exists. That workspace defaults to an existing thread, so a click on company A can land on B after an empty or unrelated successful response. This fails the new exact selected-company Review routing requirement. Both empty `threads: []` and an array containing only another account reproduce navigation without `?thread=`. Fail closed with an actionable response error/retry instead; do not silently open a default company.

## Verified boundaries and remaining observations

- Current author dashboard/settings tests **6/6 pass**, but their full-thread mock is not the real collection response. Independent checks are needed to prevent this contract drift.
- Dashboard mount/filter/search/refresh issue only GET reads; row preparation alone performs the explicit existing local POST. No transport/send/approval/model generation is added. Unconnected email and manual activity are stated visibly.
- Existing tenant/session controls remain: settings route authenticates hosted users; SaasWorkspace denies unknown roles, requires an organization, and remounts the whole keyed tree on user/org/role changes; WorkspaceSession aborts old closures. Hosted dashboard returns the unavailable state and does not read local data; LocalDataControls renders only locally. Independent late-local-response → hosted-transition case passes without showing old local records. No new hosted access bypass was found in this diff.
- Snapshot reads are aborted on effect cleanup, and late aborted responses cannot update state. Refresh failures retain the previous snapshot with an error rather than showing fabricated zero metrics; this is not claimed as fresh successful data. Aggregate counts retain reported/all-time/unique-company descriptions and separated outcomes.
- Source retains local storage/history, settings export, existing exact-approval/manual-send semantics, and five-result bounds. The old home panels were removed from composition, not deleted from storage. Thread limit is already100, matching existing compact collection limit; no new history truncation was inferred beyond that established bound.
- Meetings filter can display an action label such as Reply while forcing the link to Meetings; align label/view while repairing the projection if retaining filter overrides. This is a small related UI inconsistency, not a fourth independent release blocker.
- Mobile source reflows header, filters and rows at640px and retains44px primary targets. No rendered browser claim: root owns fresh Chrome/build checks.

## Independent evidence, commands and counts

1. `workspace-wire-618b101.py` uses existing fictional temporary SQLite helpers and FastAPI TestClient, creating approved → reported sent → actual question → reported timed meeting stages. Each stage reads `/api/outreach`, `/insights`, `/next-up` in-process; all12 GETs returned200. Snapshot file: `workspace-wire-618b101.json`; log: `workspace-wire-618b101.log`. These are fictional records, not owner DB copies. No listening port/provider is used.
2. External `workspace-independent-618b101.test.tsx` copies the unchanged193-line current author dashboard harness/tests with absolute legal-review imports, adds seven independent cases and consumes that actual wire JSON. **13 cases: 7 PASS / 6 FAIL**, process exit1: **six copied author tests pass; six new cases fail** (Replies crash, approved label, sent label, meeting time, empty result fallback, unrelated result fallback); the seventh independent late hosted-transition privacy case passes. No author assertion was weakened. An initial external `it.each` argument-shape error was corrected to named `{rows}` fixtures so both intended array cases are exercised; the six final failures are product behavior, not the harness error.
3. Command: existing `node.exe` → continuation installed `vitest/vitest.mjs run --no-cache --config work/review-probes/vitest-workspace-independent-618b101.config.mjs`. Config cache=false; product imports point to **legal-review**, only dependencies are reused from continuation. Log: `workspace-independent-618b101.log`; generator `make-workspace-618b101-probe.py`. Python uses continuation's existing venv with `PYTHONPATH=legal-review/backend`, `PYTHONDONTWRITEBYTECODE=1`.

All probes/configs/logs are outside product source under task `work/review-probes`. `git rev-parse HEAD` and `git status --short` reconfirm pinned clean source. No builds, browser/ports, owner env/data, providers/mailbox research, accounts, purchases, real sends, engine implementation, commits or remote changes. No full app, hosted parity, security clearance, WCAG or production acceptance is asserted.
