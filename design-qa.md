# Clientrove landing design QA

Date: October 19, 2026. Scope: the existing production app's public landing page and website/manual intake handoff. Explee is an inspiration reference, not a request for a pixel-identical clone or its commercial claims.

## Visual evidence

- Source visual truth: `../work/explee-final-reference.png`, captured from https://explee.com/ in Chrome.
- Implementation hero used in comparison: `../work/clientrove-comparison-capture.png`, the unscaled 2545 x 1215 common crop retained from the right half of the combined comparison. Captured from http://127.0.0.1:3000/ in Chrome. The later warm-server final proof is `../outputs/clientrove-landing-v2.png`; `../outputs/clientrove-landing-review.png` is its centered, unscaled review crop retaining navigation and the hero.
- Implementation walkthrough: `../outputs/clientrove-workflow-v2.png`.
- Full-view comparison: `../work/landing-design-comparison.png` contains both source and implementation in one image.
- Focused form comparison: `../work/landing-form-comparison.png` contains both actual website-entry regions in one image.
- Source capture pixels: 2560 x 1215. Implementation capture pixels: 2545 x 1264; implementation CSS viewport width 2545. The common desktop comparison crops to 2545 x 1215 without rescaling either source. The 15-pixel right-edge and 49-pixel bottom differences are excluded from judgment. Layouts are compared at the top-of-page state after intro motion settles.
- This is a desktop browser pass. Mobile typography and overflow behavior were reviewed in CSS and independent source review; the Playwright responsive scenarios were authored but not executed. No mobile browser result is claimed.

## Required fidelity surfaces

1. Fonts/typography: centered, large two-line headline and short explanatory copy convey the task; green emphasis matches the existing accepted onboarding style. System product fonts are intentionally retained instead of importing Explee's branding. The primary action is visibly labeled, and the website field has a persistent label. Small mobile text was increased; see iteration history.
2. Spacing/layout rhythm: a single centered intake replaces the old split hero. The decorative edges leave the form unobstructed. The next section introduces a concrete profile-to-list walkthrough. Desktop measurement reports page width equal to viewport width, with no horizontal overflow.
3. Colors/tokens: existing pale-neutral/forest-green Clientrove tokens remain consistent with onboarding. Focus, error, and contact-status treatments are distinct. No full contrast/compliance certification is claimed.
4. Image quality: original decorative WebP background is 1738 x 905 and 18,510 bytes, generated with the built-in image tool and visually inspected. It contains no text or UI. The actual form, preview table, navigation, and copy are semantic HTML. The existing logo/icon system is reused.
5. Copy/content: company examples use reserved `.example` domains and explicit fictional/illustrative labeling. No Explee customer counts, success statistics, free-credit offers, outreach sending, or verified-contact claims are borrowed. The task is website -> editable business profile -> sourced candidate businesses -> selected CSV.

## Browser interaction evidence

- Invalid website: clear inline error, `aria-invalid`, associated message, and focus returned to the field; no navigation.
- Valid `cal.com` example: signup handoff leads to setup with `https://cal.com/` prefilled. No analysis or saved-profile write occurs.
- Manual option: signup handoff opens the short manual-details view directly.
- Saved business profile: independently compared with the pre-change snapshot; unchanged.
- Native section link reaches `#workflow`; the full preview renders without a carousel.
- FAQ expands with Enter and its answer is visible.
- Warm-server final browser error log: no errors. One earlier cold-server reload in the user's extension-enabled Chrome profile produced an attribute hydration warning whose diff consisted of injected `fdprocessedid` attributes on the input and buttons; no application-rendered property difference was shown. Extension console warnings were also present. The clean final tab has no error or development-issue badge.
- Linked CSS and decorative asset return HTTP 200 after restart.

## Comparison history and findings

