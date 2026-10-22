# Scoped standards / security / cost review — c118b3f

Tested source: `c118b3f76710e7a5e369cbc84e173820749f9ae6`, detached clean `worktrees/policy-review`; baseline `626093dc56a49af0fb1534785f217b9817fbf07b`. Diff command: `git diff 626093d...HEAD`; one commit, “Fix actionable outreach navigation and local meeting confirmation time”. Source checkout remained clean before and after all probes.

## Findings (under 400 words)

**Documented standards:** No hard coding-standard breach established. Reviewed frontend/AGENTS.md, installed Next client-boundary/navigation guidance, OWNER_CONTRACT and LOCAL_DECISIONS. Browser work belongs in the existing client component; resolver is pure navigation guidance. Existing authorization and action-readiness checks remain authoritative. The Fowler baseline was considered in full; no actionable heuristic smell warrants a separate finding in this small change. Tooling-enforced style was not duplicated as manual feedback.

**[P2] Approval / Copy jump cannot move keyboard focus.** `frontend/components/outreach-workspace.tsx:1003` renders `id="outreach-actions"` on a plain div without `tabIndex`. The new effect at lines 53–61 calls `target.focus()` after the jump handler prevents native anchor behavior. With a complete saved draft, activate “Jump to next safe action”: scrolling can occur, but focus remains on that link; keyboard traversal does not move to approval controls. The same target is used for an already approved message. Other added focus targets have `tabIndex={-1}` or are native inputs. Add the missing focusability (or focus the appropriate real control) and cover both approval and Copy paths. Independent jsdom reproduction: expected activeElement.id `outreach-actions`, received empty id on the original anchor. No write or approval change occurred.

**Security / cost:** No additional tenant, write, permission or paid-dispatch defect reproduced. Jump changes view and pending focus only. Thread mismatch, suspension and actual keyed scope replacement prevent stale focus. Existing organization/session keys and mode/search keys remount memory state. Exact approval, outgoing edits, incoming text and return-date buffers remain intact. A blocked or incomplete thread never gains action authority from guidance. Meeting labels use the supplied timezone, or explicitly retain an unknown/unavailable saved timestamp. No provider/backend transport code changed.

**Verdict:** One actionable P2 remains at this immutable checkpoint; security/cost boundaries passed within the source/mock scope. The separately recorded pre-existing invalid-address Next up projection is not attributed to this commit. No browser, production, hosted-parity or full-goal acceptance is implied.

## Test appendix

- External copied frontend: `work/review-probes/navigation-review-c118b3f/frontend`.
- **83 tests: 82 PASS, 1 FAIL.** Existing outreach component tests 64/64 PASS; existing workspace-session tests 2/2 PASS; independent reviewer controls 16/17 PASS.
- Independent 17: six immutable pure-helper stop/invalid/pause/company/footer/evidence cases; due meeting reporting truth; unknown/empty/invalid timezone fallbacks; Toronto instant conversion; approval focus failure; exact approval retained/no Copy/mailto/write on jump; pending jump consumed during suspension; active-thread switch blocks stale focus; keyed replacement blocks old-scope focus; private incoming and return-date buffers retained.
- Original existing tests were copied intact before reviewer additions were appended externally. All implementation source below was copied unmodified; no product files or owner state changed. API, clipboard and email-app boundaries were mocks. No browser, socket service, account, provider call, real email or owner data was used.
- Command (from task root):

```powershell
& 'C:\Users\Hiren\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' '.\worktrees\continuation\frontend\node_modules\vitest\vitest.mjs' run --config '.\work\review-probes\vitest-navigation-c118b3f.config.mjs' --reporter=verbose --reporter=json --outputFile='.\work\review-probes\navigation-c118b3f.json'
```

- Raw output: `work/review-probes/navigation-c118b3f.log`. Vitest resolves its JSON output relative to copied root, so JSON is at `work/review-probes/navigation-review-c118b3f/frontend/work/review-probes/navigation-c118b3f.json`.
- Independent tests: `navigation-review-c118b3f/frontend/landing-tests/navigation-independent.test.tsx`; six appended `REVIEW:` cases in its external `outreach-workspace.test.tsx` copy.
- Source-hash manifest: `work/review-probes/navigation-c118b3f-source-hashes.json`; each copied file matched immutable source exactly:

- `lib/outreach-next-step.ts`: `22d27092a081d89b1df482224ce1c89b726607ceb7c2720738ca068b46e459d8`
- `components/outreach-workspace.tsx`: `a72a4b5016990728b48ef801d01974a7015accfe1ba2fdd4e16a057e98ed972d`
- `components/outreach-timing.tsx`: `b7deee39e265815a2d72d83b20006e1ef1669a1967148197aab111112d960466`
- `components/workspace-session.tsx`: `275057b8661559ee1baa132c0a727bbf47d2138dd67a3a3ef0efd7a0e848a2b1`
- `components/customer-workspace-screen.tsx`: `09767f3d79560fa137b29d44176f9936421c64477ae04c2b904c2725ed7a8039`
- `lib/outreach.ts`: `91ddc77ee8a0b99793dabce7b61c093725c6deac505779fdf4f1c6f648677360`

Limitations: jsdom focus/React scheduling is not physical keyboard or rendered Chrome evidence. Actual timezone ICU behavior checked in this installed Node runtime only. No broader pre-existing outreach/queue/backend review, live Clerk/Convex verification, cost-price acceptance, deployment, provider or external send was attempted.
