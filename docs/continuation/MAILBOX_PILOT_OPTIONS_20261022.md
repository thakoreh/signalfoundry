# Mailbox decision before building the engine

Researched **2026-10-22**, official public sources only. USD before tax. No account, purchase, API request, mailbox connection or send. Engine implementation has not started under this latest steering. Monid unavailable as already documented; no installation or signup.

## Recommendation

**First choice: an already-owned Outlook.com/Microsoft365 mailbox, if available and owner-authorized, for consented beta conversations.** Incremental mailbox/domain cost can be **$0**. Start with the existing manual handoff and pasted-reply ledger. A future Clientrove-owned Microsoft Graph delegated OAuth adapter could connect that mailbox; account permission, actual terms, admin controls and exact-message approval remain necessary. This is not permission for unsolicited cold campaigns.

**Paid backup: Microsoft365 Business Basic without Teams, monthly commitment, $6.48/user/month**, plus a domain if needed. Same Graph integration family, avoiding another SMTP/IMAP implementation. Current official Basic page lists $5.40/month paid yearly or $6.48 monthly without Teams; with Teams $7 paid yearly or $8.40 monthly. [Microsoft pricing](https://www.microsoft.com/en-us/microsoft-365/business/microsoft-365-business-basic) (checked2026-10-22).

**Cold-campaign permission is unresolved.** None of the cheap mailbox options reviewed was explicitly verified to permit this planned AI cold engine. Provider terms are an independent gate from US/Canadian legal requirements. Obtain written provider acceptance of the actual targeting, consent basis, automation and volume, or limit beta to recipients who requested/agreed to the messages. No purchase or connection is authorized by this recommendation.

## Comparison

All claims and linked sources checked2026-10-22. Quotas are ceilings, not recommended sending volumes or permission.

| Option | Price/commitment | Connection and quota evidence | Policy verdict |
|---|---|---|---|
| Existing personal Gmail | $0 incremental if owned; custom domain not included | Gmail API OAuth; SMTP/IMAP technical routes exist. Personal limit error above500messages/day; actual restrictions vary. | Program Policies prohibit **spam or unsolicited commercial mail**, not only bulk. No “manual targeted cold” exception inferred. Consented correspondence only; not preferred for public beta verification overhead. [Policy](https://support.google.com/mail/answer/16734397), [limits](https://support.google.com/mail/answer/22839?hl=en), [OAuth scopes](https://developers.google.com/workspace/gmail/api/auth/scopes). |
| Existing Outlook.com / licensed Microsoft365 | $0 incremental if already owned and appropriately licensed | Graph delegated mail-read and Mail.Send support personal/work/school accounts. Consumer subscriber limits:5,000recipients/day,500/message,1,000new/non-relationship recipients/day; non-subscribers/history-based limits can be lower. | Consumer agreement forbids unwanted/unsolicited bulk spam. Business Exchange has different applicable agreements/admin controls. **Conditional preferred consented-beta option**, not verified cold-campaign permission. [Graph permissions](https://learn.microsoft.com/en-us/graph/permissions-reference#mailread), [consumer agreement](https://www.microsoft.com/en-US/servicesagreement), [consumer limits](https://support.microsoft.com/en-us/outlook/sending-limits-in-outlook-com). |
| Zoho Mail Lite | 5GB $1/user/month or10GB $1.25, **billed annually, no monthly plan**: $12/$15 yearly. Free tier is region-dependent and lacks IMAP/POP/ActiveSync. | Paid IMAP/SMTP; Mail API exposes OAuth-scoped send/message/thread operations. Free-tier API/SMTP entitlement must not be assumed. Dynamic50–500external messages/hour; bulk/burst unsupported. | September2,2026 usage policy explicitly excludes promotional, marketing and **automated emails**. **Reject for agent sending absent a provider exception.** [Pricing](https://www.zoho.com/mail/zohomail-pricing.html?src=zmailbottom), [usage policy](https://www.zoho.com/mail/help/usage-policy.html), [paid/free access](https://www.zoho.com/mail/help/adminconsole/subscription.html), [API](https://www.zoho.com/mail/help/api/), [IMAP](https://www.zoho.com/mail/help/imap-access.html), [limits](https://www.zoho.com/mail/help/adminconsole/rates-and-limits.html). |
| Fastmail Standard | $6/user monthly; $5 equivalent paid as **$60 for12months**. Domain purchase separate. Basic is not a substitute for Standard third-party access. | JMAP send/sync, SMTP/IMAP and third-party OAuth documented. Personal token/app-password options exist. Fixed Standard daily throughput not verified in this bounded pass. | July2,2026 terms prohibit unsolicited commercial messages **and programmatically generated external mail**. **Reject as automated agent transport**; do not assume human approval overrides wording. [Pricing](https://www.fastmail.com/pricing/us/), [developer access](https://www.fastmail.com/dev/), [terms](https://www.fastmail.com/policies/terms-of-service/). |
| Exchange Online Plan1 | $4/user/month **paid yearly**, $48/year. Custom domain capable, domain extra. Month-to-month $4 not verified. | Graph OAuth; SMTP/IMAP depend on tenant authentication/admin settings. Published10,000recipients/day and30messages/minute; other anti-abuse/tenant controls apply. | Exchange is not intended for bulk mailing. Conditional consented-beta option; no blanket cold permission. Annual cash unattractive now. [Plan](https://www.microsoft.com/en-us/microsoft-365/exchange/exchange-online-business-plans-and-pricing), [limits](https://learn.microsoft.com/en-us/office365/servicedescriptions/exchange-online-service-description/exchange-online-limits). |
| Microsoft365 Basic | Without Teams $6.48 monthly or $5.40 paid yearly; with Teams $8.40 monthly or $7 paid yearly. Domain extra. | Graph OAuth and business admin controls. Desktop Outlook app purchase is unnecessary for API access. Exchange limits/policy apply. | Recommended paid backup **for consented beta**; actual account agreement/admin restrictions must be checked. [Basic pricing](https://www.microsoft.com/en-us/microsoft-365/business/microsoft-365-business-basic). |
| Google Workspace Starter | $8.40 flexible/month; $7 with annual commitment ($84/year obligation; payment cadence differs). Domain extra. | Gmail API/SMTP/IMAP OAuth; paid general limit2,000messages/day, trials500, separate recipient/protocol limits. | Paying does not remove Gmail unsolicited-commercial restriction or OAuth requirements. Not selected for cold outreach. [Billing comparison](https://knowledge.workspace.google.com/admin/billing/compare-flexible-and-annual-fixed-term-payment-plans), [sending limits](https://knowledge.workspace.google.com/admin/gmail/gmail-sending-limits-in-google-workspace), [policy](https://support.google.com/mail/answer/16734397). |

## Concrete cost, including cash versus monthly equivalent

Porkbun live standard `.com` table shows **$11.08 registration and renewal**. This excludes premium-name availability, applicable taxes and conversion. Reuse an existing suitable domain; no lookalike/domain fleet. [Current domain table](https://porkbun.com/products/domains) (checked2026-10-22).

| Scenario | Initial cash before tax | Later cost / implication |
|---|---:|---|
| Existing owner mailbox/identity/domain | **$0 incremental** | Existing costs remain whatever owner already pays. Preferred if eligible. |
| Basic without Teams monthly, existing domain | **$6.48** | $6.48/month, no annual commitment selected. |
| Same + new standard `.com` | **$17.56** =6.48+11.08 | $6.48/month plus domain renewal yearly. Only$7.44 of$25 remains **if prior spending were zero**, before tax. Actual remainder unknown. |
| Exchange Plan1 paid yearly + domain | **$59.08** =48+11.08 | Amortized4.92/month is not the initial bill. Exceeds a strict first-month$25 cash cap before DeepSeek. |
| Fastmail Standard monthly + domain | $17.08 | Price arithmetic does not cure automated-mail policy restriction. Annual mailbox60 alone exceeds upfront ceiling. |
| Zoho Lite5GB annually + domain | $23.08 | Only1.92left under zero-prior assumption, before tax; marketing/automated use excluded anyway. |

US$25 includes existing DeepSeek usage. Unknown actual history means unknown remaining budget: no new paid dispatch or purchase can be declared affordable. Ads allocation unresolved; allocate none. No trial credits, promotional prices, new subscription or top-up is assumed. Annual commitment, annual payment and monthly billing are different. Local Canadian checkout/currency/tax may change these US list-price calculations.

## What the application can actually connect

A future **Clientrove-owned OAuth integration** is required. The Codex Gmail connector, a ChatGPT/Codex subscription or this chat's permissions are not the application's mailbox integration or license. Current Clientrove transport remains unconnected.

For a one-mailbox Graph pilot use delegated user consent and the minimum permissions: Mail.Read for inbox bodies, Mail.Send for sending; add Mail.ReadWrite only if actual provider-draft editing needs it. Avoid application-wide “send as any user” access. Delegated Mail.Send and Mail.Read are documented for personal accounts as well as work/school; organizations can still restrict consent. [Permissions](https://learn.microsoft.com/en-us/graph/permissions-reference#mailread).

Build cost is **unpriced engineering**, not free: app registration/callback security, encrypted/revocable tokens, tenant/mailbox binding, durable outbox and exact approval recheck, inbound sync/checkpoints/recovery, duplicate and forwarded-reply handling, suppression, disconnect handling and ambiguous-send reconciliation. Graph202 is accepted, not delivered. [sendMail contract](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0).

Gmail send scope is sensitive; read/compose restricted. Public beta verification and server-side security assessment obligations/exceptions require resolution, including disclosure/consent for mailbox-text transfer to DeepSeek. No assessment cost or exception was verified for this app. [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes). SMTP alone does not solve reply capture. Fastmail/Zoho API availability does not override sending terms.

## Transactional APIs are not a policy workaround

- **Resend:** prohibits unsolicited messages including cold outreach and purchased/scraped contact lists. [AUP](https://resend.com/legal/acceptable-use).
- **Mailgun:** non-transactional email requires explicit provable recipient permission, with confirmed opt-in described by its policy. [AUP](https://www.mailgun.com/legal/aup/).
- **SES:** AWS AUP prohibits unsolicited mass messaging. SES first-party guidance says messages must clearly connect to the organization the recipient signed up with. Cheap rates are not campaign approval. [AWS AUP](https://aws.amazon.com/aup/), [SES recipient guidance](https://aws.amazon.com/blogs/messaging-and-targeting/do-your-recipients-know-who-you-are/) (older guidance; not a replacement for current account terms).

These also are not a complete human mailbox plus reliable inbox sync by default. No transactional provider is selected here.

## Decisions before building or connecting

1. Confirm whether an owner-controlled Outlook/Microsoft365 mailbox and domain exist: plan/type only, no passwords/keys or reading private mailbox contents.
2. Choose **consented beta conversations** versus keeping **unsolicited cold outreach** as the requirement. For cold outreach, obtain written provider acceptance of exact targeting, consent basis, AI generation, automation, volume and followup behavior. None is currently verified.
3. Reconcile prior DeepSeek spend; approve exact mailbox/domain commitment if needed. A sub-$25 quote is not spending authority.
4. Only after choosing a permitted mailbox should the engine/one-provider adapter be designed and reviewed with offline fixtures. Later connection must use the provider's own authorization screen and separate explicit authorization; no actual connection or send now.

Maintain maximum5contacts, one exact owner-reviewed message at a time, actual-consent beta recipients and stop-on-inbound; provider quota is not a volume target. US/Canada legal gates remain in OUTREACH_AGENT_RESEARCH_20261022.md and provider permission is additional. Not legal advice. Cheapest credible consented pilot: conditional existing mailbox. An unrestricted cheap cold-campaign mailbox has **not** been established; policy ambiguity remains a blocker.
