# Independent hosted-ledger spec review: 4bf4621

Reviewed 2026-10-21 at clean detached `worktrees/legal-review`, exact commit `4bf462190ed7c75b34444e7d8c22cc2fcecb1f68`, diff baseline `1bf09f4`. Read Convex reviewer/expert instructions and schema before reviewing the new functions. Scope is **internal gated manual-ledger prerequisites**, not hosted parity or the accepted local reply copilot.

No product edits/commits, deployment/codegen push, browser/personal profile, owner data/configuration, provider/network, account or real-send actions. All mutations were fictional convex-test fixtures. External probes/config/cache are under `work/review-probes`; tracked source stayed clean.

## Verdict and actionable findings

No concrete P0/P1 was established within this bounded offline scope. **Two P2 default/input-contract defects were independently reproduced.** Neither bypasses suppression or authorizes sending. They should be corrected before these prerequisites are connected to a hosted journey.

### P2 — malformed preferred address hides a valid saved alternate

`frontend/convex/outreachLedger.ts`, `start` contact selection near lines 403–415, sorts saved contacts then validates only `contacts[0]`. A caught address-validation error clears the chosen recipient instead of trying the next valid candidate.

**Independent reproduction:** fixture prospect contacts are `[bad@@example.com, valid.person@example.com, info@example.com]`. Start an owned completed-search prospect through the actual internal mutation. Result: `recipient=""`, `recipientStatus="missing"`, despite the valid direct and shared alternates. Original search contacts remain stored, so this is a defective default/fallback rather than irreversible source data loss.

Validate each candidate first, then rank/select valid direct-style addresses before shared inboxes; if none are valid, retain the current missing-contact gate. Preserve published/unverified status and never infer permission from validity. Acceptance: this fixture chooses `valid.person@example.com`; an all-invalid fixture remains blank and cannot approve.

### P2 — numeric offset passes a validator documented as IANA-only

`frontend/convex/lib/outreachLedgerPolicy.ts`, `timezone()` near line 92, relies on successful `Intl.DateTimeFormat` construction. This test runtime accepts offset-only timezone strings too.

**Independent reproduction:** `zonedInstant("2026-11-03T10:00:00-05:00", "-05:00")` succeeds. OWNER_CONTRACT/HOSTED_LEDGER require both the timestamp's explicit offset and a separate IANA timezone; repeating the numeric offset does not establish a named timezone/DST context.

Reject offset-only zone strings before Intl validation, retaining appropriate named UTC/IANA aliases. Acceptance: numeric `-05:00` is rejected; `America/Toronto` accepts both genuine November folds and rejects a gap/mismatched original offset. This is measured local runtime behavior, not a claim about a deployed Convex runtime.

## Contract and boundary checks

| Requirement | Inspected/tested result |
|---|---|
| Internal-only, feature-gated, tenant intent and role | Exports are internal wrappers; active verified identity supplies org/role. `expectedOrgId` is compared against identity and grants no scope. Owned resources are checked before views/replays. Tests exercise missing/member/foreign/switching identity and disabled gate. No client/UI currently calls the module. |
| Profile compatibility, explicit clears | Optional sender validators preserve old profile parsing. `saveProfile` merges each omitted sender field from the current profile, while explicit blank remains a clear. Independent mixed case clears only address, preserves name/contact, then an older omission keeps the cleared address blank and approval unavailable. Profile version monotonically invalidates old approvals. |
| Exact immutable approved versus actual reported text | Approval stores recipient/subject/body/basis/profile/company binding independently. Changed-send reports store actual text with the original approval ID. Independent fixture confirms actual external edits remain separate and original approval document is unchanged. Restoring profile values does not restore readiness. Copy/check is a query, not a send or contact record. |
| Manual reply types and saved original inbound | Existing parameterized tests cover the specified states; corrections update effective thread state without rewriting the saved inbound document. Independent incomplete Not-now date fixture falls back to awaiting review, then repairs the Toronto fold and corrects to Question while original saved text/record remains identical. Cold-sequence stop stays true. |
| Sticky stops and company decision | Domain/email opt-out/source stops persist; bounce invalidity is tied to the original address. Incoming review increments company safety version and invalidates sibling approvals. Explicit resume acknowledging current company version plus a **new** approval is allowed; this matches the owner's “until founder decides” rule. It does not clear suppression. One cold owner and idempotent safety-state replay are covered. |
| Incomplete dates and original wall-time validation | Missing pair yields review work rather than an invented date. Calendar overflow, wrong offset, gap and absent-offset inputs are rejected; both Toronto folds accepted in actual tests. Offset-only timezone exception is the finding above. |
| Partial lifecycle stays closed | After a reported cold initial send, another initial cold approval is blocked while hosted bounded followup planning is absent. Referrals, meetings, Next up/funnel, hosted closure/export, AI/money/OAuth/calendar/transport remain absent/gated as documented. These are not silently implemented by the new tables. |
| REST adapter | Authenticated `/outreach` reads/writes continue returning **503** without reaching local or Convex repositories. No new hosted outreach UI is claimed. Node adapter tests also distinguish omitted/cleared fields and reject malformed/oversized sender data. |

Review data is user-reported, not independently verified address/consent, delivery, inbox/calendar or customer-outcome evidence. No real Clerk/JWT/Convex deployment or remote OCC was tested. The current `reviewDue` is a query-time projection; future reactive/time-driven hosted Next up still requires its own acceptance and is not established here.

## Commands and measured results

- Existing dependencies through external `vitest-hosted-spec-4bf4621.config.mjs`, immutable legal-review frontend root, edge-runtime and external cache. External harness copies the author fixture setup and adds independent tests; no source files or dependency links were written.
- Initial pass: **39 passed** — 36 existing hosted-ledger cases plus three independent profile/date/history/snapshot cases.
- With the two adversarial contract cases added: **39 passed / 2 failed** in 41 tests. The two failures are exactly the findings above; no tests were weakened to obtain a passing result. Probe: `hosted-spec-probe-4bf4621.test.ts`; repeatable generator: `prepare_hosted_spec_probe_4bf4621.py`.
- Runtime command: `node <existing continuation node_modules>/vitest/vitest.mjs run --config <external vitest-hosted-spec-4bf4621.config.mjs>`.
- Node: `node --experimental-strip-types --test tests/api-adapter.test.ts` — **14 passed**. Includes authenticated hosted-outreach denial, no local fallback, sender-bound validation, tenant intent/role and safe error boundaries.
- Source hash/status checked at start and end. Author's full 112 Convex suite/Node67/type/lint results were supplied by root and not independently rerun wholesale here.

## Acceptance limits

These are offline contract/safety prerequisites with two remaining P2 defects. Full hosted parity, authenticated deployed identity propagation, remote transaction behavior, actual schema push and rendered Chrome/phone journey remain unverified and intentionally unavailable. Keep the REST adapter closed and the owner feature flag unset until the separate authorization/readiness gates are satisfied.
