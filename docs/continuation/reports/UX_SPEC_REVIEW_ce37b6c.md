# UX/spec recheck: ce37b6c

Reviewed 2026-10-21 against clean detached `worktrees/legal-review` at `ce37b6c`. Source and fictional offline tests only: no owner Chrome/profile, rendered browser action, providers, keys, accounts, sends or product writes. Report/config/cache are outside the product tree. No installs or dependency links were created.

## Verdict for this bounded review

The two ab04a85 P1 findings and its Answer-routing P2 are repaired and their focused component regressions pass. No new concrete P0/P1 was established here. This is local source/offline acceptance of these changes, not desktop/phone, hosted, privacy-program or production acceptance. Prior dbdac05 lifecycle checks remain scoped to their reviewed boundaries.

| Prior finding | Recheck evidence |
|---|---|
| Older conversations inaccessible after recent ten | `saved-outreach.tsx` now provides Show all and company/email search. Filtering is applied before the recent-ten limit and searches all saved threads. Regression finds an older conversation outside the initial ten and its correct saved URL. |
| Cleared timing fields keep actions disabled | Meeting/followup/return date editors have explicit per-purpose cancel actions. They remove only the relevant draft state; pending guidance explains why actions are blocked. Regression enters and clears a meeting date, cancels it, preserves unrelated private message text, saves that text and restores approval eligibility without reporting a booking. |
| Answer opens Review rather than Conversations | `next-up-queue.tsx` maps both `review_reply` and `answer_reply` to `view=Conversations`; routing regression passes. |

## Local data and privacy truth

- `LocalDataControls` requests export only after the explicit button; opening home does not export or start paid work. It stays absent in hosted mode. Failure/unmount cases do not claim a prepared download. User-visible copy identifies contact/manual-report contents.
- The route is local-only, returns an attachment and no-store handling, and reads one tenant snapshot. Tests verify other-tenant/global monetary catalogue exclusion and no newly created work.
- `LOCAL_DATA_OPERATIONS.md` and `/privacy` distinguish logical erasure/closure from disk wiping, external mail deletion, separate exports/backups and a completed production retention policy. Suppression/financial/closure authority is retained. There is no casual Reset/Delete button suggesting that spending or opt-outs can be reset.
- Backup/restore documentation correctly describes a new quarantined drill, not live activation. Tests use fictional files, refuse overwrite, preserve the original authority, retain financial exposure and suppression, and deny app writes/paid admission from the restored drill.
- Exported files are a separate copy requiring the owner's handling; this work did not execute an operation on owner data or establish a public privacy program.

**P2 copy clarification before public use:** `/privacy` says not to upload “personal contact data,” while the same page and actual workflow permit contact details and pasted replies; a public professional email can identify a person. Clarify the intended allowed public professional information and disallowed private/unnecessary personal or sensitive information. Do not describe this as legal clearance or silently expand data collection. Current staging/privacy-process limitations remain plainly disclosed.

## Focused checks executed

- React/jsdom: **4 files, 59 tests passed** (`saved-outreach`, `outreach-workspace`, `next-up-queue`, `local-data-controls`) in 1.70s. Existing continuation dependencies were used through `work/review-probes/vitest-ce37b6c.config.mjs`; test root points to this immutable legal-review frontend and cache is outside the tree. This is DOM/component evidence, not visual/browser evidence.
- Backend: `python -m unittest tests.test_outreach tests.test_local_journey tests.test_local_data tests.test_contact_basis -q` — **62 passed** in 7.370s. Root's isolated interpreter; `PYTHONPATH=legal-review/backend`. All databases/files are temporary fictional fixtures. Existing Starlette/httpx deprecation warning only.
- Node: manual-email, claim-review and customer-search-order tests — **12 passed**, including source-link safety, exact encoded handoff/fallback and conservative literal claim labels.
- Worktree status remained clean. Rendered desktop/390px/320px, focus, keyboard/IME, zoom and actual email-app compatibility are still pending separate authorized review.

## Appendix: proposed grounded editable AI reply contract

