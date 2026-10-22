# Hosted lifecycle review — two repairs required

Exact immutable checkpoint: `23014d86f43c3e2614b6ec064d032f878e38012a`, delta `c1affd1..23014d8`, clean detached `worktrees/policy-review`. Root is sole product writer. Convex expert/reviewer checklists remain applied, with the expanded schema read first. All new reviewer files, copied source, logs and fixtures are outside product source in `work/review-probes`.

No owner files/env/database/preview, browser, live account/JWT, deployment, scheduler, external network/provider, email or paid action. Convex tests use their own fictional in-memory store and fetch that throws; Python uses fresh fictional SQLite files and mocked/denied network transports. Public hosted REST remains 503; internal default-off functions are not asserted to be live parity.

## P1 — self-referral can re-create the actual inbound sender as a new cold contact

`frontend/convex/outreachLifecycle.ts:112–119` rejects a referral target matching the **current editable parent recipient**, but does not compare it to the actual immutable received message's recipient. The equivalent local guard at `backend/app/outreach.py:713–714` has the same omission.

Independent reproduction in both runtimes:

1. Save a referral inbound from A, retaining its actual message ID and recipient.
2. Edit the parent's current recipient to B. The original inbound remains from A.
3. Refer to A using that original message as the provenance.

Both implementations accept the supposed new contact. The hosted child has A as recipient and referral.messageId pointing to A's **own** message, with `activity.hadInbound=false`, `coldFollowupsStopped=false`, `lifecycle.purpose=initial`. This misrepresents an already-received contact as a distinct new cold contact and evades the actual-source identity boundary. Local direct mutation also succeeds instead of rejecting.

Fresh basis and manual approval are still required; no automatic send or suppression clearing was established. This is not a demand for a permanent company lock. Genuine new same-company referral targets remain allowed under their fresh-basis/approval and existing stop rules.

**Required correction:** reject the target when it case-insensitively matches either the current parent recipient or the actual received message's original recipient. Preserve original history/provenance. Add the edited-parent/self-target counterexample to both runtimes and a genuinely new-contact control. Do not infer identity only from the mutable parent row.

## P2 — unknown-source legacy repair is not idempotent

`frontend/convex/outreachActivity.ts:368–395` skips a repaired row only if activity, sourceFacts and sourceIsDemo are all defined. When the owned search/account is missing or insufficient to recover provenance, repair writes sourceIsDemo as **undefined**. Running the same repair again therefore rewrites it, clears approval and increments revision/updatedAt again forever.

Independent counterexample removes a legacy row's activity/source fields and points its accountId at a missing legacy source. First repair returns repaired=1. A repeated identical repair also returns **repaired=1**, rather than 0, with another revision increment. The permanent happy-path repair fixture only exercises recoverable known research, so it does not catch this case.

**Required correction:** record a durable explicit unknown/repaired provenance state (for example a compatible null/enum/sentinel) without converting unknown into known non-demo or allowing approval/metrics. A completed identical repair must be a no-op. Preserve strict tenant lookup, immutable history and original approval invalidation. Unknown provenance should remain honest review work, not be manufactured into qualified evidence.

## Independently executed evidence

- `lifecycle-23014d8.log/.json`: **89 Convex tests: 87 PASS / 2 FAIL**. Existing foundation43 + new lifecycle36 = **79 author tests PASS**. Added independent10 = **8 PASS / 2 findings reproduced**.
- `local_lifecycle_23014d8.py/.log`: **16 Python tests: 15 PASS / 1 FAIL**. All 14 unchanged local journey regressions pass, including the new OOO/due-meeting regression. Independent due/future meeting+OOO positive/negative control passes; independent edited-parent self-referral fails as above.
- `lifecycle-adapter-23014d8.log`: **14 Node adapter tests PASS**, including explicit hosted outreach 503/no repository invocation.
- `lifecycle-typecheck-23014d8.log`: focused copied Convex strict TypeScript check PASS, noEmit.
- All **34 copied Convex source files** hash-match the exact immutable worktree. Product source remains clean. Dependencies are reused via an outside-tree junction; no installation/new dependency.

Raw probes:

- `lifecycle-review-23014d8/convex-tests/outreach-lifecycle-independent.test.ts`
- `vitest-lifecycle-23014d8.config.mjs`
- `local_lifecycle_23014d8.py`

Commands:

