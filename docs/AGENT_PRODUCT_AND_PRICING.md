# Clientrove: agent product and pricing recommendation

Research checked October 19, 2026. Product recommendations and arithmetic below are proposals, not implemented features, a launch price, or measured profitability. No additional paid provider calls or purchases were made for this research.

## Recommended product

Give each workspace a **customer research agent** that knows the business, approved target customers, geography, exclusions, and spending limit. Run a shared research workflow with that saved context; a separate trained model for every customer or prospect is unnecessary.

The useful promise is: **“Find relevant businesses, explain why they fit, and prepare the next step.”** A list is the starting point. The agent should complete the research work around it:

1. Find companies against the user's explicit preferences; deduplicate by company/domain and exclude existing customers or suppressed contacts.
2. Read available public company pages, preserve dated sources, explain fit, and distinguish facts from unknowns. Skip inaccessible sites without asking the user to repair sites the engine selected. Do not bypass access restrictions.
3. Find contact routes, optionally verify email, and put reachable candidates first. Apply relevance requirements before ranking. Within eligible candidates, use provider-verified email, published unverified email, other evidenced contact routes, then no contact information; sort by fit within each group. Never relabel a published address as verified.
4. Let the user select businesses and ask for deeper research or an editable first-message draft grounded in cited facts. A relevant company is not proof of purchasing intent, and an email address is not consent to contact.
5. Export selected results, then add an explicitly authorized CRM connection. Later, connect a sending service with per-campaign approval and suppression handling. Sending is a separate product phase, not something this research enables.

Show work as understandable stages: finding businesses, researching websites, checking contact routes, and preparing results. Counts should reflect actual completed work; avoid invented percentages. Explain shortfalls with a plain summary, with technical details tucked away. Keep the present default and maximum at five for testing, as requested. Hundreds require durable queued batches, deduplication, cancellation, budgets, and resumable progress before increasing the limit.

## What is available versus proposed

The current repository uses DeepSeek's standalone Search API, bounded public-site fetching, a conservative rules-based company-type eligibility check, result polling, contact status, and CSV export. It also supports an explicitly enabled DeepSeek language-model action that writes a short editable message from the saved sender offering and selected prospect's sourced excerpts. Generation requires a click; originals are cached by the business/research snapshot, attempts are bounded, and nothing is sent. Compact results leave weak candidates out without deleting saved research. This is assisted drafting, not autonomous research planning or semantic proof of customer need. Hunter enrichment/verification is optional and currently unconfigured. A small example run is not a relevance, coverage, deliverability, or margin benchmark. Local validation also does not establish a deployed SaaS installation.

A future agent should use bounded tools and persisted jobs rather than unrestricted browsing. The workspace stores target preferences, exclusions, evidence, allowed actions, job history, and budget. A shared executor plans only permitted steps. Public page text is untrusted data, never an instruction to send messages, change targets, or disclose secrets.

For customers bringing their own AI agent, later expose narrow authenticated API/MCP operations: create a research job, inspect progress, retrieve results, export selected records, and request a draft. Scope every operation to the authenticated workspace, existing entitlements, quotas, and idempotency keys. Keep provider credentials on the server. External agents should not receive more authority than the same user has in the app.

## Provider economics and commercial rights

| Provider item | Current published fact | Implication |
| --- | --- | --- |
| DeepSeek Search | US$0.75 per 1,000 successful nonempty requests; result count does not change the request price. The API supports 1–50 returned results and 5 requests/second per account. | One search result is not one usable lead. Budget actual queries and candidate yield. The app's five-business cap is an application testing limit. |
| DeepSeek Fetch | US$0.75 per 1,000 successful content-producing requests, separately from Search. | The current app fetches sites itself, so it does not incur this API's fees. Own fetching still costs infrastructure/time. |
| Hunter Data Platform | Example minimum US-dollar annual packages: 1,000 Search credits for $50; 1,000 Verification credits for $11. Purchased credits last 12 months. | Effective example rates are $0.05/Search credit and $0.011/Verification credit, before tax and unused-credit effects. This is an annual prepayment, not a monthly $61 subscription. |
| Hunter API credit units | Data-plan Domain Search uses one Search credit per 1–10 returned addresses per domain; Email Finder uses one Search credit per found email; Email Verifier uses one Verification credit. | Record the endpoint and plan. All-in-one plans have different verification units; do not apply a universal Hunter credit rate. |

