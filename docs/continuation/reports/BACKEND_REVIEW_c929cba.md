# Final backend review — c929cba

## Verdict

**REWORK required.** The queue/date repairs pass the fresh adversarial controls, but the company guard still has a P1 pause/resume backdoor.

## Exact scope

- Reviewed published HEAD `c929cbaf0019909ff21bce3633f25842cf67c281`.
- Executed from immutable git archive: `source-c929cba/`.
- Python: `<LOCAL_HOME>/microsaas-projects/signalfoundry-rc/.venv/bin/python`.
- Each control used a fresh SQLite database and temporary HOME. No providers, network calls, live DB, accounts, secrets, or product source writes.

## Decisive fresh-SQLite command

```text
PYTHONPATH=<HISTORICAL_LOCAL_ARTIFACT_ROOT>/final-backend-review/source-c929cba \
<LOCAL_HOME>/microsaas-projects/signalfoundry-rc/.venv/bin/python \
<HISTORICAL_LOCAL_ARTIFACT_ROOT>/evidence/backend/tests/c929_backend_adversarial.py
```

Result: **4 PASS, 1 FAIL**.

- `queue_completion_interested`: PASS — inbound `answer_reply`, saved/approved/reported answer removed, identical sent retry did not duplicate, newer inbound reopened work; outbound approved snapshot stayed unchanged.
- `queue_completion_question`: PASS — same controls for `question`.
- `dates_and_suppression`: PASS — Toronto spring gap and wrong offset rejected; both explicit Toronto fall folds and ordinary aware time accepted; incomplete pairs became `awaiting_review` with inbound body preserved; expiry remained review-only/read-only with no send restart; opt-out remained suppressed after correction and idempotent replay; bounce stayed invalid and non-approvable.
- `source_question_guard`: PASS — source question forced sticky suppression even after correction.
- `company_guard_tenant_scope_legacy_and_resume`: **FAIL**, detailed below. The same-company initial loser pause, same-key replay, legacy-row denial, and different-tenant independence controls completed before the final failure.

## P1 finding

A fresh same-tenant SQLite scenario approved the oldest `sameco.com` cold thread, created a second `sameco.com` thread, then recorded an interested inbound on the owner. The sibling was paused. After refreshing and resuming the sibling, approval succeeded:

```text
paused=False
company_conflict=False
ready_for_manual_action=True
approval=True
```

That makes a second same-company thread actionable after the owner has inbound work. The relevant archived implementation excludes inbound threads from `_cold_company_owner` (`app/outreach.py:365-381`), and approval only denies when an active cold owner is found (`app/outreach.py:565-573`). Finding recorded in `findings.jsonl`.

## Existing focused suite from the same archive

```text
PYTHONPATH=. <LOCAL_HOME>/microsaas-projects/signalfoundry-rc/.venv/bin/python -m unittest -q tests.test_outreach
Ran 31 tests in 0.681s
OK
```

Only the existing Starlette/httpx deprecation warning was emitted.

## Files created

- `final-backend-review/source-c929cba/` — immutable backend archive at c929cba.
- `evidence/backend/tests/c929_backend_adversarial.py` — independent fresh-SQLite controls.
- `evidence/backend/findings.jsonl` — P1 company-resume finding.
- `evidence/backend/logs/adversarial-final.jsonl`
- `final-backend-review/logs/outreach-tests.txt`
- `final-backend-review/FINAL_BACKEND_REVIEW_c929cba.md` — this report.

The engineer checkout remains clean at c929cba; no product files were modified. Full owner-goal acceptance, UI/browser proof, auth/privacy/provider/deployment/funnel/follow-up scope remains outside this narrow review.
