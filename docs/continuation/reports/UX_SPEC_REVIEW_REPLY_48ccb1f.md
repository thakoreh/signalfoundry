# Grounded reply UX/spec review: 48ccb1f

Reviewed 2026-10-21, clean detached `worktrees/legal-review` at `48ccb1f90657b07c9bf87636ad73519308724b4b`; diff baseline `7e815a8`. Root remains sole product writer. Evidence is source review, fictional backend tests and React/jsdom tests using existing dependencies through external configs/cache. No browser, owner profile/data, network/provider/account actions, paid calls, messages, installs or product changes.

## Verdict

The implementation substantially follows the ce37b6c Appendix contract: explicit context consent; eligible manually classified replies; bounded actual-history context; tenant/snapshot-bound cache and apply check; separate reply monetary operation; editable output with no save/approval/send. **Two concrete parent/scope failures remain**, reproduced below. Existing focused regressions pass but do not cover these paths. No rendered desktop/mobile acceptance is claimed.

## P1 — suspended sender-repair scope can still apply a delayed reply

`frontend/components/outreach-workspace.tsx:840` supplies a ReplyCopilot key/disabled predicate containing saved revision, profile and dirty/busy flags but omitting `suspended`. Sender repair hides this workspace without unmounting it (`customer-workspace-screen.tsx`). The parent aborts its own API/Copy scope on suspension, while ReplyCopilot owns a separate controller.

**Real-parent component probe:** establish a reviewed question, explicitly consent, request a fictional suggestion, click Use as editable reply, and delay its `/reply-draft/check`. Rerender the real `OutreachWorkspace` with `suspended=true`, then resolve the ignored-abort check as current.

Observed: check signal **not aborted**; editor changes to `AI reply stays editable.` plus saved footer while suspended. Stored thread stays unchanged, so this is a stale UI-application failure rather than a provider send or database mutation. It violates the promise that saved-business/scope changes revoke pending editor intent.

Required outcome: suspension must revoke/remount or disable the copilot's request/apply scope and reject late results. Preserve the parent’s unsaved message and pasted-reply text; do not solve this by resetting the whole workspace. Regression must use the actual parent wiring, not only a standalone manually changed child key.

## P1 — same-key refreshed thread abort leaves copilot permanently busy

`reply-copilot.tsx` aborts its controller in `useLayoutEffect` cleanup when the `thread` object changes, but an aborted request's `finally` skips `setBusy("")`. Parent key uses semantic fields/dirty booleans rather than the thread reference. A fresh read can replace the object with identical saved data without remounting the child.

**Real-parent component probe:** start delayed generation; suspend sender repair then resume without saving a profile change; parent reloads identical thread data into a new object; resolve the old ignored-abort generation.

Observed: controller is aborted, editor remains private/unchanged, but disabled **Preparing suggestion…** stays indefinitely. There is no error/new-attempt control because no failure was surfaced. The copilot recovers only by leaving/remounting its view, which contradicts a short return/edit session.

Required outcome: intentional scope cancellation must leave the current scope in a usable idle state (or remount the suggestion-only child) without allowing an old finally callback to clear a newer flight. Cover same-key object refresh as well as suspension, and retain private editor text.

## Contract comparison and limits

| ce37 Appendix requirement | Actual source/evidence |
|---|---|
| Explicit request; reviewed interested/question only | `ReplyDraftRequest` requires strict true confirmation and disclosure version. Backend snapshot rejects other reply states, mismatched/latest non-inbound recipient, pause/suppression/conflict, missing sender/basis/offer. Tests cover taxonomy and consent denial with zero generation. |
| Actual reported history, not unsent approved content | Snapshot uses last six `ConversationMessage.body` values and latest inbound; changed-sent actual text is retained. Saved offering and up to five public excerpts are bounded; subject is inherited. Context is not the unsaved editor. |
| Disclosure matches data sent | UI/privacy describe offering, excerpts, up to six recorded messages including latest inbound, DeepSeek transmission, pattern removal and non-anonymization. Backend omits contact-list/address fields and strips common email/link/phone patterns. Names/unrecognized sensitive text can remain and the copy admits that limitation. No claim of perfect redaction or legal permission. |
| Immutable tenant/fact/history/model cache | Server key binds tenant, model/version, saved profile, full thread/source/current context and inbound. Profile changes without revision invalidate it. Existing draft storage/quota is shared; cached complete results can reopen with zero model calls, including feature-off state. |
| No invented terms; grounded, editable output | Output validates known fact IDs, numeric tokens, destination/contact patterns, word bounds and unapproved price/discount terms. Prompt forbids fabricated facts/prices/availability/meetings and treats context as untrusted. These are review aids, not semantic proof; supplied fact IDs can still accompany an unsupported paraphrase, which the warnings correctly leave to founder judgment. No booking link is generated. |
| Fresh checks before generation and apply | Server guard participates in monetary reservation transaction and checks again before saving the result. `/check` validates snapshot without a model call. Child also rechecks before Apply. **The two parent cancellation holes above prevent full UI acceptance of this requirement.** |
| Exact approval, handoff and manual report remain separate | Apply fills only private subject/body with current footer. Existing tests assert no `/draft`, `/approve` or `/sent` mutation until separate action and no clipboard/mail handoff. It does not automatically mark a prospect contacted. |
| Reserve before provider dispatch; bounded retries | `deepseek:reply` is separately admitted using token/model bounds and credential identity. Missing policy/history, uncertain exposure and closed/quarantined states deny dispatch. Measured failed/stale work is not refunded; no automatic retry/fallback. Tests cover duplicate dispatch once, unknown history, pricing rejection and stale/paused/closed outcomes. Actual provider/account monetary acceptance remains gated and untested live. |

Cache/retry copy is explicit that cached reopening is free of additional provider calls and a new attempt may incur admitted usage. Manual writing remains available. The disclosure is inline before checkbox/request and the optional claim inspection avoids reinstating the rejected generic Research details default.

## Executed evidence

- Existing focused React suites: **5 files / 76 tests passed**, 1.70s: outreach parent, reply-copilot, saved work, Next up, local-data controls. Config: `work/review-probes/vitest-reply-existing-48ccb1f.config.mjs`, source root immutable legal-review frontend, external cache; no dependency links/install.
- External real-parent adversarial tests: `work/review-probes/reply-parent-probe-48ccb1f.test.tsx`, copied existing fixture harness with two added cases. Combined run **129 passed / 2 failed**; that count includes duplicate original parent tests and must not be described as 129 unique new checks. Both failures are the findings above. Generator script/config remain outside the product tree.
- Backend: `python -m unittest tests.test_reply_drafts tests.test_local_journey -q` — **34 passed** in 5.425s, fictional temporary SQLite/model transports only, using root interpreter and `PYTHONPATH=legal-review/backend`. Existing Starlette/httpx deprecation warning only.
- Worktree remains clean. Author's broader full suite/build figures were supplied by root and were not independently rerun here. No visual/browser, real DeepSeek, mailbox/delivery or public production evidence is implied.

Fix the two scope paths and rerun these external probes plus existing parent/copilot regressions on a fresh immutable checkpoint before closing this review.
