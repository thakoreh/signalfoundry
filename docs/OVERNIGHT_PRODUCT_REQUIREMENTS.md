# Overnight handoff contribution: product, commercial journey, and acceptance

Prepared October 19, 2026. This is input to the parent agent's integrated handoff prompt, not a claim of production readiness. It reflects the latest user direction; older list-only conclusions and illustrative $150 acquisition budgets are superseded. No external actions, code edits, provider calls, purchases, or messages occurred for this contribution.

## Product contract to preserve

Current implementation evidence is docs/continuation/STATUS.md. Local reply suggestions now have separately gated, explicit, editable offline implementation; the historical starting-state table below does not imply that this code remains absent. The product still has no connected inbox/send/calendar acceptance or production readiness.

Build for founders of **launched B2B SaaS** products with a definable business buyer. The intended product helps turn researched prospects into useful conversations and qualified meetings, with eventual sales outcomes measured. Lists, drafts, and exports are the foundation—not the whole vision. The differentiator to earn is a simple, trustworthy founder workflow that coordinates the work and reduces manual effort. Neither “AI agent” branding nor cheaper lead rows establishes differentiation or paid demand.

The intended promise is **founder-approved outbound from a product website to qualified conversations**. Public copy must describe implemented capabilities and explicitly distinguish manual assistance from connected automation. Prospects ≠ positive replies ≠ booked meetings ≠ attended qualified meetings ≠ paying customers. Do not guarantee any recipient action or sales result.

Use Okara's website-to-context-to-approved-execution pattern as inspiration, not a feature list to clone. Its documented core is an AI CMO across marketing channels; its Influencer Agent handles creator campaigns. Reply/Jason is a more direct reference for outbound approvals, reply handling, and meetings. Their public claims are category evidence, not independent proof of our demand or performance. [Okara introduction](https://okara.ai/docs/introduction), [Okara Influencer Agent](https://okara.ai/agent/influencer), [Reply AI SDR](https://how.reply.io/capabilities/ai-sdr/).

## Actual repository baseline: verify again on the chosen release state

| Capability | Current source-backed position |
| --- | --- |
| Website and profile | Website/manual onboarding, editable offering and buyer types, optional targeting, and a subsequent focused search form exist. |
| Discovery | DeepSeek Search is the configured default; own public-page fetches and conservative rules-based candidate eligibility exist. Five results is the user-retained testing maximum/default. Configuration is not broad quality validation. |
| Contacts and first message | Public emails can be returned as unverified; optional Hunter verification is not demonstrated configured/live. Explicit bounded DeepSeek initial-message drafting exists with saved evidence references and cached originals. Source IDs alone do not prove every generated claim is true. |
| Compact leads | Contact-first table, draft modal, selection, CSV, and saved-search return exist. Preserve the user's rejection of generic why-fit/Research details panels. |
| Outreach | A **local** persisted Review/Conversations/Meetings ledger now exists: edit/save, exact-content approval, copy, record external sending, pasted replies with manual status, pause/suppression, and user-reported meeting/sale outcomes. |
| Missing connected operation | Hosted outreach is explicitly unavailable. There is no live inbox/transport/calendar integration. AI reply drafting is disabled pending a total monthly spending guard. Manual reports are not provider-confirmed delivery, bookings, or revenue. |
| Commercial/operational readiness | Auth/billing/tenant/job foundations in code are not evidence that the user's production accounts, live billing, deployment, data rights, support operations, or complete outcome funnel work. A global monetary spending ledger is not implemented. |

Relevant source seams: backend `customers.py`, `customer_drafts.py`, `outreach.py`; frontend `customer-search-results.tsx`, `prepare-outreach.tsx`, `outreach-workspace.tsx`; docs `OUTREACH_JOURNEY.md`, `OUTREACH_EMAIL_OPTIONS.md`, `PRODUCTION_READINESS.md`. Inspect the current branch/working tree rather than assuming these notes are unchanged on latest main. Preserve user work and valid existing data while integrating.