This is a **future implementation contract**, grounded in the current owner requirements and source seams below. It is not a claim that reply AI exists. At this checkpoint `/reply-draft` remains disabled; the monetary operation catalogue does not include a priced reply operation.

1. **Explicit allowed action.** Only a founder-requested response to the latest manually classified `interested` or `question` inbound may generate. An unreviewed/uncertain reply requires human classification first. `not_interested`, opt-out, source question, bounce, auto-reply, referral and snoozed `not_now` states do not trigger an AI answer or restart cold work. A due snooze opens review; it does not imply renewed permission. Referral uses the separate contact/basis flow. No automatic send, classification correction or meeting report.

2. **Immutable input and cache binding.** Capture tenant, thread/contact, revision, latest inbound id/body/classification, actual reported outbound history (including changed-sent text), approved business facts/version, cited prospect excerpts/version, model and prompt/schema version. Bind request idempotency and cached result to that exact snapshot. Never use an unreported approved message as proof it was sent. Bound/minimize/redact the conversation payload; explain that selected pasted reply text will go to the model before enabling this feature, since current privacy copy describes initial drafts only. Treat all incoming text/pages as untrusted data, never tool/system instructions.

3. **Grounded editable output.** Return bounded structured subject/body and cited supplied fact IDs; do not invent prices, discounts, product capabilities, prior promises, identities, buying intent, results or availability. Pricing answers require explicit approved price facts; absent facts produce an honest question/needs-founder-review result. A booking link is offered only after interest, not merely a general question. No invented appointment. Source IDs and numeric checks support review but are not proof of truth or complete semantic verification. An AI result starts unapproved and never overwrites private edits.

4. **Staleness and suppression.** Recheck current tenant/contact/revision/latest inbound, pause, suppression, company ownership, contact basis and workspace closure both before dispatch and before applying a result. A new inbound, recipient/profile/fact edit, opt-out or pause makes the result stale. Retain any incurred usage honestly but do not attach stale text as the current draft. Applying, saving and exact-content approval remain distinct; Copy/mailto revalidate current readiness. Existing durable opt-outs are never removed by generation or classification changes.

5. **Pre-dispatch money.** Add a separately named reviewed/priced reply operation rather than pretending it is an intro or accepting a flat quote for a token-billed model. Use accepted current model/input/output bounds and billing-identity binding; reserve in the shared global and tenant authority before network dispatch. Count existing DeepSeek usage inside the US$25 total monthly ceiling, reconcile prior usage, bound payload/tokens/timeouts/concurrency/attempts, settle measured usage and retain uncertain exposure. Missing/disabled policy, unknown exposure, closed/quarantined workspace or exhausted allowance means zero provider dispatch and a usable manual editor. No paid call on home, refresh or cache reopening; no silent retry or fallback subscription. Scope daily limits only if explicitly configured rather than inventing a fresh allowance.

6. **Minimum acceptance fixtures.** Assert zero dispatch for every blocked reply type/suppression/stale snapshot/cap state; tenant-isolated cache/idempotency; rejection of unsupported fact IDs and invented numeric/price content; new inbound/profile edits during a delayed response cannot overwrite text or revive approval; duplicate requests do not spend twice; failed or uncertain usage remains accountable; reopened cached results cause zero calls; exact manual approval/handoff/report flow still works.

**Repository sources:** `docs/continuation/OWNER_CONTRACT.md` reply-type rules and lines 54/80/104/106/112; `backend/app/outreach.py` classification, exact approval, source facts and disabled reply route; `backend/app/customer_drafts.py` bounded facts, untrusted-input prompt and structured validation; `backend/app/cost_admission.py` operation allowlist, quote/reserve/run/settle and uncertain-exposure gates; `backend/app/local_data.py` closure/quarantine; `frontend/components/outreach-workspace.tsx` private drafts, current readiness and manual handoff; `frontend/app/privacy/page.tsx` existing initial-draft disclosure. These justify the proposed seams and constraints, not permission to call a provider or enable external transport.
