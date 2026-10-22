# Focused workspace repair recheck

**Original findings closed in the reviewed scope; no new actionable issue.** Exact source: `d41f6f16a2026a4523050cf9608019ca3920f306`. I first confirmed my own legal-review checkout clean at618b101, then performed the explicitly authorized detached advance to d41f6f1. No root checkout or product code was edited. The original failed report, wire snapshots and probe file remain unchanged.

## Repair verdict

| Original finding | Independent result |
| --- | --- |
| P1 compact-summary/full-thread mismatch | **Closed.** Fresh actual in-process GET snapshots expose an explicit minimal19-field projection. Replies no longer reads absent messages; recorded meeting time/zone renders correctly. |
| P2 default awaiting_review overrides actual initial approval/send | **Closed.** Same original expectations now display Message approved and Awaiting reply for the corresponding real stages. Reply labels require actual inbound. |
| P2 missing/unrelated selected result opens default company | **Closed.** Both original missing-result cases remain on the page with an error. A subsequent valid retry retains the same idempotency key and navigates exactly to the selected thread's Review view. |
| Related Meetings link-label mismatch | **Closed.** With a queued reply but Meetings filter, link says View meeting and targets Meetings. |

## Privacy, safety and scope

The aggregate collection exposes flags `has_inbound`, `has_outbound`, `has_approval`, recipient status and meeting time/zone alongside existing summary identifiers/state. Exact allowlist checks on all four actual stage responses exclude messages, subject/body, approval snapshots, sender footer, contact basis, source excerpts and lifecycle history. This repair does not fetch every private conversation body for dashboard filtering.

The new frontend type matches the real wire projection. Missing any required activity flag fails into the read-error state without fabricated zero metrics. Existing hosted unavailability, late-response scope isolation, settings access and GET-only dashboard checks continue to pass. The explicit prepare operation remains a local ledger POST, not a send, approval, generation or mailbox connection. No backend readiness/suppression or exact-content approval policy was weakened by this diff. UI copy remains honest about email not being connected.

## Executed verification and distinct counts

1. **Original13 cases:13/13 PASS**, exit0. Reused the previous13 assertions exactly. Only its old mock transport fixture was adapted: removed full-thread messages/approval fields in favor of the three new summary booleans, changed the received fixture to has_inbound=true, and pointed the independent wire import to fresh actual d41f6f1 JSON. Assertions/expected labels, destinations, error behavior and scope limits were not weakened. Log `workspace-original-d41f6f1.log`.
2. **Extended19 cases:19/19 PASS**, exit0. Original13 plus six new: exact minimal/no-private-body projection; failed-selection retry key/exact routing; Meetings label/destination agreement; three missing-flag error cases. Log `workspace-extended-d41f6f1.log`. Distinct component cases are **19**, not13+19: **6 copied baseline +7 prior independent +6 new independent**.
3. `workspace-wire-d41f6f1.py` recreated the same fictional approved → reported-sent → actual-question → reported-meeting stages with temporary SQLite and FastAPI TestClient. **12/12 GETs returned200**, with exact19-field/boolean/private-field assertions at every stage. Output `workspace-wire-d41f6f1.json`; log `workspace-wire-d41f6f1.log`. No listening service or owner database was used. This is four staged fixtures/12 requests, not an additional19-test suite.

External generator: `make-workspace-d41f6f1-recheck.py`. Probe files: `workspace-original-d41f6f1.test.tsx`, `workspace-extended-d41f6f1.test.tsx`; matching `vitest-workspace-original/extended-d41f6f1.config.mjs`. Existing installed Node/Vitest/React dependencies were reused read-only. Both runs use `--no-cache` and config cache=false, with all product imports targeting legal-review source. Python used the existing continuation venv, `PYTHONPATH=legal-review/backend`, `PYTHONDONTWRITEBYTECODE=1`.

Original probe SHA256 is still `7CAA56F793FE62AC11B94920C01DE3A11F6C24DAE53D415A2C9EA1DBB22A7308`; the previous failed report was not revised into a pass. All new files/logs are outside product source in task `work/review-probes`.

Final `git rev-parse HEAD` / `git status --short`: exact d41f6f1 and clean. No build, browser, owner data/env/ports, provider/mailbox research, account, purchase, real send, engine implementation, push or remote action. No claim of fresh rendered mobile/full-journey, CI, hosted parity or production acceptance; root owns those checks.
