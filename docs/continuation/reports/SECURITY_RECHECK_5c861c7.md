# Scoped repair recheck — 5c861c7

Exact tested immutable commit: `5c861c77cbff4b5da31df2d4d8a58a6e0bff1bf3`. Read-only clean detached `worktrees/policy-review`. Reviewed `git diff c118b3f..HEAD`; original baseline review and its failed evidence remain unchanged in SECURITY_REVIEW_c118b3f.md.

## Findings and scoped verdict

**PASS within source/offline scope. No actionable security, tenant, cost or standards finding reproduced in this repair.** The original missing-focus P2 is repaired: the action container now has `tabIndex={-1}` with a scoped visible focus outline; previously failing original navigation reproduction passes unchanged. Approval/Copy navigation still never invokes approval, clipboard, email handoff or a provider.

A retained private followup date remains available in an explicit recovery panel after inbound or a reported meeting hides the cold plan. Its cancellation removes only that private date, preserves unrelated outgoing text and the saved meeting/reply, and makes no schedule/API write. Return-date and other existing buffers remain covered by the original tests. Toronto's repeated 01:30 during the DST fall-back now includes the distinct actual GMT-04:00 / GMT-05:00 offset; unknown or invalid timezone fallback remains explicit.

The local Next up correction is narrow and safe: corrected opt-out/source-question threads stay suppressed, and corrected bounced addresses stay invalid. Neither becomes answer work after question/interested correction or replay of an old approve operation. Healthy human replies remain visible; answering removes the item and a new inbound restores it. Past reported meetings remain reportable even on stopped threads without granting contact permission or inventing attendance/sales. Due reminders use the existing blocked predicate; invalid/suppressed legacy fixtures disappear and healthy due work remains unapproved. All tested queue GETs preserve a full logical database dump after application initialization. Different tenants in one fictional database retain separate queues and cannot read each other's thread.

No new paid-dispatch code or Convex source is in this delta. These results do not accept full product readiness, rendered/mobile behavior, production auth, hosted parity, current prices/history, mailbox/calendar providers, delivery or deployment.

## Test appendix

**122 distinct executed tests, all PASS:**

| Group | Count | Evidence |
|---|---:|---|
| Original c118 cases, copied byte-for-byte unchanged | 83 | navigation-5c861c7-original83.log |
| New frontend repair cases | 8 | navigation-5c861c7-additive.log |
| Current backend local journey | 18 | queue-independent-5c861c7.log |
| Independent backend queue controls | 13 | queue-independent-5c861c7.log |

Original 83 = 64 existing outreach tests + 2 existing session tests + 17 original reviewer controls. Additional 8 = 5 newly authored permanent repair regressions + 3 independent checks (meeting-driven cold-date recovery, cancel retaining unrelated private outgoing text, DST-fold offset distinction). Their filtered run skips 64 already-covered tests; skipped definitions are not counted again. Backend 13 = 3 stop/correction/replay controls (each checks both question and interested), 3 stopped past-meeting positives, 2 healthy human reply statuses, answered/new-inbound behavior, same-database tenant isolation, and 3 healthy/invalid/suppressed due-reminder controls.

### Commands and fixture ownership

From task root:

```powershell
& 'C:\Users\Hiren\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' '.\worktrees\continuation\frontend\node_modules\vitest\vitest.mjs' run --config '.\work\review-probes\vitest-navigation-5c861c7.config.mjs' --reporter=verbose
& 'C:\Users\Hiren\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' '.\worktrees\continuation\frontend\node_modules\vitest\vitest.mjs' run --config '.\work\review-probes\vitest-navigation-additive-5c861c7.config.mjs' --testNamePattern 'RECHECK:|keeps an unsent followup|keeps the booked fall-back|focuses the existing approval/copy' --reporter=verbose
& '.\worktrees\continuation\.venv\Scripts\python.exe' -B '.\work\review-probes\queue_independent_5c861c7.py'
```

All implementation source and tests ran in external copies under `work/review-probes/navigation-review-5c861c7` and `queue-review-5c861c7`. SQLite fixtures are fictional and temporary under the same probes area; import-time application DB is an explicitly assigned fictional external fixture. Provider/env credentials were removed before app import; real httpx transport, socket.create_connection and subprocess launches were denied in backend tests. TestClient is in-process ASGI, not a bound service. Frontend API, clipboard and email-app are mocks. No owner DB/env/ports, browser, account, external provider, real message, product source, git commit or deployment was used.

Initial reviewer harness errors were corrected only in the external probe: nonexistent FollowupRequest → actual ScheduledDraft; plural route name → singular repository operation; other-tenant search explicitly created before update; no-write dump boundary moved after create_app initializes empty cost schema. Raw initial logs are preserved as queue-independent-5c861c7-initial-import.log and queue-independent-5c861c7-fixture-errors.log. These were fixture mistakes, not product failures or weakened assertions.

### Hash and clean-state evidence

Source manifest `recheck-5c861c7-source-hashes.json` verifies all copied backend app Python files, 2 backend fixture files and 7 relevant frontend implementation files against the immutable checkout. Three original test-file hashes match the c118 external files byte-for-byte. Final `git status --porcelain` was empty and HEAD remained exact 5c861c77cbff4b5da31df2d4d8a58a6e0bff1bf3.

Verified implementation/test source entries: 30.

- `frontend/components/outreach-workspace.tsx`: `2573a3e0511e660bd7be1d64e8de624463334df2acc9352e22443c7abae60139`
- `frontend/components/outreach-timing.tsx`: `b3e83c21b5817f7f8fef58fa5f817e890a61fbbd5fd0cea5077ead2cb3ac2a96`
- `frontend/lib/outreach-next-step.ts`: `22d27092a081d89b1df482224ce1c89b726607ceb7c2720738ca068b46e459d8`
- `backend/app/outreach.py`: `f49216250aae045a3fef579da99fce6894832d7c63089cb484b41e8449b73d19`

Limits: jsdom focus is not physical keyboard/Chrome acceptance. Node ICU timezone output was checked in this installed runtime only. Synthetic legacy rows were used only to directly isolate due-reminder filtering; no real persisted data was altered. The inherited Starlette/httpx deprecation warning did not affect these successful in-process tests. No full-backend suite or broad monetary-module re-audit was rerun in this focused recheck.
