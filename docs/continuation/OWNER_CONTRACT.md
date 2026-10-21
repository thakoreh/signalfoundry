# SignalFoundry release-candidate owner goal

Owner contract captured from the original instructions. Messaging transport metadata is removed; product requirements and restrictions are preserved. This is the original contract, not a new deadline. The continuation prompt explains how to resume the existing branch rather than creating it again.

START HERE Repository: https://github.com/thakoreh/signalfoundry PR #5 (https://github.com/thakoreh/signalfoundry/pull/5) is MERGED into main as cfd22af0e6 (October 20, 2026). The merge-conditional instructions in the docs are resolved: work from the latest main. codex/clientrove-outreach-journey is finished history. Do not commit to it, push to it, or reopen PR #5. Fetch, then inspect git status and worktrees. If the local checkout is still on codex/clientrove-outreach-journey, carry any uncommitted edits onto the new branch instead of discarding them. Preserve saved profiles, searches, drafts, outreach history, and the owner's running preview. Do not reuse its ports or databases. Create one working branch from the latest origin/main (at or after cfd22af0e6), e.g. codex/clientrove-release-candidate. Open a draft PR to main early and push small checkpoints to it. If main moves during the run, merge origin/main into your branch. Never rebase pushed history or force push. Read the brief from main by file path. Start with docs/OVERNIGHT_AGENT_PROMPT.md, then docs/OVERNIGHT_PRODUCT_REQUIREMENTS.md, OVERNIGHT_DESIGN_REQUIREMENTS.md, OVERNIGHT_TECHNICAL_REQUIREMENTS.md, LOCAL_OUTREACH.md and OUTREACH_EMAIL_OPTIONS.md. These documents are the detailed scope and acceptance contract. This goal adds the user journey, solo-maintainer, behavior, compliance and run-discipline requirements below. Add them to the checklist and to the matching requirement docs. Read applicable AGENTS.md files if any exist, and read the Convex instructions before editing convex/. Current source wins over stale architecture or readiness notes. Recheck current provider documentation before making integration or pricing decisions. Use Chrome only; the in-app browser crashes Codex. Extend the existing app rather than replacing it. SOLO MAINTAINER RULE The owner (thakoreh) is the only maintainer, reviewer and merger of this repository. He will also run, debug and pay for everything you build.

---

[Messaging transport metadata omitted.]

The actual main ruleset, checked October 20, 2026:
A pull request is required.
source-checks and container-checks must pass on a branch that is up to date with main.
Review threads must be resolved.
Force pushes and branch deletion are blocked.
Zero approving reviews are required. GitHub does not let an author approve their own PR.
The docs say "an independent approving review after the latest push" is required. That is stale: update the docs to match the real ruleset.
No approval is required, so nothing in GitHub stops you from merging. You must not:
merge, enable auto-merge, approve, or push to main;
change rulesets or repository settings, rename or weaken required checks, or touch secrets;
delete branches.
The only approval is the owner's own review and merge after your latest push. AI review reports are inputs to that review, not approvals.
Make the PR reviewable by one person in about an hour. When checks pass, mark it ready for review and put a review guide at the top: what changed at each journey step, files in order of risk, a 10-minute local test script, screenshots, known defects, and rollback steps. Organize commits by seam. If the diff grows beyond an hour's review, split it into stacked PRs by seam. Resolve or answer every review thread you open.
Build only what one person can maintain. Add no new services, accounts, queues or infrastructure beyond the existing stack (Next.js, local FastAPI/SQLite, Clerk/Convex, DeepSeek), unless a P0 cannot be met any other way; if so, document why. Prefer removing code to adding layers. There should be one command to run locally and one to test. Put every new env var, secret, manual step and off switch in one setup doc. Alerts must be rare and go only to the owner. Every new capability needs an off switch and a rollback note.
PRODUCT OUTCOME
Founders selling launched B2B SaaS handle the whole journey in one place: website → confirmed business/offer/buyer → relevant prospects → approved outreach → qualified conversations → meetings → measured customer outcomes. Leads and editable introductions are the foundation, not the product. The app is local for now, so people will use the local manual-assisted loop first. It has to give someone a reason to come back tomorrow, not just pass a demo today.

