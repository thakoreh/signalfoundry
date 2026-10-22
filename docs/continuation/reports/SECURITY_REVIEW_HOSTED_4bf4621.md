# Hosted manual-ledger foundation — sender provenance repair required

Exact immutable checkpoint: `4bf462190ed7c75b34444e7d8c22cc2fcecb1f68`; delta `1bf09f4..4bf4621`. Clean detached `worktrees/policy-review`; root remains sole product writer. Read schema first, then new policy/validators/auth wrappers/ledger and changed sender/adapter paths, using the Convex expert and reviewer skill checklists. No product edits, commits, deployment/code push, owner data/env files, browser, providers, sending or paid/network operations.

The new ledger is internal, default off and not called by the client. SaaS REST outreach remains 503. Findings concern safe implementation before future enablement; they are not an assertion that an unauthenticated live endpoint is currently exposed.

## P1 — website extraction can overwrite or establish founder sender identity

`frontend/convex/workspaces.ts:175–183` (`finishAnalyze`) installs `validateProfile(args.profile)` as a replacement profile. The new optional sender fields are now accepted by that validator, but this path does not distinguish untrusted worker-extracted values from founder-entered identity. `saveProfile` preserves omitted fields; this analysis completion path does not.

Four independent failing controls establish the same root cause:

1. A saved founder name/address/contact followed by normal older-shaped analysis output **loses all three saved fields**.
2. Worker-supplied empty strings **clear** the saved fields without a founder choosing to clear them.
3. Invented worker strings **replace** existing saved founder data.
4. Starting with explicitly empty founder sender fields, invented worker values establish a nonempty sender footer. Preparing a manual message with that footer and then approving it returns **`readyForManualAction=true`**, even though the founder never entered these identity/address/contact values. The new ledger's sender requirement therefore accepts extraction provenance as founder provenance.

The reproduction uses the same `beginAnalyze`/`finishAnalyze` mutations as the public admin analysis action, with manufactured worker output supplied directly inside convex-test; no actual worker/provider is invoked. Fresh exact approval is still required, and tenant/auth/approval checks are not bypassed. The defect is provenance and preservation of required sender facts, not an anonymous access exploit.

**Required correction:** analysis must never establish, replace or clear `sender_name`, `mailing_address`, or `sender_contact` from worker extraction. Retain the current saved values, including intentional blanks; leave them absent/unconfigured when no founder values exist. Only explicit authenticated founder profile editing may change/clear them. Preserve ordinary analysis facts and existing profileVersion/lease race guards. Add permanent tests for omission, blank, invented replacement and initially unconfigured identity. Re-review the immutable repair.

## Executed evidence

- `hosted-ledger-4bf4621.log/.json`: **47 Convex tests: 43 PASS, 4 FAIL**. Original new-ledger suite: **36 PASS**. Independent suite: **11 controls, 7 PASS and 4 sender-provenance failures**.
- `hosted-adapter-4bf4621.log`: **14 Node adapter tests PASS**. Covers strict bounded sender mapping, omission versus clearing, organization intent/auth/role checks, unknown/spoofed arguments and explicit no-invocation 503 for hosted outreach.
- `hosted-typecheck-4bf4621.log`: copied Convex source **strict focused TypeScript check PASS** (`noEmit`). First copy-only check lacked its existing `lib/types.ts` dependency; adding an unchanged copy repaired that harness omission. Initial diagnostic log is preserved as `hosted-typecheck-4bf4621_initial-copy.log`; this was not a product error.
- All **30** copied Convex source files hash-match the immutable worktree. A separate unchanged `lib/types.ts` was copied for typecheck. No dependency installation occurred; the outside-tree review copy links to existing continuation node_modules. Product worktree remained clean.

Commands (Node runtime and dependency paths are existing local installations):

```text
node <continuation/frontend/node_modules/vitest/vitest.mjs> run --config <work/review-probes/vitest-hosted-4bf4621.config.mjs> --reporter=verbose --reporter=json --outputFile=<outside-tree report>
node --experimental-strip-types --test frontend/tests/api-adapter.test.ts
node ./node_modules/typescript/bin/tsc --project tsconfig.review.json
```

