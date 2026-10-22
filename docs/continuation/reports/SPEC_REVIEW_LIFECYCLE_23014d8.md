# Independent hosted lifecycle/spec review: 23014d8

Reviewed 2026-10-21 at clean detached `worktrees/legal-review`, exact `23014d86f43c3e2614b6ec064d032f878e38012a`, diff baseline `c1affd1`. Compared `HOSTED_LIFECYCLE.md`, `OWNER_CONTRACT.md`, `LOCAL_DECISIONS.md`, actual lifecycle/activity/store/policy/schema, and focused fixtures. Convex review guidance was applied; optional schema expansion was inspected before backend review.

No product edits/commits, browser/personal profile, owner data/configuration, network/provider/account/paid/deployment actions. All writes were isolated fictional test records; configs/probes/caches remain under `work/review-probes`. This does not re-audit accepted sender provenance or local reply AI.

## Verdict and findings

**Three independently reproduced contract mismatches remain.** Existing 36 lifecycle controls pass, but they do not cover the failing combinations below. No external-send/tenant bypass was established. This is not full hosted parity, browser acceptance or completion of the owner goal; REST remains closed.

### P1 — all-time human-reply count is erased by a later automatic reply

Source: `frontend/convex/outreachActivity.ts:285–295`, where `replied` is based solely on the thread's current `replyState` plus `latestInboundId`. The projected activity contains no retained effective historical human-reply fact.

Reproduction through actual internal mutations:

1. Report an initial send, then paste a human question; insights reports `replied=1`.
2. Advance the fixture time, paste a distinct OOO/auto-reply with a future return date.
3. Insights now reports **`replied=0`**, despite immutable history containing outbound, human question and OOO.

The all-time company replied stage must not count the automatic reply, but must retain the earlier genuine classified response. `LOCAL_DECISIONS.md` explicitly defines all-time unique companies with classified human inbound; local `backend/app/outreach_insights.py:40` uses any qualifying human inbound. Corrections still need to change the effective classification of the relevant record; simply trusting original immutable classification when it was later corrected is insufficient.

Acceptance: human→OOO/bounce remains replied once; OOO/bounce-only remains zero; changing the only real human classification to an unresolved/nonhuman state is reflected honestly. Retain bounded effective activity at successful mutations/repair without turning home into an unbounded history scan.

### P1 — stale sibling interest is counted after a newer company rejection

Source: same activity projection, line 294 adds a company if **any** current contact thread is interested. It does not select the latest company inbound/classification.

Reproduction: paste Interested on the first company contact; advance time; paste Not interested on a second contact at the same canonical company. Both saved replies remain intact. Insights still returns **`interested=1`**, from the old sibling state, although the later company reply rejected the offering.

This differs from the agreed latest company interest semantics and the existing local projection (`backend/app/outreach_insights.py:41–42`). Use a deterministic latest effective company classification/recency rule; don't manufacture a nested funnel or rewrite immutable messages. Acceptance: the newer rejection removes current company interest; a genuinely later renewed interest can restore it once. This is a progress-reporting defect, not evidence that a real send occurred.

### P2 — unknown-provenance repair is not idempotent

Source: `outreachActivity.repairActivity`, lines 369–392. Its skip requires `sourceIsDemo !== undefined`; unknown provenance intentionally remains undefined, so an already-derived unknown record never qualifies for the skip.

Reproduction: remove the old owned source account from a fictional saved search and unset the legacy thread's activity/source fields. First repair reports `repaired=1`, revision becomes 2. Repeat the same batch with unchanged records: it again reports **`repaired=1`**, revision becomes 3. Every replay continually revises and clears approval rather than recognizing a completed derivation whose provenance is still unknown.

Track completed derivation independently of whether source provenance is known, or otherwise make no-change unknown repair a no-op. Keep unknown/demo acquisition data excluded and permission/sender state unmanufactured. Acceptance: a second unchanged batch repairs zero and preserves revision/text/history; later explicit source reconciliation can still be separately reviewed.

## Independent controls that passed

- **Timed handoff:** caller `clockBucket+2` cannot authorize an early followup. At server due time, exact approval succeeds. Two uncached mutation preflights return the same approval while thread/request/event/approval/message table snapshots remain identical. Legacy query preflight refuses the timed purpose. Subsequent OOO clears due plan and approval and leaves the cold stop true.
- **Fresh referral:** actual latest referral produces a distinct credited contact with `user_entered` status, empty contact basis/approval, no messages and no readiness. Original received record remains identical. Existing current-message, duplicate/original/bounced/suppressed target, thread limit and replay controls pass.
- **Legacy batch bounds:** four old rows actually repair in **3 + 1** across the returned pagination cursor. Saved message body/history and immutable approval remain unchanged; pending current approval is invalidated. This passing known-source case does not excuse the unknown-source repeat defect above.
- **Lifecycle baseline:** all 36 current cases pass, covering future weekday/minimum-gap planning, maximum two independent followups, each inbound stop/correction, pause/recipient controls, timed booking version/recipient/confirmation count, uncached expiration, no early attendance, sale unknown, company decision plus new approval, bounded history, role/tenant/clock gates and one-action queue behavior.
- **Due meeting versus snooze:** hosted permanent control passes; independently reran the exact changed local regression below. A future OOO return does not hide an already-due meeting outcome. It does not infer attendance or resume contact.
- **Default-off/partial feature boundary:** functions remain internal, role/organization checked, bounded and off by default. No transport, scheduler, AI/provider or hosted monetary authority is added. REST still returns authenticated 503 without local/Convex outreach fallback. New optional fields preserve existing records; actual remote schema migration/OCC/cache semantics remain unverified.

## Commands, counts and artifact evidence

- External `prepare_lifecycle_spec_probe_23014d8.py` creates `lifecycle-spec-probe-23014d8.test.ts` and `vitest-lifecycle-spec-23014d8.config.mjs` outside source. Existing installed continuation Vitest/dependencies, immutable legal-review source, edge-runtime and external cache; no installs or dependency links.
- `node <existing continuation node_modules>/vitest/vitest.mjs run --config <external vitest-lifecycle-spec-23014d8.config.mjs>` — **39 passed / 3 failed in 42 tests** (36 current controls plus six independent checks). Three failing assertions are precisely the findings above; no test was weakened. Latest duration 1.57s.
- `node --experimental-strip-types --test tests/api-adapter.test.ts` — **14 passed**. Includes authenticated hosted outreach denial, role/scope and no local fallback.
- With root's isolated Python and `PYTHONPATH=legal-review/backend`: `python -m unittest tests.test_local_journey.LocalJourneyTest.test_future_out_of_office_does_not_hide_an_already_due_meeting_outcome -v` — **1 passed** in 0.166s. Fictional SQLite/FastAPI TestClient fixture; this is not an independent real-browser or deployed HTTP claim. Existing Starlette/httpx deprecation warning only.
- Source hash/status checked; tracked worktree stayed clean. Author's full155 Convex/235 backend/135 components/Node67/type/lint/build results were supplied, not independently rerun wholesale in this review.

Fresh rendered Chrome/mobile, real JWT/remote Convex transaction/cache behavior, full hosted adapter/UI/privacy parity, actual provider/contact quality and connected delivery/calendar remain separate unmet gates. Keep hosted REST and owner feature flags closed; scoped test success is not production readiness.
