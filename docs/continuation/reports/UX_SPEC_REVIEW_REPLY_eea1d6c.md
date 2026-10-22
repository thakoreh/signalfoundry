# Grounded reply UX/spec recheck: eea1d6c

Reviewed 2026-10-21 at clean detached `worktrees/legal-review`, immutable commit `eea1d6c839a6001ac356378c4536639ea0d22ffc`. Source and fictional offline component/backend tests only. No browser, owner profile/data, accounts, network/providers, paid calls, messages, installs or product writes. Probe/config/cache files remain under `work/review-probes`, outside the source worktree.

## Verdict within reviewed scope

Both P1 findings from `48ccb1f` are repaired and pass the **exact original independent real-parent probes**. Additional equivalent-object and private inbound/editor preservation probes pass. No further concrete P0/P1 was established in this bounded recheck. This closes the two reported component scope bugs for this checkpoint; it is not full UX, Chrome, mobile, real-provider, monetary-account or production acceptance.

## Reproduced fixes

| Case | Result at eea1d6c |
|---|---|
| Delay `/reply-draft/check`, suspend real parent for sender repair, then return successful ignored-abort result | Original signal is aborted; late text does not fill the editor. |
| Start generation, suspend/resume the unchanged saved thread, then resolve old response | No stranded “Preparing suggestion…” button; stale response cannot overwrite editor. |
| Replace standalone child's thread prop with an equivalent fresh object, keeping id/revision/key unchanged during generation | Signal remains active, result settles to an editable suggestion and Apply runs once after a fresh check. An equivalent object is not falsely treated as a scope switch. |
| Start generation, type private unrecorded inbound and private manual response, suspend/resume, then resolve stale generation | Old signal aborted; both private fields retain their exact text; no suggestion Apply action appears; no draft/save/approve/sent/reply mutation occurs. |

Root's added permanent actual-parent regressions cover the first two cases too. Independent probe copies remain outside the product source and were not substituted for the permanent tests.

## Source confirmation

- The parent ReplyCopilot key now includes suspension/reload, current recipient/classification, pause/suppression/company conflict/status and latest message identity in addition to saved revision/profile/private dirty-state boundaries. The disabled predicate also includes suspension. These reset only suggestion state and leave parent private fields intact.
- Child cleanup keys its controller to stable thread id/revision rather than incidental object identity, avoiding an aborted-flight busy state when a read returns semantically equivalent saved data. The parent continues to revoke intent on real context boundaries.
- Generation and Apply remain explicit and separate. Apply populates the private editor with the saved footer; exact save/approval, fresh Copy/mailto check and manual sent report remain distinct. No repaired path introduces automatic saving, approval or sending.

## Updated context/disclosure contract

The backend now retains the complete latest received body within its supported 6000-character saved-record limit after best-effort pattern removal. Older actual-history bodies remain excerpts of at most 1000 characters, and the payload marks history as excerpts. Oversized legacy received records are rejected with manual-writing guidance rather than silently losing the tail. Monetary payload bounds remain responsible for refusing excessive encoded requests before transport.

UI and privacy copy now distinguish historical excerpts from the full latest received reply and still state that email/link/phone pattern removal is **not anonymization**. Names or unrecognized private text can remain; the user is asked to review context. The disclosure version is `reply-context-v2`, and backend tests reject old `v1` consent. Prompt/cache version also advances, so the change is not silently covered by old context agreement/cache identity.

This addresses context completeness and disclosure accuracy within the inspected code. It does not establish semantic factual support, perfect redaction, permission to contact someone or acceptance of live model/account prices. The existing founder-review warning and separate monetary activation remain necessary.

## Checks actually executed

- Original independent parent-probe config rerun against immutable repair: **6 files / 133 tests passed**. This combines current focused suites with a copied original fixture harness; totals contain duplicate baseline tests and must not be presented as 133 independent new cases.
- Dedicated repair probes: **2 files / 72 tests passed** in 1.74s, comprising the fixture baselines plus the four independent cases listed above. Files: `reply-parent-probe-eea1d6c.test.tsx`, `reply-child-probe-eea1d6c.test.tsx`; config `vitest-reply-eea1d6c.config.mjs`. Existing continuation dependencies were read without installs/links; immutable legal-review source and external caches were used.
- Backend: `python -m unittest tests.test_reply_drafts tests.test_local_journey -q` — **37 passed** in 6.430s, using root's isolated interpreter with `PYTHONPATH=legal-review/backend`. These include the latest received tail, old consent rejection, pricing-language safeguards, stale output and manual lifecycle checks. All provider transports/data are fictional test fixtures. Existing Starlette/httpx deprecation warning only.
- Source worktree remained clean at the reviewed hash. Broader author suite/type/lint/build claims were supplied by root and were not independently rerun in this focused pass.

Fresh authorized rendered Chrome/phone, focus/keyboard/zoom and genuine provider/account integration checks remain separate gates. No such acceptance is inferred from jsdom or mock transport results.
