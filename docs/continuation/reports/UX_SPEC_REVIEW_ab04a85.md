# UX/spec review: ab04a85

Reviewed 2026-10-21 against clean detached `worktrees/legal-review` at `ab04a85`. Scope: returning home/Next up/saved work, exact mailto/Copy handoff and manual reports, timing edits, claim-review labels, shared inboxes and recipient time against `docs/continuation/OWNER_CONTRACT.md`.

**Evidence boundary:** source review plus fictional offline API/unit checks. No browser action was authorized for this pass, so there is **no rendered desktop/mobile, keyboard, zoom or screen-reader acceptance**. No product edits, provider calls, keys, accounts, messages or owner data were used.

## Actionable findings

### P1 — older sent conversations lose their normal return path

`frontend/components/saved-outreach.tsx` sorts all saved threads then takes only ten, with no Show all, search or pagination. Its overflow text says other *due* work appears in Next up. A sent thread with no pasted reply, body or due date is intentionally absent from Next up. `customer-search.tsx` retains only one last-search link, not a searchable history.

**Offline reproduction:** seed 11 fictional previously sent conversations across distinct historical searches, with the first thread older than the others. GET `/outreach` returns 11. The oldest is absent from the recent-ten projection and from `/outreach/next-up` (zero items). GET by its already-known id still returns 200. Therefore the data exists, but the founder returning to log a reply to an older contact cannot discover it through the home page without retaining its URL/browser history.

This breaks day-two work at ordinary small scale rather than at hundreds of leads. Keep the home preview bounded, but add a small Show all saved conversations path/filter or pagination to reopen every saved thread. Acceptance: an older sent/no-due-work thread is findable from home, can be opened and accepts its new pasted reply; opening the list triggers no generation/search call.

### P1 — clearing a timing edit leaves safe actions disabled with no inline escape

Source-derived UI reproduction (not a rendered test):

1. Open a saved message/confirmation that can otherwise be approved/copied.
2. Enter anything into a Meeting timing field, then clear both timing fields and return to Review.
3. `timings[threadId + ':meeting']` remains `{at: '', zone: ''}`. `timingDirty` checks key existence, so it remains true.
4. Approve, Copy, email-app handoff and confirmation preparation remain disabled. The date cannot be saved while blank. No Cancel timing action exists. The Reload/discard button is rendered only when `error` is nonempty.

Relevant source: `outreach-workspace.tsx` timing state/`timingDirty` near lines 55/145, action guards near 164/992, timing handlers near 601/678, reload button inside the error conditional near 468. The next-action text also does not explain this pending timing condition, so it can tell the founder to approve while the button is disabled.

Add a per-purpose Cancel date edit that deletes only that timing key, or treat an entirely cleared draft as no timing edit. Explain pending date changes beside the blocked actions. Preserve unrelated message, pasted-reply and actual-sent text. Acceptance: abandoning a date edit restores eligibility for the unchanged saved message without navigating away, inventing a booking or discarding unrelated text. Keep the existing rule that a nonempty unsaved date blocks handoff.

### P2 — Answer CTA opens the wrong stage for its task

`next-up-queue.tsx` labels `answer_reply` as “Write a human answer” but adds `view=Conversations` only for `review_reply`. An answer item defaults to Review, where the Conversations-only saved offer facts and pasted-reply workflow are not presented together. The founder must find and switch tabs after using the supposedly direct action.

Route both reply-review and reply-answer items into Conversations. Acceptance: the Answer action opens the intended thread with its reply and saved offer context ready for editing; it does not generate or send anything.

## What this checkpoint supports

- A saved-profile home presents Next up before saved conversations and activity; no search/model mutation occurs merely from those read components.
- Next up now includes saved introductions awaiting approval and saved reminders needing a date, while completed negative/opt-out states do not continually demand a redundant review. Active/due actions remain explicitly manual.
- Copy and email-app handoff share a fresh server readiness check and exact recipient/subject/body/approval/footer comparisons. Edits and scope changes cancel delayed handoff intent. Opening an email app is not a sent record; explicit reports remain separate.
- Oversized/unsupported mailto content falls back to exact Copy. The subsequent prompt distinguishes Sent as approved, Sent with changes and Not sent yet. Changed reports keep actual text separate and bind their form to the original approval.
- Meeting and followup drafts now use separate timing keys. Unsaved timing and pending classification edits block handoff, and known recipient timezone display explicitly frames weekday working hours as guidance, not an optimal-send claim. Unknown timezone is not guessed.
- Shared inbox detection is a finite role-address heuristic, labelled as team-directed rather than inventing a named person. It does not upgrade verification.
- Claim labels say “Matches saved recipient text”, “Matches your saved offer” or “Needs your source review”. The disclosure correctly describes literal matching rather than factual/semantic verification; paraphrases remain for human review. The claim disclosure stays optional and does not restore the user's rejected generic Research details panel.

## Checks run

- Backend: `python -m unittest tests.test_outreach tests.test_local_journey -q` — **46 passed** in 5.133 seconds, using continuation's isolated interpreter with `PYTHONPATH=legal-review/backend`.
- Node: `node --experimental-strip-types --test tests/manual-email.test.ts tests/claim-review.test.ts tests/customer-search-order.test.ts` — **11 passed**. These cover mailto encoding/header injection/length fallback, literal source review and direct-vs-shared contact ordering without invented verification.
- Independent fixture probe: `work/review-probes/ux_spec_probe_ab04a85.py` — `saved_count=11`, oldest still stored, absent from recent ten and Next up, direct GET 200. Fixture insertion models historical saved work across searches, not 11 new paid searches in one session.
- Existing React component tests were inspected, not executed here: this worktree has no `node_modules`; no installs or product-tree dependency links were created. Existing component coverage includes handoff revalidation and Copy fallback but does not establish the timing-cancel or old-thread discoverability paths above.
- Source worktree remained clean. Existing Starlette/httpx deprecation warning only.

## Scope verdict

The exact handoff and honest review labels are supported by this bounded evidence. The two P1 day-two usability paths require correction and focused regression coverage. Rendered desktop/390px/320px, focus, phone keyboard and 200% zoom remain pending; this is not full UX acceptance, hosted readiness or a replacement for the separate cost/security review.