- [P2, fixed] Mobile supporting copy had been reduced to 8-11 pixels. Increased body, label, and error copy to at least 14px, website input to 16px, supporting/table metadata to at least 12px, and small kickers to at least 11px. The example table retains readable row text and an internal, named keyboard-focusable scroll region instead of shrinking to fit. Independent Spec/UX review includes these overrides.
- [P2, fixed] Product-preview reveal animations initially ran during page load, before the user reached the below-fold walkthrough. The final correction observes the preview body and requires 15% visibility before triggering the same finite sequence once. Content stays visible without JavaScript, and the observer disconnects after entry/unmount. Chrome proof at the top of the page: preview body top 1261px, viewport height 1271px, motion attribute absent, profile animation `none`. After following How it works: motion attribute `true`, profile animation `sf-intro`, duration 0.7s. The whole stagger completes in 1.25 seconds. Three observer tests and the final independent Standards review pass.
- Accepted differences: stronger explicit Analyze action, existing Clientrove logo/palette, shorter header, no fabricated social proof, no quantified lead promise, and a static readable semantic product example rather than Explee's stacked sales/outreach demonstration.

## Validation and remaining scope

Independent Standards/security and Spec/UX reviews passed, including the scroll-trigger adjustment; Standards also cleared the final body-visibility threshold. TypeScript, full lint, 107 backend tests, 67 Convex tests, 50 Node tests, 16 landing component tests, and five production source gates passed. The final production build passed after the last motion change, and the local server was restarted successfully. Tests using fixtures do not establish provider quality. One authorized real DeepSeek request returned four researched businesses and one blocked website; the saved example was requalified using its captured pages without another provider request. One published email remains unverified. Live Hunter verification, hosted SaaS operation, physical/mobile browser QA, and actual container runtime were not part of this local evidence.

## Implementation checklist

- [x] Centered functional website entry and manual alternative.
- [x] Private expiring tab-scoped draft handoff; no automatic analysis.
- [x] Plain copy, source/contact-status examples, legal navigation.
- [x] Finite intro/interaction motion and reduced-motion CSS.
- [x] Desktop visual comparison, primary flow, FAQ, and console checks.
- [x] Verify final viewport-triggered walkthrough motion and obtain final reviewer refresh.

final result: passed

## Customer-search follow-up: October 19, 2026

The search form now lives at `/workspace/customers`; starting a search navigates to `/workspace/customers/[searchId]` for progress and results. Default and maximum remain five, with a 1–5 selector. Refresh, polling, and status retry only read the existing job. Contact ordering distinguishes verified email, published unverified email, and no email, then uses score/name/id ties. Selected CSV rows follow the displayed order. Partial research uses a quiet summary and optional plain-language details.

Blocked, excluded, and redirected-duplicate sites free slots for remaining candidates from the same search response. The engine attempts at most ten public sites using three workers, retains at most the requested five businesses, and enriches contacts only after final-domain deduplication and admission. It does not bypass blocked access or make another search request for backfill.

Independent security/standards and spec/UX reviewers cleared the final changes after fixing verified-first ranking, a StrictMode session startup failure, and optional history loading that could stall polling. Genuine unmount and organization changes still abort requests; old organization API closures cannot revive an aborted session.

Validation passed: 112 backend tests, 67 Convex tests, 56 Node tests, 25 component tests, five production source checks, full lint, and the production build including both new routes. Managed local servers were restarted. Both new routes return HTTP 200; DeepSeek reports ready, the contact verifier remains unconfigured, and the saved workspace exactly matches the pre-change snapshot.

Chrome desktop evidence uses the user's existing saved search `search_3701fff82d9348bcbf7035cfe89344af`: published email first, explicit unverified label, alternative sorting, selection/sort restoration after refresh, quiet expanded research details, and fixed checkbox alignment. Final warm-server browser error log is empty. Screenshot: `../outputs/customer-results-reviewed.png`.

Progress rendering and refresh were checked using one explicitly labeled temporary local interface fixture, with no provider requests or fabricated leads. Screenshot: `../outputs/search-progress-interface-qa.png`. Only that fixture row was removed afterward; hashes confirmed every pre-existing search and the workspace were unchanged. No additional live search/contact provider calls were made for this iteration. Actual paid-provider yield, Hunter deliverability, hosted SaaS deployment, and mobile-browser rendering remain outside this evidence.

