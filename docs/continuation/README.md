# SignalFoundry / ClientRove continuation handoff

**Verdict: INCOMPLETE. Continue the existing app; do not rebuild or describe it as finished.** This bundle makes the project handoff independent of the previous AI's private memory, local chat history, gateway, and task board.

Current continuation overlay: local referrals, bounded followups, timed meetings, activity/next-batch, monetary admission, returning workspace/mailto and logical local data controls have since been implemented/tested. The remaining work is not the original c929-only backlog. Start with the current matrix in STATUS.md and latest PROGRESS.md. Consolidated setup/off switches are LOCAL_SETUP.md, monetary setup is MONETARY_SAFEGUARDS.md, and closure/restore limits are LOCAL_DATA_OPERATIONS.md. New complete Chrome journey verification remains pending; no production acceptance is implied.

## Start here

1. [NEXT_AGENT_PROMPT.md](NEXT_AGENT_PROMPT.md): copy/paste instructions for the next coding agent.
2. [OWNER_CONTRACT.md](OWNER_CONTRACT.md): complete original product outcome,14-step journey and authority boundaries. Transport identifiers are removed. The branch already exists; resume it rather than following the historical create-branch step literally.
3. [STATUS.md](STATUS.md): delivered versus unbuilt, actual test scope, missed historical deadline and unresolved company-policy review.
4. [LOCAL_DECISIONS.md](LOCAL_DECISIONS.md): concrete minimal contracts for pending referral/followup/date/meeting/funnel work. These are decisions, not a claim that every feature was implemented.
5. [DATE_REVIEW_ADJUDICATION.md](DATE_REVIEW_ADJUDICATION.md): accept both valid explicit fall-back offsets; reject nonexistent/wrong-offset wall times.
6. [LOCAL_LOOP_CONTRACT.md](LOCAL_LOOP_CONTRACT.md): older detailed research/proposal. Its open questions and old deadlines may have been resolved/superseded; do not override the owner contract, minimal decisions, date adjudication or current source.
7. [LEADPOET_REVIEW.md](LEADPOET_REVIEW.md): historical primary-page inspection; vendor claims are not independently proven results. Recheck changing docs/prices before making decisions.

## Repository continuity

- Repository: thakoreh/signalfoundry.
- Continue `codex/clientrove-release-candidate`, existing draft PR7. PR5 and its branch are finished history.
- Original portable handoff application checkpoint: `c929cbaf0019909ff21bce3633f25842cf67c281`. Current continuation code is in later commits on the SAME branch; inspect Git/PR HEAD and STATUS.md. Do not reset to this historical SHA.
- Verified origin/main at handoff preparation: `cfd22af0e693a4854e3e2c46e034ccf5a39127f3`. Fetch again; preserve dirty work and merge newer origin/main normally if needed, never rebase/force pushed history.
- c929cba required CI run39540683162 passed source-checks/container-checks/GitGuardian. A later documentation head needs its own CI; never claim that an old head's checks belong to the latest one.
- No merge, approval, deploy, real send, purchase or provider connection was performed. Existing authorized work is preserved in Git, not just this bundle.

## Original requirement documents already in the repository

Read `docs/OVERNIGHT_AGENT_PROMPT.md`, `docs/OVERNIGHT_PRODUCT_REQUIREMENTS.md`, `docs/OVERNIGHT_DESIGN_REQUIREMENTS.md`, `docs/OVERNIGHT_TECHNICAL_REQUIREMENTS.md`, `docs/LOCAL_OUTREACH.md`, `docs/OUTREACH_EMAIL_OPTIONS.md` (these are the actual checkout paths for the original contract's shorthand filenames), `docs/overnight/PROGRESS.md`, `docs/overnight/CHECKLIST.md`, and existing S1/S2/S3 setup/review guides. Source and current owner instructions win over obsolete approval/merge assumptions. Read applicable AGENTS.md files and Convex instructions before editing those areas.

README documents setup/run/check scripts. Use a disposable local environment and unused ports; do not bind a default launcher over the owner's live preview. Real provider credentials and production/customer data are intentionally not included.

## Evidence index and limits

- [Final frontend review](reports/FRONTEND_REVIEW_c929cba.md): real Next/FastAPI/fresh-SQLite returning flow at1440/390/320. Bounded PASS, not full14-step acceptance.
- [Final backend review](reports/BACKEND_REVIEW_c929cba.md): four control groups passed, one explicit-company-resume scenario was flagged. Read the main-session contract qualification in STATUS.md; neither blindly accept its P1 interpretation nor silently erase it.
- [Author handoff](reports/ENGINEERING_HANDOFF.md): executed commands and original remainder; historical future review wording has since been superseded by the final reports.
- [Earlier baseline recipient/mobile review](reports/BASELINE_REVIEW_09a986f.md), [early safety rework](reports/SAFETY_REVIEW_eef5ddf.md), [date review](reports/DATE_REVIEW_320edf3.md).
- Earlier accepted bounded [S1](reports/S1_REVIEW_5106da3.md), [S2A](reports/S2A_REVIEW_70aa549.md), [S2B](reports/S2B_REVIEW_7b2ea52.md), [S2 integration](reports/S2_INDEPENDENT_REVIEW_f1b3b325.md). Acceptance applies to the stated seam and SHA only; they are not approval to merge or whole-product acceptance.
- `evidence/screenshots/returning-next-up-viewport-{1440,390,320}.png`: original reviewer-captured current-head fictional returning queue, not all journey screenshots. No physical-phone/screen-reader proof.
- `evidence/backend/`: original adversarial source, raw reported finding and JSONL results. It intentionally contains a disputed failing assertion. This is archival review evidence, not a newly passing regression suite or CI entry point.
- `evidence/frontend/`: original probe and findings. The old local module/artifact paths are replaced with placeholders; it requires adaptation and fresh fixtures, not execution unchanged from a clone. The original fixture DB is deliberately excluded. Do not count a screenshot named open-thread as thread evidence: the historical probe captured that image after browser Back. Only correctly named queue viewport captures are included here.
- `MANIFEST.json`: byte sizes and SHA256 hashes of bundle files at packaging time (excluding the manifest itself).

Historical `<LOCAL_HOME>` / `<HISTORICAL_LOCAL_ARTIFACT_ROOT>` paths in reports are NOT available checkout paths. Full browser profiles, transcripts, generated builds, source archives, private runtime configuration, `.env` files and SQLite databases are intentionally excluded. Reconstruct disposable fixtures from current tests/source. Do not copy or mutate the owner's saved workspace to reproduce an issue.

## Remaining release work at this checkpoint

The current local implementation covers the referral/followup/meeting/funnel and monetary admission seams with scoped offline reviews. Outstanding are live history/pricing/authority, fresh full Chrome/mobile/accessibility acceptance, hosted auth/outreach/privacy parity, reply-AI/mailbox/outbox/calendar and real billing/provider prerequisites, production operations/recovery/retention and whole-product acceptance. Do not label unbuilt code as merely an account-input gate. Detailed built/tested/blocked/deferred mapping is STATUS.md.

The previous one-hour target expired on2026-10-21; it is not a new countdown. Do not mark complete at a clock boundary. Continue useful safe code/tests, prove the actual journey, and report unfinished or genuinely gated work honestly.