Review copy and independent test: `work/review-probes/hosted-review-4bf4621/convex-tests/outreach-ledger-independent.test.ts`. Source copied into that directory is unchanged; only its added independent test/config files differ. Tests stub fetch to throw on any external invocation. No Convex dev/push, Docker, worker or external connection was run.

## Independent passing safety controls

1. Unsupported roles, malformed compact organization claims, conflicting legacy/compact claims and pending identities cannot read or mutate the ledger.
2. Three-contact company exercise: a reply pauses sibling cold work; no explicit resume means no approval. Explicit resume drops approval and a new approval may establish one cold owner. A second cold owner is refused. Replaying an earlier resume after another company reply returns the **current paused state**, not stale authorization. No permanent company lock was imposed beyond OWNER_CONTRACT.
3. Deferred bounce classification after changing the current recipient invalidates the **original inbound address**. Later interested correction/resume cannot rehabilitate that address.
4. Opt-out and source-question suppressions independently survive classification correction, recipient edit, explicit resume and a later search at the same company.
5. Malformed private contact-source input and invalid changed-send report roll back all observed thread/history/request-counter state atomically.
6. Reverting saved business facts to earlier literal values and replaying the old approve request does not restore approval; monotonic profileVersion keeps it stale.

The opt-out/source-question parameterized cases count as two executed tests, yielding seven passing independent cases.

## Source/standard assessment

- Registered new functions use internal wrappers, argument/return validators and generated imports. Wrappers derive principal/role from `ctx.auth.getUserIdentity`; expectedOrgId is only an intent comparison. Reads check resource ownership before returning current view/replays. Mutations require admin. Tests simulate verified identity shapes; they do not establish real Clerk issuer/JWT deployment configuration.
- Added tables are additive. Existing populated profile validators gain optional fields, avoiding a required-field deployment deadlock. Threads, messages and approvals are separate indexed documents. All new ledger reads use indexes and bounded takes; counters bound 100 threads, 50 messages and 10,000 operations. There is no new unbounded collect in this delta.
- Exact approval binding includes recipient/text/basis/latest-inbound/reply state, revision, profile and company versions. Replays return current views; immutable approval and actual changed-sent messages remain separate. Opt-out/source-question/domain and bounce-address authority is durable and tenant scoped. Company version/cold owner and ledger request counters share transactional mutation state.
- No provider, transport, scheduler, mailbox, AI or monetary dispatch is introduced by the ledger. The price/cost gate is **not implemented for hosted operation** and is not falsely inferred from the local ledger. Default-off internal functions plus closed REST keep that boundary intact.
- Contact basis uses public URL validation, exact email/role/notice/US-Canada requirements and original wall/offset validation. Publication is conservatively unverified; no contact basis is inferred by starting a row. The separately reported first-invalid-contact/valid-alternate selection issue is owned by the other reviewer/root and is not independently signed off here.

## Remaining scope and limits

**Fix the sender provenance boundary before signing off the new hosted slice.** No new tenant leakage, stale-approval restoration, double-cold-owner or external/cost dispatch bypass was reproduced in these controls.

`view` currently computes reviewDue with Date.now inside an internal query. Per the Convex checklist, this is not a reactive clock: time passing alone is not a subscription invalidation. Before a live due-work UI consumes this value, supply a caller clock bucket or another explicit refresh/timer projection and test that journey. Hosted Next up/scheduling is explicitly unbuilt, so this is recorded as an unverified future-consumer boundary rather than a claim of a currently enabled broken queue.

Start currently validates owned completed search membership/non-demo records rather than the entire local strong-match predicate. Full hosted eligibility, referrals/followup scheduling, meetings/outcomes, closure/export/retention, Next up/funnel, adapter/UI parity and shared hosted/local monetary authority remain outside this foundation. They must be reviewed before opening the adapter; current source/mock checks are not parity acceptance.

Offline convex-test/OCC races prove intended transaction assertions, not the deployed Convex service. No real JWT, remote schema migration/codegen, subscription reactivity, browser/device/keyboard/accessibility, worker/provider quality, live rates/history, connected inbox/calendar, delivery, privacy/legal clearance or production deployment is certified. The explicit no-deployment boundary supersedes the skill's live-push/smoke suggestion; no such action was attempted.
