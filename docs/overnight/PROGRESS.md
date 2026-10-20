# Clientrove release-candidate progress

## Resume here

Read GOAL.md, this file, then the matching detailed requirement docs. Continue all unblocked priorities; no provider spending, external messages, publication, live billing or Ads are authorized by this run.

## Baseline

- Base main: cfd22af0e693a4854e3e2c46e034ccf5a39127f3 (merged PR 5).
- Integration branch: codex/clientrove-release-candidate; original owner checkout remains main.
- Integration worktree: task/worktrees/release-candidate. Original preview at task/signalfoundry is left running on its existing ports and database.
- Original dirty file preserved: frontend/next-env.d.ts (Next dev generated type paths). No original saved records or source edits discarded.
- Prior main PR evidence: required source/container checks passed on its reviewed head; 32 browser passes and 3 existing project-specific skips. This is baseline evidence, not validation of future changes.
- Current owner-confirmed rule: PR + source/container checks, 0 approving reviews, no last-pusher approval; other protections remain. Old brief wording is stale and will be reconciled.
- Primary runtimes: bundled Node 24; Python virtualenv in original checkout may be used as an interpreter with isolated-worktree cwd. Each frontend worktree installs its own dependencies; no junction to owner node_modules.

## Checklist

| ID | Priority | Requirement | Status / evidence |
|---|---|---|---|
| RUN-01 | P0 | New branch, isolated worktrees, draft PR, checkpoint/progress discipline | Branch + root worktree created; draft PR next |
| DOC-01 | P0 | Refined goal, requirements reconciliation, actual solo rules | GOAL.md captured; matching docs next |
| LEGAL-01 | P0 | Official US/Canada consent/identity/opt-out evidence and safe product gates | Pending research |
| LOOP-01 | P0 | Next up returning home + next actions + unknown-safe low-friction reporting | Pending |
| LOOP-02 | P0 | Open email app / safe Copy fallback / actual sent-with-changes snapshot | Pending |
| LOOP-03 | P0 | Sender identity/address footer + source/role basis + scope gates | Pending |
| LOOP-04 | P0 | All manual reply types / referral / dated snooze / OOO / bounce | Pending |
| LOOP-05 | P0 | Up to 2 approved manual follow-ups / business days / company hold | Pending |
| LOOP-06 | P0 | Meeting time / confirmation draft / post-time reported outcome | Pending |
| LOOP-07 | P0 | Named/shared ordering, provenance, reliable timezone only | Pending |
| UX-01 | P0 | Unified tokens/contrast, compact seller context, unsaved state, evidence review | Pending |
| COST-01 | P0 | Local + global/tenant durable monetary reservations/reconciliation/kill switch | Pending |
| HOST-01 | P0 | Convex outreach parity + tenant/auth/race checks, gated until proven | Pending after local loop |
| AI-01 | P0 | Guarded conversation reply copilot after spending and review | Gated on COST-01 |
| MAIL-01 | P0 | Offline transport/OAuth/outbox/inbound/deliverability seams | Live operation blocked on chosen authorized mailbox/provider |
| QUAL-01 | P0/P1 | Explicit buyer/contact benchmark and output truth | Pending |
| OPS-01 | P0/P1 | Auth/billing test boundaries, privacy/export/deletion, analytics, ops/restore/rollback | Pending inspection |
| QA-01 | P0 | Isolated full-feature regression, final exact-commit checks | Pending changes |
| REVIEW-01 | P0 | Fresh security/cost + busy-founder mobile/next-day UX review | Pending integration |
| REPORT-01 | P0 | Evidence matrix, owner decisions, spend unknowns, truthful verdict | Pending |

## Decisions and constraints

- Latest user prioritizes local day-to-day manual-assisted loop before hosted parity. No owner profile is a product fixture.
- Existing DeepSeek usage counts toward US$25; unknown incurred spend must not be treated as zero. Automated tests use offline providers.
- No new dependency required yet. Existing source/tests are preserved; fix production issues or test targeting errors without weakening behavior gates.
- No live sending, mail client launch, provider connection, or changes to owner preview during implementation/QA.

## Milestones and commands

### Initial isolation

- git fetch origin: passed; latest main is cfd22af.
- git status/worktree inventory: original main plus preserved generated next-env diff; no other checkout initially.
- Managed worktree API unavailable for wrapper task directory (not a Git root); used native git worktree add without moving/deleting data.
- git worktree add task/worktrees/release-candidate codex/clientrove-release-candidate: passed; integration worktree clean.
- Read existing product/design/technical/local-outreach/email-option briefs and source seams. Added refined behavior/compliance/discipline contract above.

## Next step

Commit the baseline checklist, open the draft PR, create owned agent worktrees, dispatch local backend/UI and official compliance research. Root implements cost admission in non-overlapping files while coordinating the local API contract.
