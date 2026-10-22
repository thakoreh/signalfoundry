# Repaired reply copilot — scoped PASS

Exact immutable checkpoint: `eea1d6c839a6001ac356378c4536639ea0d22ffc`, clean detached `worktrees/policy-review`. Recheck delta `48ccb1f..eea1d6c` plus the earlier independent safety controls. Baseline findings/raw evidence in `SECURITY_REVIEW_REPLY_48ccb1f.md` are preserved. This report supersedes their unresolved status for the two reproduced examples, not the full-product/integration limitations.

All reviewer probes/reports and fictional temporary databases are outside product source. No product edits/push, owner data/env access, provider/paid/account/send action, browser, application listener or external service. TestClient runs in-process; provider requests use MockTransport. Real HTTP transports, socket connections and subprocess creation are denied by the harness. Synthetic pricing/history/credentials are not operator authorization or real provider evidence.

## Independently executed results

- `reply_independent_eea1d6c.py/.json/.log`: **12 independent controls PASS**, exit 0.
- `reply_author_eea1d6c.log/.json`: **24 existing reply tests PASS**, exit 0.
- `reply_focused_eea1d6c.log/.json`: **31 existing monetary admission/initial draft tests PASS**, exit 0.

Total: **67 passing offline tests** in these three runs. The full backend/frontend/build/HTTP/preflight figures reported by root were not rerun or promoted to independent evidence here. Existing Starlette/httpx deprecation warning only; no failed product assertion in this recheck. Worktree remains clean at the exact SHA above.

## Prior findings resolved

### P1 latest received question omission — repaired

`minimize` now permits complete pattern-removed text, and snapshot places the full supported latest inbound in `latest_received`. Earlier history is explicitly marked as excerpts. The original **2872-character** counterexample now transmits its final `MY_ONLY_QUESTION`, with complete equality to the input in this no-redaction fixture, and returns HTTP 200 after one mocked admitted dispatch.

An additional independently constructed **6000-character** valid received reply transmits all 6000 characters and its final question. This valid input is not unnecessarily rejected. A saved legacy **6001-character** reply is preserved but rejected with 409 **before any business request reservation or paid attempt**; no transport occurs. A valid 6000-character Unicode fixture whose JSON-encoded payload exceeds the monetary 40KB bound gets `COST_BLOCKED`/503 and **zero paid attempts/transport**, preserving its full saved message rather than silently clipping it.

Prompt/cache version is now `grounded-reply-v2`; consent is `reply-context-v2`. The old v1 consent request receives 422 with zero cache requests/paid attempts/transport. Source inspection confirms the changed version participates in the cache digest; old request bindings cannot silently become a new paid attempt for v2 input. UI/privacy copy now distinguishes history excerpts from the complete supported latest received message.

### P2 prospect number accepted as a plain seller price — reproduced example rejected

The validator now detects plain pricing/rate/fee/cost/charge/subscription/period language with numeric values, independently of numeric support in cited facts. The exact former example `Our pricing is 49 per month. Let us know if that works for you.` citing a saved fictional prospect fact about 49 properties is rejected both directly and through the complete API/MockTransport path. API returns 409; measured synthetic usage still settles (`settled`, 140 micro-USD), while the suggestion cache is failed with no payload. It does not refund or retry the unusable model result.

The original source's semantic limits remain: lexical checks and citation membership are **not** a proof that arbitrary natural-language terms/capabilities/prices are truthful or supported. Founder review remains necessary; this recheck confirms the concrete numeric-pricing bypass was repaired and does not certify a universal natural-language price detector.

## Original independent safety controls retained

1. Foreign tenant cannot read the cached result or generate for the original tenant's thread; no foreign request row appears.
2. Reusing one key for a different eligible thread conflicts with no extra dispatch.
3. Closure immediately before monetary admission produces zero paid attempts/transport and no payload resurrection.
4. New inbound immediately before admission produces zero paid attempts/transport.
5. Company-domain suppression added without changing the target revision invalidates cached/check reuse and causes no new dispatch.
6. Invalid output after an inflight new inbound still settles measured usage, keeps the business cache failed/no payload and rejects replay; no approval or thread text is revived.

Existing 55 tests additionally retain shared draft quota, per-request/snapshot deduplication, cached reopening with flags/keys off, profile hash invalidation without a revision bump, admission guard ordering, late-result closure/opt-out handling, token-priced reply catalogue separation, credential identity, global/tenant allowance races, uncertain exposure and operator receipt locks. They are evidence for their assertions, not live provider behavior.

## Verdict and limits

**Scoped PASS: no unresolved P0/P1 or the reproduced P2 remains in this reviewed repair.** No further source correction is requested from these controls.

The admission guard's transaction is the local ordering boundary. A later stop cannot retract an already admitted/transmitted request; incurred usage must settle and stale result application remains blocked. There is no DB lock across IO and no guarantee that aborting a browser request cancels billing. Read-only Apply checking is current-context validation, not approval or proof of model truth; exact Save/Approve/manual handoff remains separate.

No real provider rate/history/policy was accepted. US$25 includes prior DeepSeek usage that still needs reconciliation; Ads allocation remains unresolved. Shared authority is one SQLite database, not global enforcement across disconnected copies or hosted runtimes. No hosted reply parity, privacy/legal clearance, live model quality, rendered Chrome/mobile/keyboard/accessibility, mailbox/calendar connection, external delivery, production deployment or complete product readiness is certified. Those gates remain unchanged.