CURRENT TRUTH
Website-first setup, bounded DeepSeek discovery, progress/results, compact contact-first leads, selected CSV, and real initial AI drafts exist. A persistent LOCAL Review/Conversations/Meetings workspace supports exact approvals, external-send records, pasted replies, pauses/opt-outs, and reported outcomes. Hosted outreach remains unavailable. Live inbox/transport/calendar, guarded AI replies, and a global monetary spending ledger are not established. Local success is not hosted readiness. Examples are test businesses, never evidence of the owner's business or demand.

USER JOURNEY (this is the acceptance path; build it, test it end to end, and screenshot each numbered step)
The user is a founder who is short on time, works in short bursts and often on a phone, and drops tools that ask for setup before showing value. Retention is won or lost on day two.

First session — goal: from website to a first approved, sendable message in about ten minutes, without reading instructions.
Land. The landing page says who it is for, shows the whole journey with a visibly fictional example, and says what is manual today versus planned. It has one main action (enter your website) and a quieter manual option. No fake logos, metrics or guarantees.
Sign up. The entered website survives signup. Signing up spends nothing and never overwrites a saved profile.
Confirm the business once. The app reads the website and shows one compact review: what the founder sells, who buys it, and the sender identity (name, company, mailing address). If the mailing address is missing, the app asks for it here, once, and explains that outreach must legally include it. The confirmed profile becomes the "Selling as" line on every working screen.
Find prospects. Buyer and location are pre-filled and editable. Default and maximum are 5 results. The cost or allowance is visible before the click. One click starts one search and opens a progress page with real stages. Refreshing that page never repeats the paid search.
Choose prospects. A dense list with:
company and named contacts first, with shared inboxes labelled;
verification status, plus when and where each address was found;
a marker when the company was already contacted;
selection and CSV export.
If there are fewer results than asked for, the list says so and is not padded with weak matches.
Prepare and approve the first message. The founder requests a draft within the allowance. In the draft:
claims that rest on saved evidence are marked, and unsupported claims are flagged;
the compliance footer is already included;
the recipient's local time is shown when known.
The steps are edit → save → approve the exact text → "Open in email app" or Copy. Then the app asks "Sent as approved / Sent with changes / Not yet".
Leave with a reason to return. The session ends with a plain summary of what comes next, e.g. "3 follow-ups due Thursday."
Return sessions — goal: the founder opens the app, clears what is waiting, and leaves in a few minutes.
8. Open to Next up. Returning users land on one queue: replies to log or answer, follow-ups due, snoozed contacts due again, approvals pending, and meetings to report. Each item has one primary action. Opening the app makes no paid calls.
9. Log a reply. The founder pastes the reply and picks its type (see reply types). The app applies the consequence (stop, snooze, suppress, pause the company, or add a referred contact) and shows what it did.
10. Answer. Before the cost gate exists, the founder writes the answer with the saved offer facts and the thread side by side. After the gate, an optional grounded draft is available. Either way: exact approval → send manually → log it.
11. Follow up. Due follow-ups appear in Next up, drafted in the same thread, each needing its own approval. There are at most two, and any reply stops them.
12. Book and hold the meeting. Offer the booking link once interest is shown. Then:

the founder reports the booking and its time;
the app offers a confirmation draft for approval;
after the meeting time, it asks "Did it happen?" (attended / no-show / cancelled);
later it asks "Became a customer?"
Every one of these is labelled "reported by you".
See honest progress. A simple personal funnel: contacted → replied → interested → meetings held → customers. Reported and provider-confirmed figures are labelled separately. Do not show vanity metrics such as opens.
Start the next batch. A new search reuses the confirmed profile. Already-contacted and suppressed companies are flagged or excluded automatically. Nothing has to be entered again.
Unhappy paths that must work: a search fails, returns nothing, or finishes partly; no contact is found; draft generation fails or the allowance runs out; the tab closes mid-edit (unsaved text survives, or the founder chose to discard); an edit after approval visibly drops the approval; an opt-out arrives while an approved follow-up is pending (the follow-up is blocked); the same company appears in a later search; the phone keyboard covers the editor; 320px width; 200% zoom.
RULES THE JOURNEY DEPENDS ON

