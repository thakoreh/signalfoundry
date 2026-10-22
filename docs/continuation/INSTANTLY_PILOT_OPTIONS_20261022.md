# Separate sending accounts: Instantly pilot decision

Official public research checked **2026-10-22**. USD before taxes. No signup, account, card, API key, provider request, purchase, mailbox connection, send or engine implementation. Root remains product writer. Latest owner requirement excludes customers' main inboxes; the previous existing-Outlook suggestion is historical consented-test context, **not this recommendation**.

## Verdict

**Instantly fits the separate-outbound-inbox category but not the current US$25 total budget.** Its lowest ongoing Outbound subscription is $47/month before domains, mailbox hosting or AI credits. Even with zero historical DeepSeek usage, this exceeds the cap. Unknown prior usage makes the remaining budget smaller or unknown, not an extra$25.

The published pre-warmed offer has a **five-account minimum**, so the optimistic first-month lower bound is **$112**: Growth47 +5Google accounts×10 +at least one domain15. Actual domain distribution/tax may increase that. Full reply management/webhooks is documented on Hypergrowth97; that combination starts at **$162** under the same one-domain assumption. These are estimates from published components, not inspected checkout totals.

Do not buy a$10 “warmed account” assuming it runs independently. Platform, domain and inbox subscriptions are separate. Nothing is approved to purchase or connect. No sender should impersonate a customer or hide which legal business it represents.

## Price layers and initial cash

