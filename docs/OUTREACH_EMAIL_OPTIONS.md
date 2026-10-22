# Cheapest credible first email/reply transport

**Latest October22 steering:** customers' main inboxes must not be used. The [Instantly comparison](continuation/INSTANTLY_PILOT_OPTIONS_20261022.md) now supersedes the existing-mailbox suggestion as the pilot decision:47USD platform alone, at least112 first-month component estimate for the published minimum pre-warmed package, outside the25USD total ceiling. No provider selected or connected; reply/API/commercial and permission gates remain. The older consented-test comparisons below are retained as history, not authority to connect a customer's main mailbox.

**October22 update:** the owner wants a cheap permitted mailbox chosen before building the actual sending engine. The [current mailbox comparison](continuation/MAILBOX_PILOT_OPTIONS_20261022.md) supersedes older shortlist/pricing inferences below: existing owner Outlook is a conditional consented-test candidate; Microsoft365 Basic without Teams has a6.48USD month-to-month option. No reviewed provider is verified to permit the planned cold campaign, and no account is connected. US25includes historical DeepSeek usage; remaining funds are unknown and Ads has no allocation. See also [official-source agent research](continuation/OUTREACH_AGENT_RESEARCH_20261022.md). Historical comparison follows.

Checked October 19, 2026 against primary vendor documentation. Prices below are public US-dollar list prices, before taxes, domains, hosting, AI, verification, and advertising. No account, key, mailbox, purchase, or sending was configured. Monid discovery was attempted but its CLI was unavailable; official sources were used directly.

**Recommendation:** first test permitted conversations using an existing authorized mailbox, with manual send/reply entry in the app. That avoids buying transport before learning whether the workflow is useful. For a subsequent integrated pilot, connect that same mailbox with delegated OAuth and explicit send approval. The user's existing mailbox/license and permitted use are still unknown; no provider is approved here for unsolicited prospect-list emailing.

## Comparison

| Option | Verified price/billing | Sending and replies | Fit for this pilot |
| --- | --- | --- | --- |
| Existing Gmail/Workspace or Outlook mailbox | No *new mailbox subscription* if already owned and appropriately licensed. This does not mean the full integration or cloud operation is free. | Manual email works first; provider APIs can later send and retrieve replies. | Lowest incremental commitment for authorized test conversations. Check account/admin terms and recipient permission first. |
| New Google Workspace Business Starter | **$8.40/user/month flexible**, no annual commitment; **$7/user/month annual commitment** ($84/year). [Official billing comparison](https://knowledge.workspace.google.com/admin/billing/compare-flexible-and-annual-fixed-term-payment-plans). | Gmail inbox plus OAuth API. | Flexible billing is a smaller cash commitment than buying an annual mailbox for a one-month test. These prices do not establish permission for cold outreach. |
| Microsoft Exchange Online Plan 1 | **$4/user/month, paid yearly**: $48/year before extras. Business Basic is currently **$7/user/month, paid yearly**, not the older $6 figure. [Official plans](https://www.microsoft.com/en-us/microsoft-365/exchange/exchange-online-business-plans-and-pricing). | Exchange mailbox with delegated Graph mail access. | The $4 headline is an annual effective rate, not a verified $4 one-month purchase; a $48 annual payment exceeds a strict $25 initial cash ceiling. Reuse an existing license if available. |
| SMTP + IMAP against an existing mailbox | Protocols, not a separate free mailbox or exemption from its terms. OAuth is supported by [Google](https://developers.google.com/workspace/gmail/imap/xoauth2-protocol) and [Microsoft](https://learn.microsoft.com/en-us/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth). | SMTP sends; IMAP reads replies. Clientrove must still implement thread matching, synchronization, retries, and protected credentials/tokens. | A compatibility alternative, not automatically cheaper or simpler than the native mailbox API. Do not collect users' normal mailbox passwords. |
| Sending APIs | SES lists **$0.10/1,000 outbound emails à la carte**, plus data/add-ons; new accounts default to **Essentials at $0.16/1,000** under the published 2026 pricing. [SES pricing](https://aws.amazon.com/ses/pricing/). | A sending API is not, by itself, a two-way mailbox. Reply processing and app operations are additional work/cost. | Cheap units do not make it the cheapest complete conversation pilot. Provider permission also matters: see below. |

## Provider permission changes the shortlist

Consumer Gmail's policy prohibits unsolicited commercial mail; Workspace's AUP prohibits unsolicited mass promotions. Buying Workspace or using OAuth does not remove these restrictions. [Gmail policy](https://support.google.com/mail/answer/16734397?hl=en), [Workspace AUP](https://workspace.google.com/terms/use_policy/).

Microsoft says Exchange Online is not designed for bulk mailing and can restrict accounts that send spam or exceed limits. Its numerical limits are ceilings, not permission or a safe outreach target. [Microsoft guidance](https://learn.microsoft.com/en-us/defender-office-365/outbound-spam-sending-limits-troubleshoot).

**Resend is not a fit for unsolicited cold outreach:** its current AUP explicitly excludes cold outreach, purchased lists, and scraped contact data, and requires recipient opt-in. [Resend AUP](https://resend.com/legal/acceptable-use). SES also investigates or pauses unsolicited sending; its low unit price is not approval for a scraped-lead workflow. [SES enforcement guidance](https://docs.aws.amazon.com/en_en/ses/latest/dg/faqs-enforcement.html).

This is a provider-compatibility finding, not a legal determination about a specific market. Recipient jurisdictions, the actual message, consent/other applicable permissions, and the user's account agreement have not been established. An email being public or verified does not establish permission to contact it.

## The lean integration pattern

The official APIs support two practical architectures; this is an engineering comparison, not a survey proving what most builders use:

1. **Connect an existing mailbox.** Gmail has a send-only sensitive scope; reading reply bodies uses restricted scopes. Public apps may need verification, and transmitting/storing restricted data can require a security assessment. Standard Gmail API use is currently listed at no additional cost, but the page also announces future over-quota charging; avoid budgeting an unrestricted free integration. [Scopes/review](https://developers.google.com/workspace/gmail/api/auth/scopes), [current quota/pricing](https://developers.google.com/workspace/gmail/api/reference/quota).
2. **Use delegated Outlook Graph mail access.** `Mail.Send` supports signed-in personal and work accounts; reply retrieval requires a separate read permission. This keeps mailbox ownership with the user. A successful send API acceptance must not be relabeled as delivery, a reply, or a booking. [Send API](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0), [permission reference](https://learn.microsoft.com/en-us/graph/permissions-reference).

Start with a narrow authorized test, encrypted per-user tokens, exact-content approval, idempotent sending, thread IDs, durable opt-out suppression, and manually reviewed replies. Gmail push sync additionally uses Cloud Pub/Sub, requires watch renewal, and needs recovery for missed updates; it is more than a send button. [Gmail notifications](https://developers.google.com/workspace/gmail/api/guides/push). Do not buy mailbox fleets, dedicated IPs, or multiple domains for this initial test.

## Budget decision still needed

Keep mailbox/hosting/AI delivery cost separate from Google Ads acquisition spend. Whether the stated **US$25** covers software alone or software **and** ads is unresolved; no ad allocation has been assumed. A new flexible Workspace mailbox would consume $8.40 before tax and other costs, while an already-owned permitted mailbox adds no new mailbox subscription. Neither amount proves the entire product fits the cap. Actual AI/search attempts, failed work, hosting, and any API/cloud charges need measured limits before autonomous sending or AI replies are enabled.

Next, identify the mailbox already available and confirm the permitted pilot use before choosing or buying an integration.
