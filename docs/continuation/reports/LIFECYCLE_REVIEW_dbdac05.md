# Lifecycle and activity recheck: dbdac05

Reviewed 2026-10-21 in clean detached `worktrees/legal-review` at `dbdac05`. No product writes, external providers, owner data, keys, real sends, installs or personal browser use. All runtime mutations used new fictional temporary SQLite databases. Source inspection covers the changed activity projection/UI; no fresh rendered desktop/phone acceptance is claimed.

## Prior P1 findings: reproduced cases now blocked

| Case | Measured result |
|---|---|
| Repeat unchanged booking with fresh revision/idempotency key, then prepare/approve/report another confirmation | Meeting version remains **1**; second and third confirmation approval and sent requests return **409**; only one outbound exists. |
| Correct offset/timezone representation of same instant, from Toronto `2050-11-07T10:00:00-05:00` to UTC `2050-11-07T15:00:00+00:00` | Correction returns **200**, version remains **1**, subsequent confirmation approval returns **409**, readiness false. |
| Report booking for original email, change draft recipient, save fresh basis, then prepare confirmation | **409**, readiness false. Original booking/history remains intact and bound to `hello@business.com`. |

The source now compares parsed meeting instants before incrementing the version (`backend/app/outreach.py`, meeting mutation) and binds `meeting_recipient` in both confirmation preparation and the read-time action policy (`backend/app/outreach_lifecycle.py`). These address the two original reproductions. The focused regression suite also covers changed-recipient denial. This closes those findings for this immutable checkpoint within the reviewed local manual flow.

## Other adversarial checks

- Existing suite: `python -m unittest tests.test_outreach tests.test_local_journey tests.test_contact_basis -q` — **51 passed** in 5.478 seconds.
- Exact prior probe `lifecycle_probe_0ddc7ee.py` rerun against this checkpoint: stale approval **409**; identical idempotent replay **200**, one version; contradictory same-key payload **409**; any inbound remains a permanent cold-followup stop after classification correction; pause removes readiness and resume restores no approval; legacy records lacking new lifecycle fields still read and show an undated-booking repair task.
- Additional probe `lifecycle_probe_dbdac05.py`: same-instant offset/zone correction and activity projection checks described below. Probe scripts remain outside the product tree under `work/review-probes/`.
- Used root's continuation `.venv/Scripts/python.exe` with `PYTHONPATH` explicitly set to **legal-review/backend**. No dependency installation. An existing Starlette/httpx deprecation warning was emitted.

## `/insights` semantics and measurements

**Unique companies:** Two fixture contact threads/searches for the same canonical domain produced one company and one contacted company, not two. `domain_target` handles the existing canonical grouping. Before any reported send, approval alone does not count as contacted (covered by regression).

**Dates and read-only behavior:** A future Toronto meeting appeared at normalized UTC `2050-11-08T15:00:00+00:00` with `America/Toronto` retained for display and the Meetings destination. Stored outreach rows were byte-for-byte equivalent before and after GET `/api/outreach/insights`. Existing regression also covers future followup dates and unchanged thread state. The projection is explicitly all-time; it does not pretend to filter the funnel by reminder dates.

**Tenant boundary:** A second fixture tenant on the same database received zero funnel counts and no company flags. Application queries for threads and search provenance both filter by tenant. This does not constitute a full hosted-auth/session review.

**Examples/provenance:** Marking both source accounts as examples changed all funnel counts to zero and excluded-example-company count to one. Unknown root provenance and descendant referrals are excluded by source logic; referral propagation was inspected rather than separately generated in this probe. Company suppression/contact flags and departure reminders intentionally still include saved example/unknown threads, while the acquisition funnel excludes them. Keep this distinction if those flags are reused elsewhere; they are not validated acquisition evidence.

**Honest counts:** UI says all-time unique companies, independent stages rather than conversion rates, and local user reports without inbox/calendar/delivery/revenue verification. Auto-replies/bounces/unknown classifications do not count as human replies; only reported attendance counts as held, and explicit reported wins as customers. These are independent counts, so an externally reported meeting/customer can appear without a recorded initial send. That behavior matches the displayed disclaimer rather than inventing missing events.

## Remaining scope limits

No additional concrete P0/P1 issue was established in this recheck. This is not blanket production acceptance. The activity component and timing controls still need the planned rendered/mobile pass. The earlier ISO-offset-plus-IANA entry concern remains a usability item, not a demonstrated API failure. The latest-interest metric intentionally follows the latest classified inbound across the company; if the product later needs per-contact interest/history, that is a distinct semantic decision, not something this report silently changes.

The reviewed worktree remained clean. Root's separate cost seam and any later commits are outside this checkpoint.