Logging must be nearly free. Prompts take two taps or fewer and appear at the natural moment. If the founder doesn't answer, the state stays Unknown and is never assumed.
Opening the email app or copying is not sending. "Sent with changes" stores the text that actually went out as the sent snapshot, kept separate from the approved text.
Drafts must not read as AI-written. Defaults: plain text of roughly 50–125 words, with one specific, verifiable observation about the recipient, one plain line on what the seller does, and one low-pressure question about interest. No flattery openers, fake familiarity, fake Re:/Fwd: subjects, invented urgency or invented connections. The first email has no booking link, no images or attachments, and at most one link. The founder can override these defaults.
Reply types and what each one does:
Interested.
Question or objection.
Referral: add a new contact at the same company, run a fresh suppression check, require fresh approval, and credit the person who referred.
Not now: record a date to revisit and snooze until then.
Not interested: stop.
Opt-out, or "where did you get my email": suppress and stop.
Auto-reply or out-of-office: not a real reply. Pause until the return date and leave it out of reply metrics.
Bounce: mark the address invalid and stop. Not a reply.
The founder picks the type manually. AI suggestions come only after the cost gate exists.
Contacts belong to companies. Default to one active cold thread per company. A reply, opt-out or meeting at a company pauses pending outreach to its other contacts until the founder decides.
Shared inboxes (info@, hello@, support@, sales@ and similar) rank below named contacts and are never written to as if they were one person.
Timing: suggest weekday working hours in the recipient's time zone. Never claim a send time is optimal.
COMPLIANCE AND DELIVERABILITY (US + Canada; the owner is in Ontario; verify current rules — this is not legal advice)

Every outreach message, including copied and mailto ones, includes the sender's name and company, the mailing address from the saved profile, and a plain opt-out line. Block approval when the sender identity or address is missing. Never invent them.
For each recipient, store the basis for contact: the source URL where the business address was published, and why the message relates to their role. Do not proceed when the source says the person does not want unsolicited messages (CASL).
Opt-outs take effect immediately and stay in effect. The legal maximum is 10 business days; do better than that.
Default to recipients in the US and Canada. Exclude EU/UK recipients unless the owner explicitly turns them on after reviewing GDPR/PECR obligations.
Do not add open or click tracking pixels, and do not rewrite links.
For the gated mailbox integration, include daily send caps that ramp up gradually. Show SPF/DKIM/DMARC setup checks as owner steps. Stop sending automatically when bounces or complaints pass a threshold.
RUN DISCIPLINE
Keep docs/overnight/PROGRESS.md current after every milestone: checklist state, commands run and their results, decisions, blockers, and next step. After any context reset, reread it and this goal before continuing.
Commit small working checkpoints and push to your working branch regularly.
Time-box blocked work. After two different failed approaches, or about 45 minutes without progress, record the evidence, gate the item, and move on. Return to it only with new information.
Give each parallel agent its own git worktree and explicit file ownership. Integrate often, and rerun affected tests after each merge.
Never weaken, skip, delete or rewrite tests to make them pass. Never loosen lint or type settings. Avoid broad rewrites or renames outside the task. Add a dependency only when it's needed, after checking its license and maintenance, and commit the lockfile.
"Built" requires command output on that exact commit. "Verified" requires walking the journey in the running app. Mocks prove logic, not integrations.
Stop the line if secrets appear in output or commits, the owner's data is at risk, paid calls become unbounded, or anything would send a real external message. Halt that path, record it, and continue elsewhere.
IMPLEMENT IN THIS PRIORITY ORDER (parallel seams are allowed; this order wins conflicts)

