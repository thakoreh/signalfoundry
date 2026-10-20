# S2 sender safety — partial checkpoint

### S2A pending Copy safety

No new setup/env/dependencies. Copy preflights current saved readiness for one immutable user intent. You can keep editing while it checks: any edit cancels that attempt, even if you restore the old text. Switching thread/view/search/session or leaving the screen also cancels it. Concurrent clicks share one pending attempt. A later explicit click starts a fresh check. Copy never saves edits or records sending; it copies only exact approved saved bytes with the current server footer/readiness, not unsaved text.

If the connection/clipboard fails, nothing is recorded as sent; fix the connection/permission and try Copy again. If approval changed, review the saved profile/footer, save and approve again; do not bypass failed readiness by manually copying supposedly approved text. Mailto/Open in email app remains absent and pending integration, not implemented or launched here.

Verification: slow-GET component races and fresh isolated Chrome clipboard/focus fixture; browser proof is component-only with mocked readiness, not the full S2/backend journey. Independent review remains next. Existing pause/stop off switches apply. Roll back this frontend-only repair using a new revert commit while preserving saved data/history; this reintroduces the race, so keep Copy unavailable until a forward fix. No schema or migration added.

Continuation: loaded nonempty drafts and explicitly generated drafts include the saved footer as unsaved reviewable text. Restore saved sender footer appends missing current details without deleting user text; review/remove any outdated footer manually, save, approve exact text. Copy re-fetches the thread and denies stale approval. Opening/copying never records sent; no mailto launch was added. Invalid/missing reachable-contact syntax blocks approval but syntax is not a provider reachability check. Booking field/common calendar URLs are blocked before interest; arbitrary custom booking URLs in prose need further review. Persistent Selling-as and real isolated Chrome flow proof remain required before S2 acceptance. Existing off-switch/rollback rules below still apply.

Status: incomplete, backend/profile subseam only. No release acceptance, deployment or permission to send.

Setup: existing local loopback stack only; no new dependencies/env/secrets. Edit business → sender name, company, mailing address, monitored contact. Missing values remain empty; old profiles stay readable. Hosted editor/payload unchanged, outreach disabled. Existing fixture businesses are fictional, not owner identity.

The backend returns `sender_footer` with the current deterministic required suffix; clients must include it in saved body before approval. Removing/altering it blocks approval. Composer insertion/recovery and fresh Chrome proof remain next; do not call this a usable complete workflow yet. Profile changes invalidate pending approval transactionally, never rewrite sent snapshots. Omitted fields from old clients preserve saved sender; explicit empty fields clear and block approval.

Off switch: stop the isolated fixture process, or pause the thread to deny approval/actions. Do not bypass footer admission. Paid reply drafting and hosted outreach remain disabled; no transport is added.

Rollback: use a new revert commit for the S2 checkpoint, not reset/rebase/force push. Preserve SQLite and sent history; additive JSON fields need no destructive migration. An older reader rejects extra JSON fields, so do not run an older binary against S2-written data without an independently tested compatibility migration. Prefer roll-forward fixes or keep the local process stopped. Never delete sender or history fields as an improvised rollback.

NEXT REQUIRED P0: contact-source/CASL publication and no-solicitation evidence, role relevance, and region gates; footer is not legal compliance. External connections/sending remain gated. Full S2 browser, exact-head CI, checkpoint push and independent review are pending.