## Final coherent founder journey

1. **Recognize and start.** Landing identifies B2B SaaS founders, shows an accurate compact product example, states trial/account/offer conditions, and provides one prominent website action plus a quieter manual option. No fake customer logos, metrics, verified-email guarantees, or autonomous-sales claims.
2. **Create an account and confirm the business once.** Preserve the entered URL through real signup; review offering and company buyer. Hide advanced fields by default. Do not silently use Kitchen Sense, Explee, or another saved example as the user's business.
3. **Start a focused discovery job.** Pre-fill the confirmed buyer/location; allow changes without duplicate mandatory data entry. Keep default five and choices within the validated testing cap. Location is optional and user-controlled. Explain any charge/allowance before the action.
4. **Understand genuine progress.** A dedicated run view survives refresh/navigation, reports real stages, handles partial/empty/failed results, and reopens the same job without duplicate paid work. Skip blocked candidate sites; show a short understandable summary when it affects results.
5. **Choose useful prospects.** Put contacts first among eligible businesses, distinguish verified/published-unverified/missing, and keep selection/export close. Do not pad shortfalls with irrelevant companies or invent buying intent. Source access can remain quiet in the draft/CSV context; do not restore rejected evidence-heavy UI.
6. **Prepare and approve outreach.** The sender's factual offer/allowed claims and actual recipient are clear. Draft/edit/save/approve exact content. Changing recipient, message, booking link, or inbound context invalidates stale approval. Nothing sends merely because a draft exists.
7. **Handle conversations.** Keep the thread and proposed answer together. In the narrow assisted pilot, pasted replies and manual sending are honestly labeled. A reply pauses follow-ups; uncertain/negative/opt-out cases block further action appropriately. Answers use approved product facts, not invented discounts, security claims, integrations, or intent.
8. **Qualify and arrange a meeting.** Use agreed fit/interest criteria, then a reviewed booking invitation. Separate a sent link, user-reported booking, provider-confirmed booking, attendance/no-show/cancellation, and eventual paid-customer outcome.
9. **Return to next actions.** Reopen the same prospect/thread and approvals without regenerating paid work. Pending replies, interested conversations, and meetings create a reason to return. Do not build a broad CRM or claim automated weekly discovery before it exists.

Phone users must complete this same path. Keep company/contact/status/main action together, use a usable full-screen message/thread sheet where appropriate, preserve selection and return context, and verify editing/copy/export with the on-screen keyboard. Desktop screenshots or CSS breakpoints alone are insufficient mobile acceptance.

## Prioritized actionable overnight work

### P0 — make the launch boundary real

- Reconcile the public promise, application availability, current docs, and release checklist. A green build must not produce a false “production-ready” conclusion.
- Make the existing manual-assisted outreach flow genuinely tenant-scoped and durable for the intended hosted pilot, or clearly keep that feature disabled publicly and report the hosted gap. Do not substitute browser-only fake persistence for server authorization.
- Implement the agreed cost admission/ledger before enabling new recurring or autonomous paid actions. Keep reply-AI generation disabled if this gate is unmet.
- Validate candidate fit and reachable-contact quality against explicit target criteria and real sources. The present rules filter and a few sample results do not justify “qualified buyers” claims. Preserve shortfall/unknown states.
- Provide a factual reply-copilot workflow with explicit reviewed/manual operation if full transport is blocked. Do not hide that limitation or call it autonomous outbound.
- Finalize an honest first-pilot offer and first-session measurement path, including rejection/refund handling if charging. Do not publish an invented subscription price or guaranteed meeting count.

### P1 — connected execution only where prerequisites are satisfied

