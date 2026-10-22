# Independent lifecycle/spec recheck: 82c8f28

Reviewed 2026-10-21 at clean detached `worktrees/legal-review`, exact `82c8f2848057064ad5d7f44bdf8c507517e32466`. Source/offline tests only. No product edits/commits, browser/personal profile, owner environment/configuration/data, remote deployment/provider/account/paid calls or real sends. External configs/probes/caches remain in `work/review-probes`.

## Scoped verdict

All three original `23014d8` findings are repaired for their original reproductions. Five additional independent classification, company-recency and provenance/repair cases pass. No further concrete actionable issue was established in this narrow recheck. This closes the reported projection/repair defects for this immutable checkpoint; it does **not** certify the whole app, hosted parity, browser experience or live operations.

## Original probes rerun unchanged

The original `lifecycle-spec-probe-23014d8.test.ts` and its config were reused **without regeneration, edits or weakened assertions**, now importing the immutable current source:

- Human question followed by distinct OOO retains all-time `replied=1`.
- A later same-company sibling rejection supersedes older interest, yielding `interested=0`.
- Repeating an unchanged unknown-source repair batch returns zero repairs and leaves revision unchanged.
- All original timed preflight, caller-clock denial, fresh referral state, three-plus-one batch preservation and 36 baseline lifecycle controls remain green.

Result: **42/42 passed**, 1.65s. This is the previously failing independent harness, not a substitution of root's regression assertions.

## Additional independent cases

| Case | Measured result |
|---|---|
| Original awaiting-review inbound corrected to Question, then a new OOO | All-time human reply remains counted. `replyClassifications` retains the earlier effective Question; original saved inbound document is byte-equal. |
| Original Question corrected to Bounce, then a new OOO | Human-reply count stays zero; bounced-address invalidity remains sticky. Original raw Question record remains byte-equal rather than being rewritten to make the metric pass. |
| Older interested sibling draft edited and its old classification reviewed after a newer company rejection | Editing/reclassification does not reorder received-event recency; company interest stays zero. A genuinely newer received interest restores it to one. |
| Legacy projection with no version2 activity/correction array, but latest thread correction Question | Home projection reports unknown-history/review work before repair. Bounded repair derives version2 and recovers the latest effective correction. A subsequent OOO retains the human count, and original inbound remains unchanged. |
| Reported-send legacy row whose owned source account is now absent | Repair stores explicit `sourceIsDemo=null`, does not count it as validated acquisition, then a repeated unchanged batch repairs zero and preserves the complete returned thread/history view. |

Extended independent harness: **47/47 passed**, 1.70s. It contains the unchanged 42 cases plus these five; counts must not be added together as 89 independent tests.

## Source confirmation

- `frontend/convex/lib/outreachLedgerValidators.ts` adds optional version2 activity and separate `replyClassifications`; original message schema/records are not rewritten. Reviewed-unknown provenance is represented by null, distinct from absent/unrepaired.
- `outreachLedgerStore.save` preserves the previous latest effective classification before applying a new inbound, then derives bounded activity using effective classifications. Read views use the same correction interpretation.
- `outreachLifecyclePolicy.activityFromHistory` retains effective historical human-reply count and latest received-event recency. `classificationHistory` recovers the known latest correction for older rows without inventing unrecoverable earlier corrections.
- `outreachActivity.insights` requires version2 projections for claims and chooses latest company state by received time, creation time and deterministic message-id tie-break. Draft `updatedAt` does not become reply recency.
- `repairActivity` upgrades older projections in bounded batches, preserves saved text/history and invalidates pending approval; null unknown provenance lets an unchanged completed derivation become a true no-op. It does not manufacture source eligibility, sender identity or contact permission.

## Commands and boundaries

- Original command: `node <existing continuation node_modules>/vitest/vitest.mjs run --config <external vitest-lifecycle-spec-23014d8.config.mjs>`.
- Extended command: same installed runtime/Vitest with `vitest-lifecycle-recheck-82c8f28.config.mjs`; probe `lifecycle-recheck-82c8f28.test.ts`, generator `prepare_lifecycle_recheck_82c8f28.py`. Config root is immutable legal-review frontend, environment edge-runtime, cache outside source. No install or dependency links.
- Original timed/preflight/referral/source/tenant controls remained in the rerun, including read-only uncached mutation preflight table equality, future bucket not granting early authority, fresh empty referral basis/approval and one-action/OOO-versus-due-meeting cases. These are fictional runtime controls, not remote cache/OCC evidence.
- Tracked worktree remained clean at the exact hash. Root supplied broader author suite/build/actual-loopback results and stated exact-head CI was pending; this recheck neither reran those wholesale nor independently inspected remote CI.

No fresh rendered Chrome/mobile or live provider/remote-auth acceptance exists from this review. REST remains closed and complete adapter/UI/privacy/monetary/connected workflow readiness remains a separate incomplete goal. Owner flags/configuration were untouched.
