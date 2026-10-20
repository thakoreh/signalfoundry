# Clientrove landing and first-session review

> Product direction update: the clarified goal is a prospect-to-conversation-to-meeting workflow, with discovery and drafts as its first stage. This earlier review describes the current interface and initial validation work. See the newer outreach journey report for the expanded direction and US$25 total monthly testing constraint.

Reviewed October 19, 2026. Read-only review for the agreed initial hypothesis: founders of launched B2B SaaS products who can name their business buyer. No app changes, campaign launches, contacts, purchases, or provider calls were made.

**Verdict:** the landing page is visually coherent and its website-first entry makes sense. It still sells a generic business-research list, while the current product is moving toward a simpler outcome: relevant businesses, available contact emails, an editable first message, and export. Tighten that promise and show the current experience before adding sections or animation. Whether founders find it useful enough to return and pay remains unvalidated.

## What should come after customer search?

**Keep the next action inside the Leads workspace.** Results → editable message → copy or selected export is a complete first-session path; it does not need a sequence of new pages.

| Surface | Recommendation | Current versus future |
| --- | --- | --- |
| Leads/results | Review compact businesses/contact status, select useful companies, and draft or export. | Current result page exists. Preserve this as the working hub. |
| Message | Open a modal on desktop and a usable full-screen sheet on phone. Review/edit/copy, then return to the same selected row. | Desktop modal and edit/copy exist; phone usability needs verification. Nothing sends. |
| Your saved leads | When the pilot shows return use, add one persistent view of accepted leads with a small New/Contacted/Follow-up state and next-action note/date. Reuse the same draft/export actions. | A last search can currently reopen. Durable cross-search saved-lead states, persistent edited drafts, and follow-up tracking are proposals. Do not describe them as implemented. |