Current [Instantly pricing](https://instantly.ai/pricing) lists Growth47 and Hypergrowth97 monthly. Annual-equivalent rates are37.60 and77.60; annual advance commitment/payment is not a month-to-month discount. Their annual totals are451.20 and931.20 before inboxes. The same page also contains bundles/other product tabs; use the Outbound-only rows, not a credits/CRM price. [Terms](https://instantly.ai/terms) describe advance monthly/yearly payments and separate fees. Checked2026-10-22.

| Setup | Published component arithmetic / initial lower bound | What it does and does not buy |
|---|---:|---|
| Growth with BYO separate mailbox/domain | **$47 + externally purchased inbox/domain costs** | Outbound platform; “unlimited accounts” means ability to connect accounts, not unlimited hosted inboxes included. |
| Growth + one DFY AirMail + one domain | **$66** =47+4+15, if a one-inbox order is accepted | New Instantly-native infrastructure; not the pre-warmed product. Quantity/order availability must be confirmed. |
| Growth + one DFY Google + one domain | **$67** =47+5+15, if a one-inbox order is accepted | Newly provisioned Google mailbox. Not pre-warmed; provider policy and reputation building remain. |
| Growth + minimum five pre-warmed Google accounts | **at least$112** =47+50+15 | Five-account batch required. More than one domain increases the total by15/domain/year. |
| Hypergrowth + same minimum pre-warmed batch | **at least$162** =97+50+15 | Adds documented Unibox reply/webhook tier; no extra AI credits included in this estimate. |

Sources: [billing separation and component rates](https://help.instantly.ai/en/articles/13559163-understanding-your-billing-charges), [DFY Google setup](https://help.instantly.ai/en/articles/9361043-done-for-you-google-email-setup), [AirMail setup](https://help.instantly.ai/en/articles/14893942-instantly-airmail-accounts-setup), [pre-warmed account offer](https://help.instantly.ai/en/articles/9969215-pre-warmed-domains-accounts). All checked2026-10-22. DFY pages show editable inbox counts/max5 per domain, but no checkout or exact minimum order was inspected; the one-inbox rows are **conditional arithmetic, not guaranteed offers**.

Domain15 is charged yearly, inboxes recur monthly and renew separately. Once the domain is paid, Growth plus five pre-warmed mailboxes is97/month before taxes and other products. Instantly's own AI reply/lead features consume separately priced data credits; no extra credits are assumed here. No promo/free trial is used to make the ongoing economics fit25.

## Who owns and hosts the separate inboxes

- **BYO:** customer or operator buys genuinely separate mailboxes/domains from a permitted provider and connects them; the owner specifically excluded main inboxes. No blanket permission is created by connecting a Gmail/Outlook account.
- **DFY Google:** Google-managed mailboxes; platform provisioning/management does not erase Google's own rules. [DFY Google documentation](https://help.instantly.ai/en/articles/9361043-done-for-you-google-email-setup).
- **AirMail:** Instantly describes its own private SMTP infrastructure, operated inside its dashboard, with **no standalone AirMail inbox UI**. It explicitly markets this product for cold outreach. It is new-account infrastructure, not the pre-warmed Google package. [AirMail documentation](https://help.instantly.ai/en/articles/14893942-instantly-airmail-accounts-setup).
- **Pre-warmed:** Google only in current docs. Instantly retains domain ownership/admin control, cannot transfer them, and configures these accounts exclusively for Instantly. Domain choices are existing inventory rather than customizable names. Cancellation can remove Gmail access and delete Unibox conversations after the documented grace period. This is a hosted/rented operational dependency, not a portable purchased mailbox asset. [Pre-warmed terms/details](https://help.instantly.ai/en/articles/9969215-pre-warmed-domains-accounts).

All above are public vendor descriptions, not independently verified infrastructure, permission or delivery evidence. Plan export/retention, tenant separation and offboarding before any use.

## API integration: important correction and unresolved entitlement

**API access is currently documented on all paid Outbound plans, including Growth.** The free trial has no API. Do not repeat older claims that API access itself needs Hypergrowth. APIv1 was deprecated January19,2026; usev2/scoped keys. [APIv2 help](https://help.instantly.ai/en/articles/10432807-api-v2), [plan table](https://help.instantly.ai/en/articles/7920548-outbound-plans-comparison).

However, the same table lists Growth **without Reply from Unibox or webhooks**; Hypergrowth supports them. This is not proof the reply API works on Growth. The public [reply endpoint](https://developer.instantly.ai/api-reference/email/reply-to-an-email) exists and binds an outgoing reply to an existing email UUID, but the examined reference did not establish Growth-specific reply entitlement. Obtain written confirmation of **list/read inbox, send a human-approved reply, pause/block, webhook or allowed polling**, including any additional CRM/credits requirement. Do not build around an assumed entitlement or use an endpoint to bypass a plan restriction.

[Webhook help](https://help.instantly.ai/en/articles/6261906-webhooks) specifically requires Hypergrowth or above. Growth polling might be an option only if inbox-read rights, limits and commercial use are confirmed; reliable sync/reconciliation remains implementation work. An API key is not authority to send, and approval still belongs to Clientrove's exact recipient/content/revision/suppression snapshot.

## Review modes, stops and actual remaining costs

Instantly's [AI Reply Agent guide](https://help.instantly.ai/en/articles/11774076-ai-reply-agent) documents Human-in-the-Loop review/edit/approval and Autopilot. Autopilot requires Hypergrowth or above; generated replies cost **5data credits even if unused/edited**. A monthly agent credit budget can stop new generations. These are distinct charges from mailboxes/Outbound. Existing DeepSeek could avoid buying that AI feature if permitted API reply access is confirmed; that does **not** remove transport cost or accepted monetary admission requirements.

Keep exact approval in Clientrove; do not silently enable a second platform's autonomous reply/campaign manager. Provider read/write operations need a tenant-bound account mapping, durable outbox, duplicate handling, ambiguous-send reconciliation and independent unsubscribe checks. No automatic account connection, send or new paid model call is authorized now.

[Stop-on-reply troubleshooting](https://help.instantly.ai/en/articles/13886841-why-follow-ups-are-still-being-sent-to-leads-who-replied) documents default stop-on-reply and exceptions: campaign moves/reuploads can reset progress; different-address replies may be unmatched; inactive/unconnected sending/Reply-To accounts can prevent detection. [Blocklist guidance](https://help.instantly.ai/en/articles/7913412-how-to-stop-sending-to-specific-leads) describes ongoing campaign checks. Clientrove must preserve durable stops across reimport/replay and fail closed when inbox sync is unhealthy; a vendor status alone is insufficient.

## Warmed-up is not permitted, guaranteed, or risk-free

Instantly's [technical addendum](https://instantly.ai/technical-parameters-addendum) explicitly disclaims improved reputation/deliverability and immunity from blocklists or service disruption. Warmup metrics are estimates. Separation from a main inbox reduces direct operational coupling; it does not prove that reputation, brand trust or legal responsibility is unaffected.

The [warmup settings guide](https://help.instantly.ai/en/articles/7988514-warmup-settings) describes simulated reading, opening and moving messages out of spam. **This report does not recommend or authorize manufactured engagement, reputation manipulation or bypassing mailbox-provider controls.** Treat genuine account history, correct authentication, clear identity and restrained permitted sending separately from vendor warmup marketing. Fresh DFY is not instant maturity.

The [Sending Policy](https://instantly.ai/instantly-sending-policy) requires clear opt-out, immediate suppression and accurate From/Reply-To identity; it also states sending domains should be at least one month old with transparent records/legal-page redirect, and third-party-domain sending must be disclosed. Those are more specific constraints than “buy domain and send today.” Fulfil applicable recipient-country requirements too. [Gmail policy](https://support.google.com/mail/answer/16734397) prohibits unsolicited commercial mail; buying pre-warmed Google accounts does not establish an exception. AirMail's explicit cold-email product positioning is materially different, but remains subject to its Sending Policy and law. No provider/legal clearance was obtained.

### Commercial embedding is a separate gate

Current [Instantly terms](https://instantly.ai/terms) §6.3 do not grant a license to resell/commercialize specified outputs/data, and connected-account terms still apply. A Clientrove integration serving multiple customers is not automatically licensed because an API exists. Obtain written API/agency/embedded-product rights, data usage/retention terms, account ownership and tenant-isolation conditions before choosing it as the product's backend. This is a contract question, not a conclusion that all ordinary agency/API use is prohibited.

## One potentially cheaper alternative: Explee managed sending

[Explee](https://explee.com/) advertises managed sending inboxes and about$0.04/email with no required Agent subscription. That matches the owner's wish to avoid main inboxes and could have lower fixed cost. It is an alternative **to investigate**, not a confirmed under25 solution or a generic mailbox supplier.

Crucially, its [terms updatedOctober22,2026](https://explee.com/terms-of-use) permit saved-card, postpaid/off-session usage charges and describe separately billed Agent features/mailbox/domain packages. Campaign auto-management and automatic replies are described as default-on settings. Do not treat the homepage price or welcome credits as a safe hard budget, or assume every feature is included. Account-specific rate, required minimum, package fees, true hard-spend limit, human-only approvals and commercial embedding permission remain unverified. [Public API](https://api.explee.com/public/api/docs) documents org-owned campaigns, reply gates and daily-budget0 stop, but that is not proof of a reconciled monthly25cap or resale rights.

No account/card/trial was created. Hypothetical100emails×$0.04=$4 is merely usage arithmetic, **not a checkout quote** and excludes all unknown charges and DeepSeek. Default-autonomy/postpaid behavior makes an unsupervised trial inappropriate. This is the only alternative compared in this bounded pass.

## Practical next decision

1. **Keep25 total:** do not buy Instantly. Preserve the separate-inbox requirement; do not revert to customers' main inboxes. Obtain a written managed-sending quote/permission and hard-spend controls for a tiny supervised pilot, or keep the engine's transport design gated. Prior DeepSeek history must be reconciled first; allocate no Ads spend.
2. **Consider a larger budget:** Instantly's new-account AirMail route has conditional first-month arithmetic from66; published pre-warmed Google batch starts at least112. If reliable integrated reply/webhook handling is needed, plan the documented Hypergrowth tier and confirm all rights/fees before approval. These are optional decision figures, not permission to purchase.
3. **Before implementation:** settle billing ownership (operator or each customer), mailbox/domain ownership, plan/API reply rights, recipient markets/basis, human-only review, stop rules, export/offboarding and a hard reconciled budget. Do not use main inboxes, create accounts, authorize warmup, purchase domains or launch a live campaign during research.

No cost, deliverability, reply rate, provider permission, legal compliance, margin or customer-acquisition guarantee follows from this memo. All examples are component arithmetic; taxes, regional prices, order quantities and terms must be confirmed before any purchase. Product source was not changed.