- Select **one** permitted mailbox integration using an existing license where possible, narrow delegated access, exact-content approval, durable outbox/reply state, and tested opt-out suppression. Do not create accounts, buy domains/mailboxes, or send to real recipients merely to complete this checklist.
- Integrate an existing booking link first; add confirmed booking/cancellation events only with authenticated provider evidence. Avoid full CRM construction.
- Instrument accepted prospects, approved messages, qualified replies, meeting states, return use, actual payments/refunds, and delivery cost. Distinguish user reports from provider-confirmed events everywhere.

### Defer until evidence supports expansion

Hundreds of results, paid enrichment waterfalls, inbox/domain fleets, automatic follow-up sequences, multichannel outreach, autonomous objection handling, full CRM/deals/reply analytics suites, every Okara marketing channel, and large acquisition campaigns. These remain possible future product directions, not dismissed goals.

## Cost and authorization contract

The ceiling is **US$25 total monthly early testing, including existing DeepSeek search/model usage**. The allocation of ads within or outside that amount is **unresolved**: do not carry forward the older illustrative $150 ad test, assume a separate ads budget, or launch a campaign. Reconcile incurred usage before calculating remaining funds.

Require a global monthly budget plus subordinate per-tenant daily/monthly caps, cost reservation before paid work, actual-usage settlement, cache/idempotency, bounded queries/fetches/tokens/attempts/time/concurrency, and a fail-closed stop when remaining exposure is uncertain. Disable auto-top-ups, silent paid fallbacks, and unbounded retries. A local configured key, plan quota, or an estimated counter is not a verified provider-account hard cap.

Reuse DeepSeek by default. Apify/Monid are optional inspected tools for a demonstrated data gap, not automatic subscriptions or guaranteed savings. Free credits do not establish repeatable cost or commercial data rights. Compare total research, data, verification, model, mailbox/sequencer, hosting, human review, failures, and refunds per qualified reply/attended meeting—not token price alone.

Budget permission is not permission to buy services, connect a mailbox/calendar, email people, launch ads, publish a site, or charge customers. Use existing session authorizations exactly; prepare reviewable configurations and name any remaining human steps.

## Measurable completion gates

| Gate | Evidence required |
| --- | --- |
| First-session outcome | One founder can use their own product profile to identify an accepted relevant business with a usable contact route, review a factual draft, and act by approved copy/export. Count accepted usefulness, not displayed rows. |
| Data quality | Review target/competitor/irrelevant/blocked/empty cases; preserve sources, timestamps and unknowns. Test that unverified addresses never become verified through UI, export, or drafting. A recommended pilot-quality target of 4/5 accepted matches and 3/5 usable routes is a hypothesis to evaluate, not a production guarantee. |
| Conversation safety | No cross-tenant data/approval access, stale approval, duplicate action, opt-out response, fabricated product claim, or silent paid retry in tested cases. Pasted/reported facts stay labeled. |
| Outcome honesty | Link offered ≠ booked; booked ≠ attended; attended ≠ customer. No fake or sample outcome appears in customer metrics. |
| Budget | Parallel admissions cannot exceed the reserved remaining global/tenant limits; rejection happens before provider work. Failed/retried/model attempts are counted where billable. Report provider-reconciliation limits explicitly. |
| Mobile and recovery | Real narrow-screen checks cover website→profile→progress→leads→draft/conversation→copy/export/return, including long content, errors, keyboard, reload and back navigation. |
| Hosted pilot | Actual production-mode accounts and tenant persistence work; local signup/ledger are not used as proof. Required configuration, account permissions, commercial terms and provider rights are documented as passed or blocked. |
| Commercial validation | Instrumentation is trustworthy and a concrete pilot is reviewable. Actual repeat use, paid conversion, attended meetings and profitability remain unproven until real authorized users produce them; do not manufacture overnight evidence. |

At handoff, mark each as **implemented and tested**, **implemented but unverified**, or **blocked with named input**. If live transport is blocked, deliver the useful hosted/manual-assisted boundary and an exact next action; do not claim the whole vision is production-ready by morning.

## Owner release-candidate acceptance additions (authoritative)

