# Company resume: contract adjudication and distinct regressions

The owner requires one active cold thread per canonical company and pauses other contacts after a reply, opt-out or meeting **until the founder decides**. A permanent company lock was not requested. An explicit resume followed by fresh approval is allowed when no suppression/invalidity or other active cold owner blocks it. Resume alone must restore no approval or cancelled followup.

The archived BACKEND_REVIEW_c929cba.md is preserved unchanged. Its final single-resume/new-approval assertion is broader than this contract; that scenario alone is not a bypass. A fresh independent probe against immutable 0c1418d found seven control groups passing and two separate real failures:

| Control | Baseline evidence |
|---|---|
| Default company pause, explicit founder choice, fresh approval | PASS |
| Resume/replay restores no stale approval or followup | PASS |
| Concurrent original cold threads | PASS: one actionable owner |
| Concurrent explicitly resumed cold siblings after company reply | FAIL: both actionable; cancelled-followup flag wrongly removed both from ownership |
| Sticky opt-out, correction/resume/replay, foreign tenant independence | PASS |
| Sticky source-of-contact suppression | PASS |
| Direct bounced-address persistence through correction/replay | PASS |
| Deferred bounce classification | FAIL: invalid-address record absent, later affirmative correction allowed approval |
| Meeting pause, explicit new founder choice and tenant mutation denial | PASS |

Fix: active cold ownership is independent of the cancelled-followup historical flag. It still excludes paused/suppressed threads and threads with inbound; transactions serialize competing approvals. Both direct and deferred bounce handling invalidate the actual affected inbound recipient, even if the editable draft address has changed. Classification does not silently invalidate a different fresh contact.

Author regressions went red on all three cases (two cold owners; missing deferred invalidity; wrong-recipient preservation), then the outreach suite passed 34 tests. Independent recheck of immutable c887f76 passed ten adversarial controls and the 34-test outreach suite, including original-address invalidation after draft-address edits. The replacement address remains usable with fresh evidence/approval. Existing immutable sent history and suppression policy are unchanged. This closes the scoped discrepancy and two distinct safety defects; these results are not whole-app acceptance.

Probe artifacts are retained outside source under the task's work/review-probes directory. Permanent regressions live in backend/tests/test_outreach.py; no owner database, credentials, provider or network call is used.
