# S1 local snapshot checkpoint

Not a release candidate. Hosted outreach, connected mail/calendar and AI replies remain disabled. Sender/footer/contact-basis/jurisdiction admission is NOT implemented; do not use this checkpoint for real outreach. Research compliance report is not legal sign-off.

## Existing commands

Run: `bash scripts/dev.sh` (loopback only; inspect ports first). Test: `bash scripts/check.sh` (inspect launcher/integration ports before running alongside other work).

Isolated verification in this stage uses `FRONTEND_PORT=3001 BACKEND_PORT=8017 SIGNALFOUNDRY_DB_PATH=<fresh fixture path> DECISION_ENGINE=rules bash scripts/dev.sh`. No owner database, environment, browser profile or provider account is required. Do not enable provider credentials. All browser fixtures are fictional; external browser requests are blocked. No message was transmitted.

## Manual changed-send reporting

Build isolation: while the owned fixture dev server uses ports3001/8017, never run production builds in its frontend directory. This checkpoint built a tracked-only `git archive HEAD frontend` in the pilot control directory with an installed-node_modules symlink and `npm run build -- --webpack`; its `.next` and generated type files are separate. Do not copy owner `.env` files. Next dev regenerates tracked `next-env.d.ts` imports to `.next/dev/types`; leave that live generated drift uncommitted rather than resetting or shipping it. Reviewers use their separately allocated worktree, fresh DB, free ports and isolated Chrome context, never the engineer fixture or owner preview.

Save → approve the exact message. Copy is NOT send. After sending externally, choose Record sent externally for unchanged text or Sent with changes, enter the complete actual subject/body, then Record changed message. Not yet cancels the report without asserting a send. The actual text and original approved text are separately persisted; Conversations shows actual text with expandable original approval. This does not verify delivery or compliance, and never triggers a transport call. The recipient remains the approved recipient; changed-recipient reporting is not supported in this seam. Existing old message records lack new snapshot provenance; do not backfill invented evidence.

API `/sent` additionally accepts `sent_as: with_changes`, `actual_subject`, `actual_body`; omission preserves existing approved-text behavior. Approval/revision/suppression checks still apply. Original booking link is approval context, not evidence it appeared in changed actual text. Include actual links in the reported body.

## Off switch / rollback

There is no background action. Do not select the changed-send action to leave it unused; stop the private local server to disable the entire local ledger. Hosted and public-preview guards remain unchanged. Roll back the snapshot code commit with a normal revert, never reset or overwrite the database. New nullable fields are backward compatible with older JSON parsing only if the older strict model is updated to accept them; therefore export/backup the isolated database before a code rollback and retain it for forward restore. Do NOT run old strict code against newly written records without a tested compatibility migration. No production migration or rollback was exercised.

## Remaining evidence

Physical phone keyboard, assistive technology, complete fourteen-step screenshots, legal approval boundary, day-two queue and complete founder journey are not accepted by this S1 slice. No new dependencies/env secrets/services were introduced.
