# S2 sender safety — partial checkpoint

Status: incomplete, backend/profile subseam only. No release acceptance, deployment or permission to send.

Setup: existing local loopback stack only; no new dependencies/env/secrets. Edit business → sender name, company, mailing address, monitored contact. Missing values remain empty; old profiles stay readable. Hosted editor/payload unchanged, outreach disabled. Existing fixture businesses are fictional, not owner identity.

The backend returns `sender_footer` with the current deterministic required suffix; clients must include it in saved body before approval. Removing/altering it blocks approval. Composer insertion/recovery and fresh Chrome proof remain next; do not call this a usable complete workflow yet. Profile changes invalidate pending approval transactionally, never rewrite sent snapshots. Omitted fields from old clients preserve saved sender; explicit empty fields clear and block approval.

Off switch: stop the isolated fixture process, or pause the thread to deny approval/actions. Do not bypass footer admission. Paid reply drafting and hosted outreach remain disabled; no transport is added.

Rollback: use a new revert commit for the S2 checkpoint, not reset/rebase/force push. Preserve SQLite and sent history; additive JSON fields need no destructive migration. An older reader rejects extra JSON fields, so do not run an older binary against S2-written data without an independently tested compatibility migration. Prefer roll-forward fixes or keep the local process stopped. Never delete sender or history fields as an improvised rollback.

NEXT REQUIRED P0: contact-source/CASL publication and no-solicitation evidence, role relevance, and region gates; footer is not legal compliance. External connections/sending remain gated. Full S2 browser, exact-head CI, checkpoint push and independent review are pending.