Apollo's official documentation places save, email/drafting, list, and export actions around search results and describes saved records as a place for relationship status and next actions. That supports the in-context action pattern, not copying Apollo's full sales platform or inferring Clientrove demand. [Apollo search actions](https://knowledge.apollo.io/hc/en-us/articles/4412658716941-Search-for-People), [Apollo saved records](https://knowledge.apollo.io/hc/en-us/articles/42619944596237-Manage-Saved-Records-in-Apollo).

Defer separate campaign, sequence, replies, deals, and CRM pages. Sending and response management would add mailbox connection, permissions, suppression, and delivery operations; they should follow demonstrated research value and paid demand. “One place” can mean one coherent research-to-message workspace without attempting to own every sales operation.

## Evidence and limits

The fresh Chrome desktop screenshots below were opened and inspected. They show stable styled pages, not loading/error states. The parent reviewer captured hero CTA → local signup handoff → website setup, with the entered website preserved, and separately opened manual entry. No analysis, save, search, or model-generation action was triggered. Source review covered the landing/intake, business onboarding/profile editor, search form, current results table, and draft modal. The journey below distinguishes captured behavior, source-backed current behavior, and proposed improvements. Later research/draft/export steps were not live-executed for this audit.

### 1. First arrival and website entry — clear action; generic audience

![Current landing hero](../../outputs/landing-current-conversion-review.png)

The centered website field, quieter manual option, readable main headline, and restrained green styling establish a clear first action. “Find your next customers” and “Start with your website” do not identify B2B SaaS founders or explain why this is preferable to another lead-list tool. “See why they fit, check the facts” also emphasizes an older research-heavy presentation that the user has explicitly asked to remove.

The button says “Analyze my website,” while the small hint explains that account creation and website review happen first. Source confirms the CTA saves the website and routes to signup; analysis is not immediate. The first action should describe that transition, or disclose it more prominently. This is a copy/expectation issue, not a recommendation to add another step.

### 2. Workflow/product example — understandable sequence; outdated product evidence

![Current workflow example](../../outputs/landing-audit-02-workflow.png)

The three-step website → profile → customer-list story is easy to follow. The example is honestly labeled illustrative. However, its older “Why it fits & source” table does not match the user's preferred compact company/email/status/draft interface. Fictional studios/clinics with “Contact not looked up” explain a format but offer little evidence of the useful contact-and-message outcome.

Replace this example within its existing slot with the current compact interface and draft interaction. A clearly labeled sample is acceptable; a genuine dated run, using permitted public facts and actual contact status, would provide stronger evidence. Do not turn a sample company into a customer endorsement. Do not invent verified addresses, decision-maker authority, customer need, success rates, or time savings.

### 3. Value, FAQ, and final action — sensible restraint; missing decision information

![Current full landing page](../../outputs/landing-audit-full-page.png)

The page avoids fake testimonials and states that some contact information is unverified or missing, with no email sending included. Preserve those boundaries. The final action consistently returns to website entry. The repeated broad “opportunity,” “context,” and “understanding you” language is less useful than showing one practical outcome.

Before real acquisition, clarify the actual first-try terms: account requirement, what the current five-result test can produce, whether payment or a customer-supplied provider account is required, and what happens when no usable contacts are found. Those commercial/onboarding terms are not settled by this review. “Services connected to your workspace” is an operator explanation, not a clear answer for a founder expecting a managed SaaS. Do not advertise free access, no card, immediate results, or a price until the real flow supports it.

### 4. Local account handoff — honest local mode; extra transition

![Local signup handoff](../../outputs/landing-audit-04-local-signup.png)

The local screen explicitly says no account is created and offers Continue to business setup. That is truthful for review. It also demonstrates why a public ad cannot be sent to this local flow; actual production account creation remains a distinct readiness check. Do not treat this screen as evidence that real signup conversion works.

### 5. Website setup — focused and preserves the first entry

![Website setup with the entered website preserved](../../outputs/landing-audit-05-website-setup.png)

The URL is carried forward, the website option is prominent, and manual entry remains secondary. The second Analyze button is the actual analysis action, confirming the first hero button's expectation mismatch. Preserve the clean shell rather than expanding onboarding.

### 6. Manual entry — simple fallback; existing profile is visible

![Manual entry showing the unchanged saved test profile](../../outputs/landing-audit-06-manual-entry.png)

The fallback keeps the same visual language and reveals only the core fields, with extra targeting collapsed. This capture contains the existing Explee test profile; it is not newly analyzed data or evidence about the user's business. The source-backed next step saves the profile and opens the search form. No profile was saved during the capture.

## Prioritized changes

| Priority | Change | Reason and boundary |
| --- | --- | --- |
| P1 | Identify the audience and practical output in the hero. | A founder should recognize “this is for my launched B2B SaaS” and understand businesses/contact status/draft/export. Say potential businesses to approach, not guaranteed customers. |
| P1 | Update the existing product example to match the compact result table and editable draft. | Show the value the product actually delivers, rather than an obsolete research presentation. Keep sample/real-result status explicit. |
| P1 | Align the website CTA with signup/setup and make first-try conditions clear. | Avoid an expected immediate analysis turning into an unexplained account step. Public paid acquisition also needs real auth and a stable public app or an honestly labeled pilot signup. |
| P2 | Replace broad research claims with current capability language. | Keep evidence available quietly in the draft/source links and CSV; do not restore the rejected Research details UI or generic why-fit panels. |
| P2 | Mention editable AI drafting where its actual availability supports the claim. | It is a concrete next step missing from the landing story. Make clear it is a draft the user reviews/copies, not autonomous outreach. |
| P2 | Add a short “what happens next / what does it cost?” answer after the operator settles the pilot offer. | One compact FAQ answer is enough. Do not invent a pricing table or unlimited allowance. |
| Later | Describe return/weekly value only after repeated useful runs demonstrate it. | Current saved-result return is useful. Automatic new-lead monitoring, fresh weekly delivery, and learned targeting are proposed directions, not present capabilities. |

Copy direction to test, not approved final copy: **“For B2B SaaS founders” → “Find businesses to approach with your SaaS.” → “Start with your website, review available business contacts, and prepare an editable first message.”** This is more specific than a general AI-agent promise. It still requires qualification and contact-coverage validation; better wording cannot repair weak results.

## Smallest coherent customer journey

| Step | Current capability and health | Keep the path simple |
| --- | --- | --- |
| 1. Recognize the offer | Landing has one website-first action and a manual alternative; audience and first-try terms remain generic. | State B2B SaaS founder, useful output, and account/offer expectations. Keep the existing primary entry. |
| 2. Enter website and create account | Intake saves the website intent before signup/setup; local review uses a local handoff rather than a real signup. | Carry the URL forward once; do not ask the founder to retype it. A quiet manual fallback stays available. Real acquisition must use production auth or disclosed pilot enrollment. |
| 3. Confirm business and buyer | Onboarding exposes business name, offering, ideal customer types, and optional extra targeting. | Confirm only what is necessary for a useful search. Hide advanced roles/size/keywords/exclusions unless needed; do not imply unsupported targeting precision. |
| 4. Start one focused search | Separate search page pre-fills buyer type/location, allows changes and a 1–5 limit. Profile “Find customers” currently opens this form rather than starting research. | Avoid two competing “Find customers” meanings. Treat this as one final confirmation with target edits optional; preserve the user-authorized five-result testing cap and optional geography. |
| 5. Understand progress | Search opens a dedicated persisted-run page with queued/running stages, polling, and refresh recovery. | Show genuine stage/status rather than fake progress or a checklist of provider tools. Summarize blocked candidates quietly; do not ask the user to fix websites selected by the engine. |
| 6. Choose useful businesses | Compact table presents company, email, status, selection, and draft action, with contact-first sorting. | Keep this density. Relevant candidates need to pass eligibility before contact-first ordering. Missing email must remain explicit; an email alone does not establish product fit or purchasing intent. Do not reintroduce the rejected research panel or mandatory why-fit columns. |
| 7. Prepare an editable first message | Explicit draft action opens a modal, generates on demand, allows edits/copy, and shows supporting sources. Nothing sends automatically. | Make the draft useful from the saved offer and available evidence. Keep source links quiet in this context, generation states clear, and failure retry deliberate. Do not claim a message was sent or saved edits persist unless that behavior is implemented. |
| 8. Export and return | Selected businesses export to CSV; the last saved search can be reopened without starting a new paid search. | Keep selection/export near the list. Give a simple way to return to the saved result. A fuller history, accepted/rejected feedback, saved edited drafts, suppression of previously contacted businesses, or recurring discovery are future decisions, not current promises. |

The experience can feel like one useful place without rebuilding every tool: profile → research → compact shortlist → editable message → selected export. Reading the source is an optional confidence check, not a mandatory visit to several outside tools. Actual sending can stay in the founder's existing workflow while the core research value is validated.

## Mobile is part of the core journey

Desktop evidence alone cannot establish mobile readiness. The phone must support the same outcome, not merely shrink the page. Proposed acceptance checks:

- Website input, signup/continue, and profile actions fit a narrow viewport without clipped labels or sideways page scrolling.
- Keep company, contact/email status, and Draft action accessible together in each compact lead. A reflowed compact row is preferable to forcing users to pan a wide desktop table to discover the main action. Long emails must remain inspectable/copyable.
- Drafting opens a phone-sized sheet with visible close/back behavior, editable fields, keyboard-safe scrolling, and an easy Copy action. Closing restores the lead context and selection.
- Progress and empty/partial results are readable, and export/return controls remain usable. Test the actual CSV download/share behavior on the target phone browser.
- Check keyboard/focus, reduced motion, and touch targets. WCAG's reflow criterion addresses presentation without two-dimensional scrolling except content that needs it; a data table can have an exception, but that does not make hidden primary actions a good phone workflow. WCAG 2.2 also defines a minimum target-size criterion with exceptions. [W3C reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

These are recommendations and verification criteria; phone captures/testing are pending in this review version. No mobile compliance claim is made.

## A successful first session

A launched B2B SaaS founder confirms the offering and business buyer, starts one explicit search, and can identify at least one genuinely relevant business with an evidenced contact route. They review/edit a factual draft or export an accepted selection, understand verification limits and that nothing was sent, and can reopen the result without paying for duplicate research.

One accepted business is a minimum first-value event, not a sufficient paid-quality benchmark. The pilot should separately evaluate the batch's relevance, reachable-contact coverage, vetting time, and whether the founder uses a second batch and actually pays. A neat table containing only irrelevant companies or no usable contact routes is not activation. Honest rejection is valuable evidence; do not count a completed API request, signup, or CSV click as customer success.

## What not to add now

- More decorative sections, continuous animation, fake logos/testimonials, or inflated database-size counters.
- An autonomous-sales promise, guaranteed meetings, “verified” contacts without verification, or a hundreds-of-leads claim while the limit is five.
- Separate agent setup, model selection, API-key configuration, research tabs, mandatory evidence panels, or dashboards in the primary founder journey.
- CRM building, email sending, reply management, or recurring-search claims before the shortlist/draft workflow earns repeat use and payment.
- A low-price subscription or large included allowance chosen from Search API cost alone.

## Tests and remaining uncertainty

Test the more specific founder promise against the current generic copy using qualified cohorts. Measure who completes real website/profile setup, receives an accepted relevant/usable contact, uses draft/export, returns for another useful session in 7–14 days, and pays for a clearly disclosed continuation. Record rejections, refunds, provider/human delivery cost, and paid-media acquisition cost separately. Cheap visits/signups or competitor category presence do not establish demand.

Screenshots support hierarchy and content observations, not a full accessibility verdict. Small muted helper text, the manual alternative, and status distinctions need measured contrast and zoom checks. Keyboard focus, reduced-motion behavior, mobile reflow, screen-reader announcements, production signup, provider health, draft fact accuracy, export data quality, and real paid conversion need their own checks. This review made no new live provider calls or ads/account changes.

**Next action:** align the existing hero, product example, CTA expectations, and pilot terms with the compact B2B founder journey, then validate one real first-session outcome before buying traffic.