The owner is the only maintainer, reviewer and merger. Keep each PR reviewable in about an hour; organize commits by seam and stack PRs when larger. No new services/accounts/queues/infrastructure beyond Next.js, local FastAPI/SQLite, Clerk/Convex and DeepSeek unless a P0 demonstrably requires it. Prefer fewer layers. One local command, one test command; collect every new env/manual step, off switch and rollback in one setup doc. Rare alerts go only to the owner. Every capability needs an off switch and rollback.

The canonical numbered journey supersedes the older nine-step grouping above:

1. Landing: clearly target launched B2B SaaS founders; visibly fictional whole-journey example; manual today versus planned; one website CTA and quiet manual fallback; no fake proof.
2. Signup preserves the entered website; spends nothing; never overwrites a saved profile.
3. Confirm once: offering, buyer and sender name/company/mailing address. Ask once for a missing mailing address and explain legal footer use. Saved identity is the Selling as context on working screens.
4. Search prefills editable buyer/location, default/max five, visible cost/allowance before explicit click; real persisted progress; refresh never repeats paid work.
5. Dense leads: company/named contacts first; shared inbox labeled and lower ranked; address verification, source URL and retrieval date; already-contacted company marker; selection/CSV; honest shortfalls, no padding.
6. Draft: saved-evidence claims marked, unsupported claims flagged, footer included, recipient local time when known. Edit → save → exact approval → Copy/Open in email app → Sent as approved / Sent with changes / Not yet.
7. End with a plain next-action summary, e.g. follow-ups due Thursday, not fabricated activity.
8. Return to Next up: replies to log/answer, follow-ups due, snoozes due, approvals pending and meetings to report; one action per item; opening incurs no paid calls.
9. Paste reply and manually choose type; show consequence. Interested; question/objection; referral (new same-company contact, fresh suppression/approval, credit referrer); not now (dated snooze); not interested (stop); opt-out or source challenge (suppress/stop); OOO (pause until dated return, exclude reply metric); bounce (invalid address/stop, exclude reply metric).
10. Human answer uses saved offer facts beside thread; optional grounded AI only after cost gate. Exact approve → manually send → log.
11. Follow-ups stay in thread, due in Next up, at most two, each manually approved; any reply stops them.
12. After interest offer existing booking link; report booking AND time; offer approval-required confirmation; after time ask attended/no-show/cancelled, later customer outcome. All labeled reported by you.
13. Honest personal funnel: contacted → replied → interested → meetings held → customers; separate manual reports/provider confirmation; no opens/vanity metrics.
14. Next search reuses profile and flags/excludes already-contacted/suppressed companies without re-entry.

Unknown stays Unknown without a report. Logging prompts at natural moments take two taps or fewer. Copy/open is not sending. Sent with changes stores actual recipient/subject/body separately from immutable approved text. Published email is unverified absent verifier evidence. Provider acceptance is not delivery; link is not booking; meeting is not sale; auto-reply is not reply. One active cold thread per company by default; reply/opt-out/meeting pauses pending outreach to other contacts until manual decision. Edits, replies, pauses and suppression invalidate approvals; opt-out survives later searches, address edits and corrections.

Draft defaults: plain 50–125 words, one specific verifiable recipient observation, one factual seller line, one low-pressure interest question. No flattery, fake familiarity/Re:/Fwd:, urgency or connections. Initial email has no booking link, attachments/images and at most one link; founder may override style defaults. Suggest weekday working hours in known recipient timezone, never optimal-time claims.

Compliance (US/Canada; verify current primary rules, not legal advice): each copied/mailto/outreach message includes saved name/company/mailing address and plain opt-out line; block approval without identity/address. Store each recipient's published address source URL and role relevance/contact basis; block when publication rejects unsolicited messages. Opt-outs immediate and durable (legal maximum ten business days). Default US/Canada only; EU/UK excluded unless explicitly enabled after GDPR/PECR review. No tracking pixels/link rewriting. Gated connected mailbox needs gradual daily caps, owner SPF/DKIM/DMARC steps, stop-on-bounce/complaint thresholds.

