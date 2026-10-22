# Local closure/export/restore security review — ce37b6c

**Verdict: prior ab04a85 findings fixed; one new P1 restore-interruption issue remains.**

Exact immutable checkpoint `ce37b6c623009fa8eaa57a99664f6ef6c4a493bb`, detached clean `worktrees/policy-review`. No reviewer product changes, push, owner data/env, browser/Chrome, provider, sends, account or live service actions. Fresh fictional DBs/catalog/keys, mocked network and one intentionally exited fictional restore subprocess only. Frontend tests are immutable copies outside the product tree, using existing dependencies. Cost module's prior PASS does not imply separate-DB or hosted coverage.

## Actual evidence

- Copied OutreachWorkspace/SavedOutreach/local-data-control components: **59 PASS**, including both independent pending Copy/mailto + pasted-opt-out controls that failed at ab04a85 (`security_frontend_ce37b6c.log`).
- Pure contact order/claim review/mailto helpers plus four independent private-source cases: **16 PASS** (`security_helpers_ce37b6c.log`).
- Existing backend local-data/local-journey/outreach focused suites: **55 PASS** (`local_data_focused_ce37b6c.log`).
- Independent profile/changed-send/recipient/source controls: **4 PASS**; unsafe mixed evidence is now omitted from `source_facts` (`security_backend_ce37b6c.py/.json/.log`).
- Independent new local-data adversarial controls: **6 PASS, 1 FAIL**, exit1 (`local_data_independent_ce37b6c.py/.json`, `local_data_independent_ce37b6c_corrected.log`). Initial run had a reviewer fixture cleanup error from an unclosed SQLite handle; corrected and rerun, raw initial harness evidence retained. That was not a product defect.

## P1 — abrupt restore interruption publishes an active final output

`backend/app/local_data.py:103–130`: `restore_quarantined` first calls `backup_database(source, destination)`, which creates and fully populates the requested final destination. Only afterward does it open another connection and insert quarantine/disable policies/change interrupted holds.

Independent subprocess control replaces that helper with a wrapper that performs the real backup, then calls `os._exit(73)` before returning. This exactly isolates interruption between copy and quarantine without provider or owner activity.

Observed after subprocess exit:

```text
requested output exists = true
Repository(output).closed() = false
fictional CostLedger(output).reserve(...) = admitted
```

No actual paid dispatch occurred. The issue is that a failed restore drill leaves a normal runnable copy with prior active financial policy at the final requested path, contradicting its quarantine/no-activation guarantee. Exception cleanup cannot run on abrupt process termination.

Fix direction agreed with root: stage the backup privately on the same filesystem, complete and commit quarantine, disable policies, retain interrupted holds, close/checkpoint all SQLite connections, then atomically publish a **non-overwriting** final file. A failed stage must never expose an active DB at the requested destination. Do not remove an unrelated destination created by another actor during a publish race. Add subprocess-exit and exclusive-publication regressions; leave backup-only behavior separately documented as a historical copy requiring reconciliation before use.

Root reports a staging + atomic hard-link repair in progress. This report remains evidence for ce37b6c, not acceptance of uncommitted fixes.

## Passing new controls

1. Exact tenant erasure preserves suppression rows and the complete paid-attempt row/hold; disables that tenant's policy without changing another tenant's usable data.
2. SQL stale writer opened before erasure cannot insert a resurrected search. Stale Repository saves/search creation are denied; reopening cannot recreate its workspace; cost reserve independently rejects closure. Local HTTP returns410 on workspace/export/profile paths after closure.
3. Deliberately injected delete failure rolls back the whole erasure: no tombstone/partial deletion or policy disable is committed.
4. Tenant JSON export excludes the other tenant and financial catalogue, includes its own suppression facts, is a no-store attachment locally, and is403 on public-preview mode.
5. SQLite online backup captures newest committed WAL data with an open connection, preserves source records, and refuses the authority/existing backup as output.
6. Successful quarantine blocks app writes and new reservations even if an operator mistakenly reauthorizes policy flags. Original authority remains open; suppression rows survive.
7. A structurally invalid restore source fails, removes the newly created output, and leaves source bytes unchanged. The remaining failing control is abrupt interruption before quarantine, above.

## Limits

Erasure is logical removal/closure, not disk/WAL/free-page wiping, encrypted-at-rest proof or deletion of separate exports/backups/mail-app messages. Minimal suppression and financial records are deliberately retained. No hosted deletion, actual retention/legal compliance, Docker/OS restore deployment, real billing/price/history, browser/OS email handoff or full-product acceptance is asserted. Only the root may make product changes. Recheck the staged restore on a new immutable SHA before signoff.
