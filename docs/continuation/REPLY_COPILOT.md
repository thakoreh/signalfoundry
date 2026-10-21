# Local editable reply copilot — offline implementation, live use gated

This extends the reviewed future contract in reports/UX_SPEC_REVIEW_ce37b6c.md. It does not implement an inbox, autonomous classification, approval, email transport or booking. It is part of the existing manual-assisted Conversations view. Full rendered journey/provider acceptance remains pending.

## Request, review, apply

Only the latest received, manually classified interested reply or question is eligible. The saved recipient must match that inbound. Paused/suppressed/invalid/company-conflicted or missing sender/contact-basis records fail before generation. Other reply states, including referral, not-now, out-of-office and bounce, have no AI answer action. A reported outbound after the latest inbound also closes the suggestion action until another received reply is saved.

The founder explicitly reviews the disclosure and selects Request reply suggestion. It sends the saved offering, at most five limited public company excerpts and the last six actual manually recorded messages, with a bounded latest received excerpt. Unsent approved/draft text is not reported history. Sender address/contact-list fields are omitted; email/URL/phone patterns in free text are removed. **Pattern removal is not anonymization.** Names and unrecognized sensitive text may remain, so the founder must review pasted content first. No context is sent on home, refresh, tab open or typing.

The response is a separate suggestion. Use as editable reply first makes a fresh read-only snapshot check, then fills the private editor with the current saved footer. It does not save, approve, copy, open mail, send or record any outcome. Existing exact save/approval/handoff/report controls remain separate. Unsaved message, basis, received reply or timing changes block applying. Scope changes abort requests; ignored-abort late completions cannot overwrite private text.

## Grounding and limits

The model gets a fixed untrusted-data system contract, no tools or browsing, one request with at most600 output tokens, 32KiB response and existing fixed timeout/host boundaries. Structured supplied fact IDs, destination/contact checks, exact supported numeric tokens, word bounds and a separate no-unapproved-price/discount check reject obvious unsupported outputs. These checks do **not** prove semantic support, truth or consent. Every claim still needs founder review. There is no structured approved pricing catalogue, so pricing/discount/free-trial answers must be confirmed manually. The subject is inherited from the saved conversation, not invented by the model. No booking link is generated; an existing separately reviewed link stays under the ordinary interested-only approval gate.

## Durable state and money

The cache binds tenant, model/prompt version, current saved profile, full relevant thread/source/contact state, revision, latest inbound and actual reported history. A revision alone is insufficient because an unapproved thread may retain its revision when offering facts change. Generation never mutates the thread. Cached result aliases/idempotency and the combined five-attempts-per-hour draft limit reuse the existing customer draft tables, which already participate in tenant export, erasure and stale-writer closure guards. There is no separate new service or queue.

`CLIENTROVE_DEEPSEEK_REPLIES_ENABLED=true` and a private key are necessary but insufficient. The existing monetary authority must explicitly cover **deepseek:reply** with its own accepted token-priced model/bounds and credential binding. An intro/search price is not permission for replies. No real rate/history/policy/authorization was added. Existing immutable period catalogues are not overwritten to add an operation; leave the operation blocked if its current catalogue does not cover it. US$25 includes unknown earlier DeepSeek usage. No Ads allocation exists.

A fresh business-context guard runs inside the same SQLite admission transaction before reserve/dispatch. No database lock spans network IO. A stop after admission cannot retract already transmitted context: usage still settles and the final snapshot check discards changed/closed results. Timeout/uncertain usage stays held. Even unusable or stale output is charged according to measured usage, never refunded by a UI error. Applying a saved suggestion rechecks current context without a provider call. Hosted/public/off-switch paths stay denied.

## Evidence and current provider protocol

Current official [Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/) and [JSON Output](https://api-docs.deepseek.com/guides/json_mode/) documentation was rechecked2026-10-21: the existing fixed-host JSON completion shape/model is retained, with explicit token cap and no silent retries/fallback. The [pricing page](https://api-docs.deepseek.com/quick_start/pricing/) was inspected, but no rate/account terms were accepted or seeded. Monid discovery was attempted; CLI was unavailable, so official documentation was read directly. No account/provider call occurred.

Offline tests exercise context consent, reply taxonomy, recipient identity, unknown monetary history, missing/incorrect separate prices, actual-versus-approved history, cache replay, concurrent requests, predispatch fact races, inflight new replies/closure, stale applying, invalid content and safe failure. Component tests cover explicit requests, source inspection, separate apply/save/approval and ignored-abort private-edit protection. This is not live model-quality, privacy/legal clearance or fresh Chrome/device acceptance.
