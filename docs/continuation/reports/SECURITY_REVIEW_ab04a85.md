# Focused approval/source security review — ab04a85

**Verdict: REWORK for two actionable P1 findings below. No P0 observed in scope.**

Exact immutable checkpoint: `ab04a85e697eafe5873ef7163a9630ff252aaa5a`, clean detached `worktrees/policy-review`. Reviewer made no product changes or push. No owner data/env, Chrome/browser, email-app action, clipboard side effect outside mocks, provider call, real sending or external service was used. Copied immutable frontend sources/tests live only in `work/review-probes/security-ab04a85-frontend`; its dependency junction points to existing continuation node_modules, not continuation product source. Backend DB/module fixtures explicitly use outside-tree fictional temporary data. Cost module unchanged from its earlier focused ca43048 PASS and was not re-audited here.

## Actual checks

- Existing copied OutreachWorkspace/SavedOutreach component tests: **51 PASS**; two added independent stale-inbound controls **FAIL**, total51PASS/2FAIL (`security_frontend_ab04a85.log`).
- Existing manual-email/contact-order/claim-review pure Node tests: **11 PASS**; four added private-link controls **FAIL**, total11PASS/4FAIL (`security_helpers_ab04a85.log`).
- Existing backend outreach/local-journey/sender-profile/customer-draft focused suites: **61 PASS**, exit0 (`security_backend_focused_ab04a85.log`).
- Independent fresh-DB backend controls: **3 PASS, 1 FAIL**, exit1 (`security_backend_ab04a85.py/.json/.log`). Existing test helpers supply fictional setup, while the new assertions/scenarios are independent. Only the existing Starlette/httpx deprecation warning appeared.

## P1 — pasted inbound does not invalidate pending or new manual handoff

Locations: `frontend/components/outreach-workspace.tsx:158–166` (`canAct`), `:741–753` (incoming textarea), Copy/mailto dispatch at `:410–421`.

Reproduction (both copied component tests fail):

1. Save/approve a fixture introduction and open Conversations.
2. Start Copy or Open in email app with readiness GET deliberately pending.
3. Paste “Please unsubscribe me. Do not contact this company.” into the received-reply field.
4. Resolve the old approved/ready GET snapshot.

Actual: clipboard mock receives the old approved message, or email-app mock receives its mailto. No persisted reply or send occurred. Unlike message/basis/timing edits, incoming text neither calls `cancelCopy()` nor contributes to `canAct`/Approve disablement. A fresh handoff also remains available while the visible inbound is unsaved. This violates the stop/review-before-outreach intent and permits the newly added mailto action to open a message despite known local inbound work.

Fix direction: synchronously cancel pending handoff on every incoming edit (including edit/revert); gate approval/manual-ready actions while an unsaved nonempty inbound requires logging/review. Preserve the pasted body and explain the next safe step. Do not auto-save/classify, spend, silently discard it or send anything. Add delayed Copy and delayed email-app regressions plus an already-pasted inbound readiness control. Any true historic-send reporting need is separate from authorizing new outreach.

## P1 — new source-review path promotes private URLs to actionable evidence links

Locations: `backend/app/outreach.py:657–658` source_facts projection; `frontend/lib/customer-search.ts:100–107` `publicSourceUrl`; new consumers `frontend/components/draft-claim-review.tsx:15` and `customer-search-results.tsx:378`.

Actual independent results:

- `publicSourceUrl` returns actionable URLs for `http://127.0.0.1/admin`, `http://localhost/settings`, `http://10.0.0.1/` and `http://[::1]/`. It validates only HTTP(S) and credentials, unlike the stricter public-URL policy used for editable contact basis.
- An otherwise qualified saved fictional account with one valid public fact plus one non-demo private-URL company fact is accepted for outreach. The private fact is copied into `source_facts` (`fact_count=3`, retained unsafe URL `http://127.0.0.1/admin`). New claim review then uses the permissive link helper.

This demonstrates source-policy/unsafe-link exposure, **not automated SSRF or a proven unprivileged arbitrary-DB-write exploit**. No link was clicked or fetched. Existing saved/legacy records are not a reason to trust their URLs when adding a new source-review view.

Fix direction: one strict public source-link normalizer for contact/claim/result links, rejecting private/loopback/reserved literals, local/private names, credentials and non-HTTP(S) schemes. The backend projection should select only safely public nonempty company/fit facts, while preserving underlying original evidence for audit/CSV rather than rewriting it. Handle legacy unsafe facts as non-actionable/omitted context. Add helper and rendered-link controls, plus a mixed-valid/unsafe backend source_facts regression.

## Passing security/tenant behavior

- Copy/mailto preflight compares thread/search ID, thread revision, exact approval hash/time/revision, sender footer, full draft bytes, readiness/pause/suppression. Existing pending-edit, navigation, session/unmount, failure and duplicate-click controls pass. Oversized mailto safely falls back to exact Copy; URI component encoding and header-injection controls pass. These are mocks, not OS email-client verification.
- Changed-send editor binds to approval hash and approval revision. Independent backend stale-revision report is denied after a new edit/approval; identical report replay creates no duplicate, and changed actual text under the same key is rejected. Approved and actual externally reported snapshots remain separate and immutable.
- Profile offering-description edit invalidates pending approval and advances its revision. Independent same-DB tenant control confirms only the changed tenant is affected and an immutable actual-sent snapshot survives. This does not test live Clerk roles/hosted auth.
- Recipient edit clears inherited recipient name, verification and contact basis; it requires new review. Contact ordering places an individual business address before shared inboxes while preserving unverified status. Literal claim matches are explicitly labeled a review aid, not factual/permission verification.
- Saved work reads and mailto/Copy do not create send events or provider requests; the user must explicitly report an external send. No new hosted outreach capability is asserted.

## Scope/limits

No browser journey, Chrome/OS mailto integration, physical phone/keyboard, screen reader, live provider/auth, remote CI or whole-product/production acceptance was performed. No new verdict is supplied for unrelated followup/referral/meeting scope or the unchanged cost ledger. Root remains sole product writer. Recheck both findings on a new immutable checkpoint before calling this slice reviewed.
