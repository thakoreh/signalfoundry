# Independent date-contract review — immutable `320edf317cd8d53924fba71c977227fe674089ec`

## Verdict
**Changes required for the new revisit-scheduling backend contract.** Two focused date-safety findings are recorded in `date-review/findings.jsonl`. The existing replay, suppression, expiry-read-only, aware/unknown-zone, and regression controls passed; this is an API/backend review, not end-to-end UI acceptance.

## Scope and immutability
- Reviewed exactly `320edf317cd8d53924fba71c977227fe674089ec` (`feat(local): add explicit revisit scheduling`), parent `eef5ddf0f7ab7df27385d6e8cf6b60e0f3a0c367`.
- Source was read and executed from a `git archive` under `date-review/source`; this review did not modify the engineer checkout. Concurrent engineer edits were present when the live tree was rechecked, so all conclusions remain pinned to the archived SHA.
- Frozen source SHA: `320edf317cd8d53924fba71c977227fe674089ec`.
- Live engineer checkout was observed at the same SHA: `320edf317cd8d53924fba71c977227fe674089ec`.

## Actual checks
- Archived target backend: `PYTHONPATH=. .venv/bin/python -m unittest -q tests.test_outreach` → **28 tests passed**.
- Focused new/relevant controls: **5 executed; 3 passed, 2 failed against the required contract**.
- Passing controls:
  - naive revisit timestamp rejected;
  - unknown IANA zone rejected;
  - future date normalized to aware UTC and omitted from next-up;
  - past date produced `review_due`, `review_reply`, no approval, and `cold_followups_stopped=True`;
  - expiry did not restart send work;
  - idempotency replay rejected changed date payload and, after opt-out correction, returned current revision/state with suppression and no duplicate message;
  - existing opt-out correction/sticky-suppression tests passed.
- Runtime emitted only the existing Starlette/httpx deprecation warning; no dependency or network changes were made.

## Findings requiring owner action

### P2 — incomplete date details are not represented as repair-needed review
**Repro:** `PasteReply(reply_state='not_now', body='Please check back later')` is accepted and persists both the thread and inbound message as `not_now`. The inbound body is retained, but the durable state is not `awaiting_review` and there is no explicit date-repair marker. The same request model accepts an aware `revisit_at` without `revisit_timezone`, and a timezone without `revisit_at`.

**Evidence:** `backend/app/outreach.py:550-557,568-571` copies optional fields directly and persists the selected state. Approval/send remains blocked, so this is not a send bypass; the defect is that incomplete scheduling is indistinguishable from a completed not-now/auto-reply classification and next-up only offers generic `review_reply`.

**Action:** Require a complete date+explicit-IANA-zone pair for `not_now`/`auto_reply`; otherwise preserve the inbound and persist `awaiting_review` plus an explicit repair-needed state.

### P1 — nonexistent and ambiguous DST local times are accepted
**Repro:**
- `2026-03-08T02:30:00-05:00` + `America/Toronto` (spring-forward gap) was accepted and normalized to `2026-03-08T07:30:00+00:00`.
- `2026-11-01T01:30:00-04:00` + `America/Toronto` (fall-back ambiguous hour) was accepted and normalized to `2026-11-01T05:30:00+00:00`.

**Evidence:** `backend/app/outreach.py:57-75` checks only numeric awareness and whether the zone name exists; it never validates the wall-clock value against the IANA zone or rejects fold/gap cases.

**Action:** Resolve local input with `ZoneInfo` round-trip/fold validation; reject nonexistent times and ambiguous times without explicit disambiguation, and verify a supplied numeric offset matches the selected zone before storing UTC.

## Files created
- `<HISTORICAL_LOCAL_ARTIFACT_ROOT>/date-review/source/` — immutable archived source fixture.
- `<HISTORICAL_LOCAL_ARTIFACT_ROOT>/date-review/date_contract_controls.py` — focused negative/control tests.
- `<HISTORICAL_LOCAL_ARTIFACT_ROOT>/date-review/findings.jsonl` — actionable findings.
- `<HISTORICAL_LOCAL_ARTIFACT_ROOT>/DEADLINE_DATE_REVIEW_320edf3.md` — this report.

No product source files were changed by this review. Existing concurrent engineer edits remain untouched; no commits, comments, databases, provider settings, or external systems were changed.