The agent workflow and monetization research is a proposal, not implemented autonomous outreach or a price change: `docs/AGENT_PRODUCT_AND_PRICING.md`, also copied to `../outputs/agent-product-and-pricing.md`. It distinguishes supported broader SaaS embedding from supplier restrictions requiring confirmation for Clientrove's exact sharing/export use, and labels all margin scenarios as illustrative.

## Compact results and AI draft trial

User approved a working visual trial of compact cards and personalized drafts. The main card now shows company/domain, one sourced match observation, one prioritized contact status, and Draft message. Research details contain the remaining facts, source links, score, contacts, and unknowns. The run-level partial note is one line with expandable details; the completed page no longer displays the internal provider query.

Eligibility now requires non-demo public-source evidence and an explicit company-type identity match. Incidental body mentions, zero category matches, and geography points alone do not qualify. This conservative wording check is still rules-based; it does not establish semantic need or buying intent. New searches backfill rejected candidates before contact lookup. Existing saved runs are filtered for display/selection/export without rewriting their stored accounts. The current four-candidate example shows only Flowout; three weaker candidates are left out.

Optional message drafting uses the real DeepSeek language model with bounded source excerpts and the sender's saved offering. There is no automatic generation, tool execution, recipient selection, copying, or sending. The editor permits local edits and reset to the cached original. Known evidence IDs and output format/destinations/numeric claims are checked mechanically; prose still needs human review. Privacy and current-capability documentation describe the new data flow.

Independent security and spec reviews passed after fixing provenance cache invalidation, generated destination checks, admission parity, failed-attempt retry, stale pending recovery, and cached-read alias limits. Same-key retries cannot add another model attempt. Only an explicit new key after confirmed terminal failure can retry; attempts count toward quotas. Expired pending work is marked failed after 90 seconds without an automatic retry, and stale completions cannot overwrite a new attempt. Cached request aliases have a 100/hour retrieval bound, rather than a permanent lifetime lockout.

Final integrated checks passed: 128 backend tests, 76 Convex tests, 59 Node tests, 34 component tests, five production source checks, full lint, and a production build. The managed local server was restarted with explicitly enabled drafting; both search and drafts report configured. Hosted deployment, production auth/provider configuration, actual container runtime, and mobile browser QA are not established by these local checks.

One live model request through the Chrome Draft message action produced a 96-word editable introduction using the saved Explee example offering and Flowout source claims. Cited stored excerpts support its company description and quoted company metrics; the proposed benefit is conditional. Reopening after refresh returned the cached original, with the local attempt ledger still showing only one generation attempt. Subject editing and local Reset edits were verified in Chrome. Copy behavior was covered by mocked component tests; the user's clipboard was not changed. No new discovery request or external message was sent. Provider cash billing was not audited.

Hashes confirm every pre-existing saved search and the workspace were unchanged. The new AI original remains saved for user review. Final warm-server Chrome error log is empty. Screenshots: `../outputs/compact-customer-trial.png` and `../outputs/ai-draft-trial.png`; the marked Chrome tab remains open on the actual draft editor. `docs/AGENT_PRODUCT_AND_PRICING.md` and its outputs copy now distinguish implemented assisted drafting from future autonomous research/CRM/sending proposals.

## Dense results, phone layouts, and landing alignment

The latest user request replaces the earlier cards and research disclosures with a dense company/email/verification/action table. Research details and generic why-fit lines are removed from the main results. Drafting opens a separate modal/drawer; the native dialog traps focus, Escape closes it, and focus returns to the row. Selection/export and contact-first sorting are preserved. The testing limit remains five.

Fresh Chrome phone checks exposed real horizontal page overflow and hidden primary actions. At widths up to 800px the same semantic table now reflows into compact lead rows. Company, email/status, selection and Draft are available together; narrower rows put the action below. Copy/Reset live in a persistent dialog footer outside the editor scroller. At 390px and 320px the inspected results have no horizontal page overflow; Copy fits inside the captured viewport. Website/manual inputs use 16px phone text. Viewport overrides were reset afterward. These are Chrome viewport checks, not physical Safari, virtual-keyboard or screen-reader evidence.