Sources: [DeepSeek Search and Fetch billing and limits](https://api-docs.deepseek.com/guides/search/), [Hunter Data Platform package examples](https://help.hunter.io/en/articles/9920427-data-platform-plans-for-api-users), and [Hunter API credit units for Data plans](https://help.hunter.io/en/articles/12149400-hunter-api-for-data-plans). Optional AI drafts use `deepseek-flash` with a bounded prompt and 600 output-token ceiling, and incur separate [model token charges](https://api-docs.deepseek.com/quick_start/pricing/). The arithmetic below excludes draft-token consumption and is not a measured end-to-end cost benchmark. Temporary DeepSeek waivers for its integrations with coding tools should not be assumed to cover Clientrove's direct Search or model API requests.

**Hunter supports embedding data in a broader SaaS product; exact export and sharing rights need confirmation.** Its [Data-plan API FAQ](https://help.hunter.io/en/articles/12149400-hunter-api-for-data-plans) explicitly supports third-party products using Hunter data as one component of a broader service. It distinguishes this from offering standalone copies of its core finding, domain-search, and verification features.

Read that support alongside two explicit restrictions. [Terms of Service section 8](https://hunter.io/terms-of-service) requires prior written consent for a similar or competitive service. The [Content Policy](https://hunter.io/transparency/content-policy) prohibits third-party sharing or resale without prior written authorization. Its narrower internal-research allowance also does not authorize bulk individual-data redistribution outside permitted purposes. The policy separately permits relevant professional B2B prospecting and CRM enrichment; it is not a blanket ban on SaaS integration or all CSV exports.

Our recommendation is to obtain written confirmation for **Clientrove's exact workflow**: enrichment within its broader research agent, third-party result display, retention, and selected-record CSV export. This is a prudent way to resolve the boundary between supported embedding and restricted competitive use/sharing; the reviewed pages do not establish that every customer-facing integration needs a separately negotiated commercial agreement. Do not present Clientrove as a raw Hunter data reseller or assume bring-your-own-key resolves these boundaries. No Hunter permission request or purchase has been made.

DeepSeek's Open Platform terms contemplate downstream applications for external end users and assign its rights, if any, in outputs to the developer, subject to the terms. This does not grant rights in all underlying third-party website content. Confirm Search-specific commercial use and permitted retention/export for the launched product and disclose the actual processing arrangement. [DeepSeek Open Platform Terms](https://cdn.deepseek.com/policies/en-US/deepseek-open-platform-terms-of-service.html).

## Monetization recommendation

Charge for research completed and workflow value, supported by a workspace subscription with included **research credits** and separately visible **contact-enrichment credits**. Offer prepaid top-ups with a clear price and spending ceiling; avoid silent overages. Research, contact lookup, verification, and drafting have different costs and should not hide behind an undefined “lead.” Reopening a result or exporting the same saved selection should not trigger another research charge. Disclose exactly which completed actions consume credits and how failed, empty, duplicate, and cancelled work is handled.

This provides a stronger product than simply marking up cheap Search API requests: saved targeting, evidence, contact status, quality control, deduplication, reproducible jobs, and useful next steps. A plan can include agent access later without creating a separate model per customer. Do not promise guaranteed buyers, replies, or meetings.

Explee's current pricing page separates an outreach-agent offering from database research/email services. Its advertised outcomes and starting prices are that vendor's claims, not Clientrove forecasts or evidence our costs match theirs. It is useful evidence for separating product value from raw database access. [Explee pricing](https://explee.com/pricing).

## Cost formula and illustrative arithmetic

```text
cost per usable contact =
  (search + paid page fetches + lookup + verification + model tokens
   + all paid attempts/retries/fallbacks + allocated hosting/operations)
  / unique relevant businesses with an acceptable usable contact route
```

Count all attempts in the numerator, including rejected candidates and work yielding no usable contact. A verified-email cost metric needs a verified-email denominator; do not mix it with the broader “contact route” definition. With zero usable contacts, report total cost and zero yield rather than a misleading unit cost.

For illustration only: 10 billable DeepSeek searches cost $0.0075. At the minimum Hunter Data-plan rates, 100 billed Search credits plus 100 billed Verification credits cost $6.10, making provider cost $6.1075 before hosting, models, taxes, or unused annual credits. If that hypothetical work produces 50 usable contacts, provider cost is about $0.122/contact; if it produces 20, about $0.305/contact. These are arithmetic scenarios, not observed conversion or verification rates. The selected supplier may not permit the intended commercial use.

A hypothetical **$29/month plan** targeting an **80% contribution margin before other costs** allows at most **$5.80 in variable cost** per subscriber. This is a budget target, not a proposed public price or margin forecast. The $6.1075 scenario already exceeds that variable-cost budget before infrastructure and payment costs. Subscription allowances therefore need measured yield and enrichment consumption. Gross margin must also include the actual cost-of-revenue policy; contribution targets alone do not establish business profit.

## Delivery order and evidence needed before pricing

1. **Current work:** a focused search-progress/results experience, compact qualified-candidate rows, contact-first sorting, editable preferences, honest partial results, source details, five-result test runs, and explicit editable AI drafts. Keep live searches and draft generation initiated by the user; do not call a wording match proof of need or buying intent.
2. **Research agent foundation:** durable jobs with cancellation/resumption, job-level spend reservation and settlement, usage ledger, supplier rights confirmation, source freshness, deduplication, exclusions, and evaluation across representative customer segments.
3. **Paid research product:** validated metering/entitlements, trial allowance, transparent credit rules, opt-in top-ups, and scoped API/MCP access. Size allowances from measured costs and customer willingness to pay.
4. **Assisted next steps:** evaluate the initial evidence-based draft action for factual grounding, editing effort, and actual token cost, then add explicitly connected CRM actions. Add supervised sending only after delivery, suppression, permissions, provider terms, and operating costs have been tested.

Measure per segment: queries, candidate/fetch counts, blocks/timeouts, duplicates, relevant-company yield, public-contact yield, verification outcomes, provider credits and cash cost, model tokens if introduced, latency, repeat-run savings, human relevance ratings, exports, retained users, support cost, and eventually authorized outreach outcomes. Separate one-off trial subsidies from repeatable steady-state economics. Set the final price only after these measures show what an active customer consumes.