Build a source-backed checklist and baseline that maps every journey step and requirement above to its current state. Assign parallel agents to separate seams. Fix inconsistent docs and public claims, including the stale review rule.
Make journey steps 1–14 work locally, with a coherent UI. UI: warm neutral paper, white surfaces, forest-green text and actions, shared tokens and brand, readable contrast, and restrained animation that respects reduced motion. Preserve: website-first setup with quiet manual entry, the saved "Selling as" context, dense desktop leads, reachable phone actions, the removal of generic fit explanations and Research details panels, and safe unsaved text.
Build durable global and tenant cost admission. It must cover local mode, because local DeepSeek usage already counts against the ceiling. Reserve cost before dispatch, settle and reconcile actual usage, bound retries/tokens/concurrency, deduplicate attempts, stop when exposure is uncertain, and provide a kill switch. Cover search, initial drafts, future reply AI, failures, and paid data.
Build authenticated, tenant-scoped hosted outreach parity in Convex before opening its adapter. Verify ownership, roles, revisions, idempotency, exact-content approvals, immutable sent snapshots, durable opt-outs, and session/organization-switch races. Keep SQLite loopback-only. If parity can't be completed and tested, leave hosted outreach honestly disabled. Do not trade away step 2 to finish it.
Build a grounded, editable reply copilot only after the cost gate and a reviewed conversation contract exist. Prepare one permitted mailbox integration with offline/test adapters, a durable outbox, safe OAuth/token handling, suppression rechecks, ambiguous-send reconciliation, inbound recovery, stop-on-reply, and the deliverability limits above. Keep live operation gated wherever provider choice, mailbox ownership or authorization is missing. Use existing booking links first, and keep reported events distinct from provider-confirmed ones.
Check candidate and contact accuracy against explicit buyer criteria. Complete real auth/billing test-mode boundaries, privacy/deletion/export, privacy-safe funnel analytics, worker isolation, operations/alerts, isolated backup/restore, and rollback. Update landing copy and enabled actions to match what is actually available.
Run meaningful tests for every journey step, every unhappy path listed above, and every critical transition: approval invalidation, each reply type, company-level pause, suppression/pause, quotas and allowance, saved return, tenant/role boundaries, concurrent requests, and failures. Use isolated fixtures/databases and mocked providers. Never touch the owner's preview or data.
Have fresh, independent security/tenant/cost and UX/spec reviewers inspect the integrated final diff and walk the journey. The UX reviewer plays a busy founder on a 390px phone: steps 1–7 as a first session, then steps 8–14 as a next-day return. Fix actionable findings, run focused regressions, re-review changed critical boundaries, run the required checks on the final commit, and leave the PR ready for the owner under the solo maintainer rule.
NON-NEGOTIABLE CONSTRAINTS
The early testing ceiling is US$25 per month INCLUDING existing DeepSeek usage. Actual prior usage needs reconciliation. Whether Google Ads shares that amount is unresolved: allocate no Ads spend. Keep the five-result default/maximum until explicitly changed. Reuse DeepSeek and existing infrastructure: no new subscriptions, top-ups, silent paid fallbacks, or unbounded paid tests. The budget is not permission to buy services, send messages, connect accounts, launch ads, charge customers or deploy publicly. Reuse existing explicit authorization. Prepare all unblocked code and tests, plus concrete setup steps, while missing external inputs keep their features gated.
A published email address is unverified until a real verifier provides evidence. Edits, new replies, pause or suppression must invalidate any stale approval. An opt-out stays effective across searches, recipient edits and status corrections. A copied or opened message is not sent; provider acceptance is not delivery; a link is not a booking; a meeting is not a sale; an auto-reply is not a reply. Keep manual reports distinct from provider facts. Do not invent proof, testimonials, product capabilities, intent, prices, outcomes, sender identity or mailing addresses. Defer broad CRM, mailbox fleets, multichannel expansion and hundreds of results until the narrow journey works.

DONE MEANS EVIDENCE
Capture fresh Chrome screenshots of each numbered journey step at desktop and at 390px/320px phone widths, plus the unhappy paths. Cover keyboard/focus/dialog behavior, 200% zoom, long content, errors, contrast and reduced motion. Report gaps in physical-device or screen-reader testing honestly. Run the applicable backend, Node, Convex, component, browser, lint/typecheck/build, preflight, dependency/secret, packaging and container checks. source-checks and container-checks must pass on the final commit of a branch that is up to date with main.
Leave a concise morning report. Start with the verdict and the decisions the owner must make, in that order, because the owner reads the top and skims the rest. Next, give a journey table: each step 1–14 marked works / partly works / broken / gated, with the reason. Then map every P0/P1 to one of: built, locally tested, staging verified, production verified, blocked, or deferred with reason. Include the working branch, its PR, the main commit it started from, exact commit and check status, working review links, screenshots, remaining defects, spend known and unknown, manual versus connected features, owner setup steps, and rollback notes. Conclude truthfully: not ready/incomplete, verified release candidate, production ready, or production live. Finish all useful autonomous work before requesting the remaining human decisions. Do not label the product production-ready merely because mocks or builds pass or the morning deadline arrives.