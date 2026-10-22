# Reply copilot review — fixes required

Exact immutable checkpoint: `48ccb1f90657b07c9bf87636ad73519308724b4b`; reviewed delta `7e815a8..48ccb1f` in clean detached `worktrees/policy-review`. Root remains sole product writer. All reviewer code/results are outside source in `work/review-probes`. No owner data/env files, provider/key/account access, paid call, browser, service/listener, deployment or send. Synthetic policies/credentials and `httpx.MockTransport` only; real HTTP transport, synchronous socket connection and subprocess creation are denied. FastAPI requests are in-process.

## Findings

### P1 — latest received reply can lose its only question before paid dispatch

`backend/app/reply_drafts.py:94–96` clips history messages to 1000 characters and `latest_received` to 2400. The saved inbound schema accepts 6000 characters. No oversize rejection, explicit founder-selected excerpt or truncation warning prevents the model from answering an incomplete received message.

Independent control 01 saves an ordinary **2872-character** manually classified question. Its only actual question follows repeated background beyond character 2400. The model's entire serialized user context contains no `MY_ONLY_QUESTION` marker; the history copy is also clipped. Nevertheless the request admits **one mocked paid dispatch** and returns **HTTP 200** with a usable suggestion. Earlier shorter inbound content is still present, increasing the chance that a model answers an older question. The snapshot hashes the full original, but hashing does not supply omitted text to the model.

**Required correction:** reject a latest inbound whose minimized complete text exceeds the accepted bound before cache/business/monetary admission, or require a separately explicit founder-reviewed bounded excerpt with truthful disclosure. Do not silently clip the message that defines the response. Keep manual writing available. Regression should put the meaningful question at the end and assert either its complete presence in context or zero dispatch with a clear bounded-input error.

### P2 — plain monthly seller pricing passes using a prospect number

`backend/app/reply_drafts.py:139–145` rejects currency symbols, USD/CAD/dollars/discount/free and some percentage forms. It does not reject plain pricing assertions such as `Our pricing is 49 per month`. The numeric-support check accepts a cited **prospect** fact's `49` as support for that seller price despite no approved price catalogue.

Independent control 02 adds the fictional public prospect fact `The prospect operates 49 properties.` to the saved thread, then supplies the mocked output `Our pricing is 49 per month. Let us know if that works for you.` citing that prospect fact ID. Both direct validation and the full service/API path accept it: **one mocked dispatch, HTTP 200**, generated price displayed as a suggestion. This is a concrete omission in the promised deterministic no-unapproved-price check, distinct from claiming all natural-language factual support can be proven by regex.

**Required correction:** explicitly reject plain pricing/rate/cost/periodic-plan terms in the no-catalogue scope, and prevent prospect numeric facts from serving as seller-price authority. A bounded fixed needs-founder-confirmation path for pricing questions is also safe. Add this exact example and ordinary no-currency rate forms; retain the disclosure that the resulting checks still do not prove semantic truth or consent.

## Executed evidence

- `reply_author_48ccb1f.log/.json`: **21 existing reply tests PASS**, exit 0.
- `reply_focused_48ccb1f.log/.json`: **31 existing cost-admission/initial-draft tests PASS**, exit 0. Includes legacy/operator receipt locks, cap races, key rotation, uncertain restart/month rollover, shared cache/idempotency and introduction transport regressions.
- `reply_independent_48ccb1f.py/.log/.json`: **8 independent controls: 6 PASS, 2 FAIL**, exit 1. The two failures reproduce the findings above; JSON records context length, dispatch count/status and accepted price content.
- The first focused attempt had one `unable to open database file` error when a 100-row fixture update needed a SQLite temporary file after the reviewer's environment whitelist removed TEMP/TMP. The harness now sets both to the outside-tree probe directory; all 31 pass. Initial diagnostics are preserved as `reply_focused_48ccb1f_initial-harness.log/.json`. No product test/source was changed for this correction.

Independent passing controls:

1. A foreign tenant cannot retrieve the cached result or generate against the original tenant's thread; foreign cache rows remain absent, original dispatch count stays one.
2. Same request key applied to a different eligible thread conflicts before another provider dispatch.
3. Closure immediately before admission causes zero transport and zero paid attempts, with no cached payload resurrection.
4. A new inbound immediately before admission causes zero transport and zero paid attempts.
5. A company-domain opt-out recorded without incrementing the target thread revision blocks cached/check reuse and creates no further dispatch.
6. Invalid provider output arriving after a new inbound still settles the measured synthetic usage (`settled`, 140 micro-USD), leaves the business cache failed with no payload, and rejects replay rather than refunding/retrying.

## Boundaries that currently look sound

- Snapshot includes full saved profile/thread plus projected context; profile changes on unapproved threads therefore invalidate output even when revision stays unchanged. Current projected suppression/company/recipient state is rechecked, not inferred from revision alone.
- Current latest inbound recipient must match the thread recipient. Only the most recent saved inbound with an eligible active classification may generate; reported outbound after it requires another inbound. No generation mutates the thread, approval, classifications, stop state or outcomes.
- Borrowed cache transactions make snapshot validation and reservation ordered under one `BEGIN IMMEDIATE`. Existing cache/request tables already participate in export/erase/closure triggers, avoiding an unguarded new payload table. Request keys and snapshots are tenant scoped; owning-request/status CAS prevents stale completion from replacing a retry.
- The trusted application guard runs on the monetary ledger's own transaction/connection before reservation, so a stop/facts change ordered before admission prevents the paid claim. No lock spans IO. A later stop is honestly an already-admitted in-flight attempt; result is discarded after recheck, while usage remains accounted.
- `deepseek:reply` is separate from introduction in the operation catalogue and uses the token quote branch with pinned model/600-token bound. Missing reply catalogue, history, policy, credential binding, cap, closure or uncertain exposure denies transport; no accepted real prices/history/authorization were added by implementation or this review.
- Shared fixed-host transport preserves no proxy/redirect/fallback, bounded body/time and usage settlement before model-output validation. Extra structured fields/unknown citation IDs, destinations and several obvious unsupported numeric/pricing forms are rejected. These controls are not complete semantic verification.
- The read-only `/reply-draft/check` compares current context rather than approving content. UI applies only to the private editor and retains distinct Save/Approve/manual handoff. Hosted/public/local-off branches are denied. This source assessment is not a new rendered/UI-race acceptance claim.

## Verdict and limits

**Do not sign off this exact reply slice until P1 is repaired and the plain-pricing P2 is resolved.** No new tenant leak, cost refund, unknown-history paid bypass or closure resurrection was established in these controls. Existing checks passing do not supersede the independent counterexamples.

Re-review a fresh immutable checkpoint with the exact counterexamples and focused impacted regressions. This review does not certify model quality, semantic truth, privacy/legal clearance, real rates/account history, cross-database/global hosted cost authority, live provider behavior, Chrome/mobile/keyboard/accessibility, connected mailbox/calendar operation or production readiness. The source tree stayed clean.