Three roles reviewed positioning, conversion and UI/UX against fresh screenshots. The landing identifies founders selling SaaS to businesses, describes the currently built shortlist/contact/draft/CSV outcome, uses Get started before account/setup and retains Analyze at actual website analysis. Its fictional .example product illustration now shows compact contacts and a native draft disclosure. Five-result testing limits, variable contact availability and no sending are explicit. The removed research panels were not restored. Broader outreach, reply handling and meeting booking remain proposed work rather than landing claims about implemented features.

Independent UI/UX review passed the captured desktop/390px/320px states, with no blocking finding. Optional refinements are a shorter phone seller-profile example and less repeated website wording. Root validation passed all 37 component tests, 59 Node tests, full ESLint and the optimized production build. The managed local server was restarted and a fresh Chrome result page loaded with an empty error log; the landing was opened for user review. Existing cached drafts were reused, with no new charged generation attempt or discovery search. Workspace and saved search data remain unchanged.

Evidence: `../outputs/landing-revised-desktop.png`, `../outputs/landing-revised-workflow.png`, `../outputs/mobile-landing-reviewed.png`, `../outputs/mobile-landing-draft-example-reviewed.png`, `../outputs/customer-lead-table.png`, `../outputs/mobile-leads-reviewed.png`, `../outputs/mobile-draft-reviewed.png`, and the 320px variants. Reports: `../outputs/landing-conversion-review.md`, `../outputs/landing-product-positioning-review.md`, `../outputs/landing-ux-review.md`. The first two describe the pre-change audit; the independent UX report includes the revision signoff.

The user approved a US$25 total monthly early-testing planning ceiling, including existing DeepSeek usage. No new subscription was purchased. A cross-provider spending ledger and enforceable account-wide cap are not implemented and are not established by existing per-hour request limits.

## Persistent supervised outreach and complete landing story

The private local app now persists Review, Conversations and Meetings at `/workspace/outreach/[searchId]`. Prepare outreach creates/reopens selected eligible businesses, reuses matching cached initial drafts without a new model request, and keeps exact-recipient/message approval, manual external-send records, pasted replies/classifications, sticky opt-outs, pauses and reported meeting/customer outcomes. There is no mailbox transport, automatic inbox reading, AI reply generation or calendar confirmation. Hosted outreach intentionally returns unavailable until tenant-backed parity exists.

Independent review corrected booking-link copy/history alignment, suppression of the original inbound recipient after editing, initial approval gating and sidebar status accuracy. Root also corrected primary-button contrast to the onboarding forest green (white on #234f40 computes to 9.28:1). Full current verification: 142 backend tests, 76 Convex tests, 45 component tests, 60 Node tests, five production source checks, full ESLint and a successful production build. The source checks do not establish deployment readiness.

Chrome opened actual saved results, selected two businesses, prepared outreach, inspected all three views and refreshed the new route successfully. The saved original drafts survived refresh; no new AI generation was triggered. No approval, external-send event, received reply, meeting or customer outcome was fabricated in the real workspace for QA. State-changing workflow cases are covered in isolated offline tests. The warm-route browser error log was empty. At 390px and 320px outreach reflow showed no page overflow, and inspected phone fields were 16px. A full-page capture timed out; viewport captures were retained instead. Physical-device keyboard/Safari checks remain unverified.

Fresh local evidence: `../outputs/outreach-01-review.png`, `../outputs/outreach-02-conversations.png`, `../outputs/outreach-03-meetings.png`, `../outputs/outreach-mobile-review.png`, and `../outputs/outreach-mobile-meetings.png`. These local output artifacts are not committed screenshots. The expanded landing now explains discovery through manually recorded conversations/meetings and separately labels connected inbox/automatic follow-ups as planned. Ads budget allocation versus the US$25 testing ceiling remains unresolved; no ads or new services were purchased.
