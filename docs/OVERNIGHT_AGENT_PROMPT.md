# Clientrove: overnight implementation brief

Continue building the existing application into a coherent, trustworthy release candidate. Implement and verify the work; a strategy report alone is insufficient. Work through all unblocked priorities, use parallel implementation agents with clearly separated files, integrate their changes, and use fresh independent reviewers for security and UX. A morning deadline does not establish production readiness: deliver the strongest verified result and identify the exact remaining launch gates.

## 1. Establish the starting point

Repository: https://github.com/thakoreh/signalfoundry. The product is currently branded **Clientrove**; naming/domain/trademark clearance remains unverified. This is an existing Next.js/React application with a FastAPI/SQLite loopback review mode and a Clerk/Convex hosted architecture. Extend it rather than scaffold a replacement.

Fetch, inspect Git status/worktrees, read applicable AGENTS.md files, and preserve unrelated changes and local data. PR #5 is merged as `cfd22af0e693a4854e3e2c46e034ccf5a39127f3`; `codex/clientrove-outreach-journey` is finished history and must not be edited, pushed or reopened. Continue from latest origin/main on `codex/clientrove-release-candidate`; open a draft PR early and push small seam checkpoints. Merge origin/main if it moves; never rebase pushed history or force push. Main requires a PR, passing `source-checks` and `container-checks` on an up-to-date branch, and resolved review threads. ZERO approving GitHub reviews are required. Only owner `thakoreh` reviews and merges after the latest push; independent AI reports are inputs, not GitHub approvals. Do not merge, auto-merge, approve, push main, delete branches, change rules/settings/checks or touch secrets.

Read these requirements before assigning implementation, then consult the detailed sections while working:

- [Product requirements](OVERNIGHT_PRODUCT_REQUIREMENTS.md): audience, complete customer journey, boundaries, commercial validation, budget, and outcome acceptance.
- [Design requirements](OVERNIGHT_DESIGN_REQUIREMENTS.md): theme/tokens, every screen, mobile behavior, interaction states, and visual acceptance. Read before any UI change.
- [Technical requirements](OVERNIGHT_TECHNICAL_REQUIREMENTS.md): all 26 security, persistence, provider, cost, operational, and release gates. Read before backend/provider/deployment changes.
- For outreach contracts read [LOCAL_OUTREACH.md](LOCAL_OUTREACH.md); before choosing transport read [OUTREACH_EMAIL_OPTIONS.md](OUTREACH_EMAIL_OPTIONS.md). For hosted configuration inspect [SAAS_SETUP.md](SAAS_SETUP.md) and source. Reconcile stale architecture/readiness documents against actual code.

**Completion:** record the starting commit, environment mode, existing changes, current PR/CI state, and a prioritized checklist tied to these requirements. Required external inputs may block a particular integration; continue other useful implementation and tests.

## 2. Preserve the product contract

Target founders selling launched SaaS to businesses. The desired outcome is relevant, qualified conversations and meetings that can become customers. Finding a list is the beginning. The complete journey is:

**Website → confirmed business/offer/buyer → relevant prospects → reviewed outreach → conversations and qualification → meetings → measured customer outcomes.**

The current application already has website/manual setup, bounded DeepSeek discovery, a dedicated progress/results route, a compact contact-first table, selected CSV export, real explicitly requested initial AI drafts, and a local persistent Review / Conversations / Meetings workspace. The workspace currently supports manual external sending, pasted replies, exact-message approvals, sticky opt-outs, and user-reported outcomes. Hosted outreach is deliberately unavailable. There is no connected mailbox, automated follow-up, live calendar confirmation, AI reply generation, or demonstrated global monetary cap yet. Keep public claims consistent with whichever environment actually works.

Preserve the five-result default/maximum for testing. Location and buyer type remain user-controlled. Explee, Kitchen Sense, and other examples are test profiles, never evidence of the owner's business or customer demand. Published email is unverified until an actual verifier supplies evidence. Qualified prospects, positive replies, booked meetings, attendance, and sales are separate facts; none can be guaranteed.

## 3. Finish a simple, consistent interface

Use the accepted calm direction: warm paper background, white surfaces, deep forest text/actions, restrained borders, quiet green selection, existing system fonts and shared three-bar brand mark. Consolidate semantic tokens and measured contrast across landing, auth, setup, search, draft, and outreach. Preserve the corrected forest primary button. Motion is subtle, finite, accessible, and removed for reduced motion.

Implement the design specification screen by screen. Landing must explain the whole journey, show an accurate visibly fictional product example, and distinguish available manual assistance from planned inbox automation. Keep website-first entry, standard Sign up/Sign in, truthful Get started, and a quieter working manual option. Preserve entered intent through signup without automatic spending or overwriting a saved profile.

Keep setup compact; confirm the business and buyer once. Add compact saved seller/offer context and Edit business access to working screens so the sender and recipient cannot be confused. Discovery opens a refreshable job page with genuine progress, partial/empty/error recovery, and no duplicate paid request on refresh. Results stay dense: company, contact, explicit verification status, selection, draft, Prepare outreach, and CSV. Preserve the user's removal of fit-score explanations and Research details panels; keep evidence available where a draft's claims are reviewed.

Outreach remains three focused views. Show one clear next action for save → exact approval → copy or authorized send. Conversations keep reply history, status, and proposed answer together. Meetings distinguish links, user reports, provider confirmations, and sales. Support returning to saved work without starting another search. Preserve unsaved text or require an explicit save/discard choice when switching context.