```text
node <continuation/frontend/node_modules/vitest/vitest.mjs> run --config <work/review-probes/vitest-lifecycle-23014d8.config.mjs> --reporter=dot --reporter=json --outputFile=<work/review-probes/lifecycle-23014d8.json>
python -B <work/review-probes/local_lifecycle_23014d8.py>
node --experimental-strip-types --test frontend/tests/api-adapter.test.ts
node ./node_modules/typescript/bin/tsc --project tsconfig.review.json
```

Initial probe diagnostics preserved separately: one over-specific blockedReason assertion expected the later recipient reason while the earlier referral classification reason correctly won; corrected before referral adjudication. The first reviewer typecheck used an older ES2022 lib configuration; aligning the outside-tree lib to the repository's ESNext lib repaired findLast typings. Neither harness issue required product/test changes. `lifecycle-23014d8_initial-harness.log` and `lifecycle-typecheck-23014d8_initial-config.log` retain those diagnostics.

## Independent passing lifecycle controls

1. Fresh uncached mutation preflight works before confirmation expiry and refuses at the exact actual meeting instant. Legacy query preflight refuses timed purposes. No thread/request/message/event writes occur on successful or expired preflight, and reportSent rechecks expiry.
2. A caller clock bucket two minutes into the allowed skew cannot make a future followup due, approve it or create early queue authority. At actual due time fresh approval succeeds.
3. The same UTC booking instant retains its version across timezone correction and resetting/re-reporting unknown outcomes; an already-reported confirmation cannot receive a new allowance. Recipient identity remains on the original booking.
4. Any inbound (tested with OOO) permanently cancels an approved cold plan. Correcting to interested, explicit resume and replay of the old approve operation do not restore its date/approval or permit another cold plan.
5. A due meeting survives a later future OOO snooze in the hosted queue. Booked/unknown sale stays unchanged; a prompt does not assume attendance, sale or permission. The independent Python control also verifies a genuinely future meeting does not become due and the read leaves data untouched.
6. Repair touches only its bounded three owned legacy rows, invalidates pending approval without rewriting its immutable record and does not touch another tenant. The recoverable known-source replay is a no-op; the unknown-source exception is the finding above.
7. Cold plans require weekday spacing, at most two separately approved/reported followups. Three repeated preflights do not consume a send; after the two reports a third plan is rejected and message count stays initial+2.
8. Approval alone does not count contact. Changed actual sent text remains distinct from immutable approval. OOO does not count as a reply; explicit correction can record a real question. Future meeting is not held; after-time attended report increments held but not sale. Every projection remains reported_by_you.

The broader author suite also passes roles/expectedOrg/tenant checks, strong-match admission, duplicate/stale/atomic limits, company-owner/stop races, source URL safety, booking-link byte binding, all specified reply types and provenance/unique-company projection cases. Other reviewers' additional metric findings are not superseded by these passing narrower metric examples; root is reviewing them separately.

## Source/resource assessment and scope

Shared store extraction retains all 11 registered foundation exports and centralizes owned lookup, gate, revision/idempotency, binding, current view and save logic. New modules register only internal validated queries/mutations through verified-identity wrappers. Optional schema additions remain compatible with older rows; old approvals are never rewritten to pretend they match new binding semantics.

New read paths use explicit org indexes, at most100 threads, bounded50 messages and200 events per thread; legacy repair paginates three rows instead of scanning every history on home. Per-thread immutable records are separate documents, and activity summaries avoid multiplying every message read across the return queue. Caller clock buckets are cache invalidation input, not authority; a future hosted UI still needs real refresh-on-time/focus behavior. External deployed query caching/OCC behavior is not proved by convex-test.

Public source extraction excludes demo/non-company/private-literal URLs and bounds IDs/excerpts/links. Hosted start now matches the explicit local strong-match rule; manufactured tests add clear fictional company evidence rather than treating fixtures as customer demand. Rule matching and source IDs are not semantic truth, contact verification, consent or buying-intent proof.

No scheduler, mailbox, paid-provider operation or new monetary allowance is connected. One authoritative local SQLite cost ledger is **not** shared hosted monetary authority; the closed REST/default-off internal gates must remain. No deployment/JWT/schema migration, live rates/history, account connection, external delivery/calendar, hosted export/closure/retention, mapped UI parity, Chrome/mobile/accessibility or production readiness is certified.

**Verdict:** repair the referral-source identity boundary in both runtimes and the unknown-source repair idempotency before signoff. Recheck a fresh immutable checkpoint with these exact controls; preserve all baseline failures and the broader live/parity limits. No product changes were made by this reviewer.
