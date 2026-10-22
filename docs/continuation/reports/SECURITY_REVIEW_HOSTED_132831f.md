# Hosted ledger repair — scoped PASS

Exact immutable checkpoint: `132831f751f0fc5d2c7793d62b0923c387a31eb6`; repair delta `4bf4621..132831f`. Clean detached `worktrees/policy-review`. The original `SECURITY_REVIEW_HOSTED_4bf4621.md`, source copy and raw failures remain unchanged. Root is sole product writer; reviewer changes are confined to outside-tree probes/reports.

Convex expert/reviewer checklists from the prior pass remain applied. No deployment/code push, real Clerk/JWT/account lookup, owner files/env/database, browser, worker/provider/send/paid/network action. Tests use an isolated convex-test database and fetch that throws if invoked. The new functions remain internal, default off; SaaS outreach REST still returns 503 with no local/Convex invocation.

## Independently executed results

- `hosted-ledger-132831f.log/.json`: **56 Convex tests PASS**, comprising **43 permanent hosted-ledger tests and 13 independent controls**. The 13 retain all 11 original controls, including all four former sender failures, plus explicit owner-blank preservation and stale inflight-analysis conflict.
- `hosted-adapter-132831f.log`: **14 Node adapter tests PASS**.
- `hosted-typecheck-132831f.log`: **focused strict copied-Convex TypeScript check PASS**, noEmit.
- All **30 Convex source files** in `hosted-review-132831f/convex` hash-match the exact immutable worktree. Its copied `lib/types.ts` is an unchanged dependency; only added independent tests/configuration differ. Existing dependencies are linked without installation. Worktree remains clean.

Total executed here: **70 passing offline tests**, plus focused typecheck. Root's full-suite/CI/production claims, if any, are separate evidence and were not adopted from these narrower runs.

Commands:

```text
node <continuation/frontend/node_modules/vitest/vitest.mjs> run --config <work/review-probes/vitest-hosted-132831f.config.mjs> --reporter=verbose --reporter=json --outputFile=<work/review-probes/hosted-ledger-132831f.json>
node --experimental-strip-types --test frontend/tests/api-adapter.test.ts
node ./node_modules/typescript/bin/tsc --project tsconfig.review.json
```

Independent fixture: `hosted-review-132831f/convex-tests/outreach-ledger-independent.test.ts` under this report's outside-tree directory. Original fixtures are manufactured; no owner workspace was read or seeded.

## P1 sender provenance — repaired

`workspaces.finishAnalyze` now removes every worker-supplied sender name, mailing address and reachable contact before validation, then copies only the current saved owner fields. It retains the existing profileVersion/lease checks and normal inferred business facts. Explicit authenticated `saveProfile` remains the only tested path that establishes, changes or clears the sender fields.

Exact former counterexamples now pass:

1. Worker omission retains all saved owner sender fields.
2. Worker empty strings cannot clear existing owner sender fields.
3. Invented worker values cannot replace existing owner sender fields.
4. Invented worker values cannot establish previously empty identity: the projected footer stays empty and a normal prepared-message approval attempt stays blocked.

Additional independent controls confirm explicitly saved empty strings remain empty after plausible worker extraction, and a newer owner name/address/contact/offering edit while analysis is inflight causes completion to conflict while preserving the entire newer workspace result unchanged. The fix does not defeat the version/lease safety guard to preserve identity.

## Safety/regression controls retained

- Invalid/pending/conflicting role/organization identities cannot read or write. Expected-org intent, tenant resource ownership, member/admin distinctions and closed REST adapter assertions remain green.
- Three same-company contacts still require an explicit founder resume and new approval; no two cold owners become ready. A replayed old resume after another company reply returns the current paused view. No permanent company lock beyond the literal owner contract was introduced.
- Deferred bounce correction after recipient replacement still targets the original inbound address, surviving correction/resume. Opt-out/source-question stops remain sticky across corrections, recipient edits, resumes and new searches.
- Invalid source-basis or changed-send input still rolls back thread/history/request counter state. Literal restoration of older profile values cannot restore an older approval version. Actual reported text remains separate from immutable approval history.
- The permanent suite also passes valid-alternate-contact selection and named-IANA zone controls added for the other reviewer's findings. Source checks confirm malformed addresses are removed before ranking candidates, preserving conservative unverified status; raw offset-only timezone strings are rejected before Intl validation. These fixes add no transport or provider calls.

## Verdict and remaining boundaries

**Scoped PASS: the reproduced sender P1 is repaired, with no new P0/P1 established in this delta.** No further source correction is requested from these controls.

This is still an internal hosted manual-ledger foundation, not full hosted lifecycle parity. REST outreach remains closed. Hosted referrals, bounded followup scheduling, meeting/outcome audit, Next up/funnel, closure/export/retention, full local strong-match eligibility and shared hosted/local monetary authority remain future work. Do not enable external surfaces or paid dispatch on this review's strength.

The earlier query-time reviewDue/Date.now refresh concern remains recorded for a future reactive due-work consumer; it is not silently promoted to verified subscription behavior. Offline convex-test races are not deployed OCC/JWT/migration evidence. No remote codegen/deploy/auth verification, actual provider rates/history, live inbox/calendar, external delivery, rendered Chrome/mobile/keyboard/accessibility, privacy/legal clearance or production readiness is certified. The explicit no-deployment boundary continues to supersede the skill's live-push/smoke suggestion.