Required unhappy paths: failed/empty/partial search; no contact; draft failure/allowance exhaustion; tab closes mid-edit (retain or explicit discard); edits drop approval; opt-out blocks already approved follow-up; company repeats across searches; keyboard covers editor; 320px and 200% zoom. Test all transitions, suppression/company pause, quota/allowance, return, concurrent failures and tenant/role boundaries using isolated fixtures/mocks only.

Priority: source checklist/docs → coherent local steps 1–14 → durable local/global/tenant cost admission (reserve/settle/reconcile prior usage, idempotency, bounded tokens/retries/concurrency, uncertainty stop, kill switch) → hosted Convex parity while disabled until verified → grounded reply/offline mailbox after cost/contract → quality/auth/billing/privacy/operations/restore. Local journey wins conflicts with hosted work. US$25/month includes prior DeepSeek; reconciliation unknown, Ads unallocated. No purchases, spend, real messages, account connection, public deployment or live billing authorized. Do useful safe work while externally gated; defer broad CRM/fleets/multichannel/hundreds of results.

Evidence: progress after every milestone with exact commands/results/decisions/blockers/next; fetch/preserve owner work/data/preview and use isolated worktrees/ports/DBs/Chrome profiles. Small checkpoint pushes; merge moving main, never force push/rebase pushed history. Stop a path after two failed approaches/about 45 minutes and continue safely; immediately halt secrets/data/paid-exposure/real-send risk. Never weaken tests/lint/types. Built needs exact-commit output; verified needs running-app walk, mocks are not integration. Fresh independent security/tenant/cost and busy-founder 390px UX review of integrated diff and steps 1–7 then 8–14; fix/retest/re-review critical changes. Final checks include source/container checks on up-to-date final head and resolved threads; zero GitHub approvals, only owner merge.

Morning report: verdict then owner decisions; 1–14 works/partly/broken/gated with reason; EVERY P0/P1 built/locally tested/staging verified/production verified/blocked/deferred with reason; branch/PR/base/head/checks, review links/screenshots/defects, known/unknown spend, manual/connected distinction, setup/rollback. Truthful incomplete/candidate/production-ready/live distinction; deadline/build/mocks never imply readiness.

## Minimum human blockers to surface once, concretely

1. **Budget/ads allocation and remaining usage:** confirm whether ads share US$25 and what has already been spent; propose no ads by default until resolved.
2. **Sender and permitted pilot:** existing mailbox/license, sending-provider permission, recipients/market and basis for contact, exact sending authorization, booking link/calendar access. Public/verified email is not permission. Some mailbox/provider terms prohibit unsolicited campaigns; do not assume Gmail, Resend, SES or another cheap API permits a scraped-prospect workflow. See the reviewed [email-options brief](./OUTREACH_EMAIL_OPTIONS.md).
3. **Release/commercial identity and accounts:** real auth/backend/billing/deployment access, domain/legal/support details, pilot price/currency/limits/refund/retention terms, and publication/charging authorization where absent. These cannot be invented from repository defaults.
4. **Contact-data rights if adding a supplier:** confirm exact embedded display/export use. Hunter supports embedding in a broader SaaS, but competitive replication and third-party sharing/resale have separate restrictions; use its FAQ and terms together rather than claiming all SaaS embedding is forbidden. [Hunter API FAQ](https://help.hunter.io/en/articles/12149400-hunter-api-for-data-plans), [Hunter terms](https://hunter.io/terms-of-service), [Hunter content policy](https://hunter.io/transparency/content-policy).

Do all useful implementation, documentation, source-backed investigation, fixture/test-mode checks, and review before presenting these concrete final blockers. No hypothetical blockers should stop ordinary reversible work already authorized.
