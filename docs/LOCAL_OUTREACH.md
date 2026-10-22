# Persistent local outreach review

Current continuation: the local flow now includes fresh referral contacts, bounded dated manual followups, timed meeting/confirmation reports, Next up/saved return, a reported-company activity summary, exact mailto handoff and logical local data controls. Optional editable AI reply suggestions are implemented with offline evidence under a separate default-off flag, context disclosure and monetary gate; no live use is authorized or verified. See [current status](continuation/STATUS.md), [reply contract](continuation/REPLY_COPILOT.md) and [consolidated setup](continuation/LOCAL_SETUP.md). Hosted/inbox/send/calendar remain unavailable; no connected capability is implied.

This is a real SQLite-backed private local workflow. It does not connect an inbox,
send mail, detect replies, create calendar events, or assert that a meeting or sale
actually happened. SaaS must fail closed until it has tenant-authenticated hosted
persistence for these routes. Public previews reject both reads and writes.

The workflow opens one conversation per saved search/customer, for at most five
selected qualified customers. It reopens that same conversation after refresh.
Matching cached initial AI drafts can be reused without a provider request;
otherwise the user can write a message. Recipient, subject, body and optional
public HTTPS booking link are saved before approval. Manually entered addresses
are labeled as user entered, not verified.

Approval hashes the exact recipient, subject, body, booking link and latest
inbound message identity. Changed saved message fields invalidate approval, as do
new/corrected replies and pause changes. A stale browser revision cannot overwrite
or approve a newer saved version. Replaying an idempotency key never duplicates
an event or restores an obsolete approval; it returns current conversation state.

**Record sent outside Clientrove** is a user-reported ledger event only. It stores
the exact approved recipient/subject and body plus optional
`\n\nBooking link: <saved link>`, the immutable link field and approved content hash.
There is no transport call. Recording clears the composition body and approval,
so another outbound record needs a new saved and approved message.

Pasted replies are user-entered records, not inbox detection. The user reviews or
corrects `awaiting_review`, `interested`, `question`, `not_now`, `not_interested`,
`opt_out` or `uncertain`. After any inbound reply, only `interested` and `question`
permit a newly reviewed response. All other reply states, a pause or a suppression
block approval and action readiness. Obvious unsubscribe language is conservatively
recorded as an opt-out even if an affirmative classification was selected.

Opt-outs persist across saved searches for the canonical company domain and the
recorded inbound/current email addresses. Editing the recipient, reopening a
search, unpausing or changing a classification does not remove suppression. This
initial workflow has no resubscription/unsuppression operation. A later consent
restoration protocol must be an explicit separate feature.

A booking link is only a link. Booked, attended, no-show and cancelled meeting
states are explicitly user reported. Attendance/no-show requires a prior reported
booking. Customer outcomes (`won_reported`, `lost_reported`) are separate user
reports; neither a link nor a meeting implies a sale.

## Spending boundary

No new service or real paid call was used to implement this workflow. Responses
can always be written and reviewed manually. Optional AI reply suggestions reuse
DeepSeek only after explicit context review, default-off activation and the
same durable global/tenant monetary admission used by search and introductions.
The separate deepseek:reply operation needs its own accepted token-price bound;
an intro/search policy is insufficient. Actual earlier DeepSeek usage remains
unknown, and the US$25 ceiling is not spending permission. Count limits alone
do not establish a dollar guarantee. See continuation/MONETARY_SAFEGUARDS.md.

## API

`POST /api/outreach` accepts only `search_id`, `account_ids` (1–5 unique eligible
saved account IDs) and `idempotency_key`. It returns `{threads: [...]}`.
`GET /api/outreach?search_id=...` returns that search's full saved threads;
`GET /api/outreach` returns up to 100 concise summaries, and
`GET /api/outreach/{id}` returns a full conversation.

Every thread mutation accepts `expected_revision` and `idempotency_key`:

- `PUT /{id}/draft`: `recipient`, `subject`, `body`, optional `booking_link`.
- `POST /{id}/approve`: no additional fields.
- `POST /{id}/sent`: optional `sent_as` (`approved` by default or `with_changes`), `actual_subject`, `actual_body`; changed reports require complete actual subject/body. Records a manual report only, retaining original approved text/hash separately. Recipient changes are not supported; see overnight/S1_SETUP.md.
- `POST /{id}/replies`: pasted `body`, optional `reply_state` (defaults to review).
- `PATCH /{id}/reply-state`: corrected `reply_state` for the latest pasted reply.
- `PATCH /{id}/pause`: `paused` boolean.
- `PATCH /{id}/outcomes`: `meeting_state` and `sale_state`, both explicit reports.

`POST /{id}/reply-draft` accepts `expected_revision`, `idempotency_key`, explicit
`context_confirmed: true` and `context_version: "reply-context-v2"`. It returns a
separate snapshot-bound suggestion, never a thread mutation or approval. New
generation stays unavailable without the reply flag, active eligible inbound,
source/sender admission and monetary authority. Unchanged cached suggestions
can reopen without another provider call. The legacy empty object returns503;
older v1 consent fails validation. No request here authorizes real spending.

`POST /{id}/reply-draft/check` accepts `expected_revision` and `snapshot_key` and
only rechecks current context before filling the private editor. It has no paid
dispatch and creates no approval or send. Exact Save/Approve remains separate.

Local limits are 100 conversations, 50 messages per conversation and 10,000
accepted distinct mutation/create requests per tenant. Persistence is scoped to
the server-controlled local tenant. This organization is not authentication;
the unauthenticated local API must remain bound to loopback.