**Completion:** fresh Chrome checks at desktop 1280/1440 and phone 390/320px, long-content/error/empty states, keyboard/focus/dialog behavior, 200% zoom, contrast, reduced motion, and no-JS marketing visibility. Phone inputs remain at least 16px and controls have usable 44px targets. Use **Chrome only; the in-app browser crashes Codex**. Distinguish emulated checks from physical phone/assistive-technology evidence.

## 4. Make the hosted foundation real

Implement Convex outreach parity before enabling the hosted adapter: authenticated organization ownership, threads/messages, approvals/sent snapshots, suppression, revisions/idempotency, replies, pause, and reported outcomes. Read applicable Convex expert/reviewer instructions before editing convex/. Use indexed bounded reads and safe migrations. Never route hosted traffic into unauthenticated SQLite.

Test cross-tenant ID substitution, removed users/roles, expired sessions, organization switches during requests, duplicate/ambiguous responses, and stale edits. Preserve exact approval over recipient, subject, body, booking link, and latest inbound context. Edits, new replies, suppression, or pause must invalidate stale readiness. Original sent content remains immutable. A classification correction or changed email must not clear a previous opt-out.

**Completion:** meaningful tenant/race/regression tests pass; hosted behavior has real authorized integration evidence or remains honestly gated with the missing input named. Local success cannot substitute for hosted acceptance.

## 5. Add spending control before more autonomy

The early testing ceiling is **US$25/month including existing DeepSeek usage**. Whether Google Ads is included or separate is unresolved; leave Ads unallocated. Current provider spend/remaining credit must be reconciled, not assumed. This operator budget is not customer subscription pricing.

Implement durable global and tenant monetary admission, conservative reservations before paid work, settlement/reconciliation, attempt idempotency, versioned prices/currency/periods, bounded tokens/time/retries/concurrency, and a kill switch. Cover search, initial drafts, future replies, failures/retries, and paid data/verification. Unknown costs must not silently permit spending. Count quotas alone are insufficient. Include non-API costs in the readiness budget.

Reuse DeepSeek. Evaluate optional Apify/Monid or other tools only for a demonstrated gap and current permitted-use/total-cost evidence. Paid provider calls require existing explicit authorization and known remaining budget; use mocks for automated tests. Do not add subscriptions, top-ups, silent paid fallbacks, or real outreach while implementing this brief.

**Completion:** concurrent admission, retries, rollover, exhaustion, unknown pricing/usage, and failure settlement tests prove the implemented boundary; report where provider-account enforcement/reconciliation is still unavailable.

## 6. Connect the next useful slice where prerequisites allow

After cost admission, build a grounded opt-in reply copilot using the saved offering, approved product facts, and actual conversation. Treat retrieved content as untrusted; preserve unknowns and prohibit invented capabilities/prices/relationships. Keep output editable and exact approval mandatory. Do not enable paid reply generation until admission works.

Prepare one permitted mailbox integration behind a provider boundary. Existing mailbox ownership, provider choice/terms, OAuth authority, recipients, and actual sending authorization are unresolved. Implement offline/test adapters and the durable outbox now; keep live connection/send gated until those inputs exist. Include encrypted delegated tokens, revocation, exact-content dispatch checks, suppression, ambiguous-send reconciliation, delivery/bounce distinctions, inbound deduplication/recovery, and stop-on-reply behavior. Manual reports remain distinct from provider events. An autonomous sender needs its own approved operating policy.

Use an existing booking link first. Provider-confirmed booking needs authenticated integration, timezone/conflict/cancellation/reconciliation tests. A link or manual flag is not verified attendance or revenue.

**Completion:** the connected path works in an authorized test environment, or the complete tested seam is safely gated with exact owner setup steps. Keep the useful manual-assisted flow usable meanwhile.

## 7. Close release, quality, and commercial gaps

Evaluate relevance/contact quality against explicit buyer criteria and sourced fixtures; reject irrelevant/blocked/duplicate candidates rather than padding results. Preserve evidence and safe CSV output. Keep addresses' verification state consistent through UI/export/drafts.

Complete relevant technical gates for real auth, billing test mode with approved price/offer, entitlement/webhook correctness, privacy/deletion/export/retention, support/legal identity, worker isolation, secrets/log redaction, alerts, backup/isolated restore, rollback, and container/deployment configuration. Instrument the real acquisition-to-outcome funnel without prospect addresses/message bodies in advertising analytics. Do not invent pricing, testimonials, demand, customer conversions, or production evidence. Account/provider/domain/pricing/legal/Ads decisions become concrete owner blockers only after useful autonomous work is finished.

Run the repository's appropriate backend, Node, Convex, component, browser, lint/typecheck/build, preflight, packaging/container, dependency and secret checks. Inspect scripts first: integration tests must use isolated databases/ports and must not modify the owner's saved profile or sent history. Preserve the working local server; coordinate production builds so review assets remain valid. Record exact results on the final commit rather than copying old counts.

## 8. Review, fix, and leave a reviewable result

Freeze an integration point. Have independent security/tenant/cost and UX/spec reviewers inspect the actual final diff and browser journey. Fix actionable findings, add focused regressions, re-review changed critical boundaries, then run required final checks. Commit intended files, push the working branch, and follow the protected-main process. Never force push, bypass required approval, weaken tests for green CI, or expose secrets.

Leave a concise morning report plus fresh screenshots and an updated checklist covering every referenced P0/P1: **built, locally tested, staging verified, production verified, blocked, or deferred with reason**. Include commit/PR/CI state; actual spend versus unknowns; manual versus connected capabilities; unresolved defects; exact human setup/approval steps; and the local/staging review links that actually work. Finish with a truthful verdict: not ready / incomplete, verified release candidate, production ready, or production live. Public deployment, live charging, emails, ads, purchases, and production migrations require the relevant explicit authorization; prepare them concretely without claiming they occurred.
