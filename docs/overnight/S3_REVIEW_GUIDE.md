# S3 reviewer guide

## Review boundary

Review only the existing recipient publication-basis and region-safety slice. Do not treat this handoff as self-approval, legal advice, consent verification, production release, or whole-journey acceptance. The source-of-truth scope is `/Users/hiren/.hermes/cto-pilot/signalfoundry-rc/WAVE3_SCOPE.md`; the immutable run report is `/Users/hiren/.hermes/cto-pilot/signalfoundry-rc/S3_STANDARD_HANDOFF.md`.

The code checkpoint under review is the commit named in the handoff. The only source change after the existing S3 implementation is the frontend recipient-refresh race guard in `frontend/components/outreach-workspace.tsx`, with its regression in `frontend/landing-tests/outreach-workspace.test.tsx`. The backend contract and historical approved/sent behavior are intentionally unchanged.

## Review questions

1. Does a refreshed thread with a changed recipient clear any old local basis overlay, while a same-recipient refresh preserves legitimate unsaved evidence?
2. Does the backend remain the final authority for missing/incomplete evidence, mismatched published email, unsafe source URL, missing timezone, future observation time, prohibited/unknown notice, third-party/unknown publisher, and unknown/other region?
3. Do basis edits cancel pending Copy and disable approval/manual action until an explicit save, without losing message or inbound edits?
4. Does saving a basis invalidate approval and bind new content hashes to the exact current recipient, basis, message, and sender footer?
5. Do recipient changes clear basis, opt-outs remain sticky, payload-bound idempotency replays return current suppression/recipient state, and sent/approved snapshots remain immutable?
6. Are all claims limited to fictional local evidence, with no claim of consent, independent verification, legal clearance, provider permission, or real delivery?

## Required commands

From the repository:

```sh
cd backend && ../.venv/bin/python -m unittest discover -s tests -v
cd ../frontend && npm test && npm run test:landing && npm run typecheck && npm run lint
```

For the real slice, follow `S3_SETUP.md`. The browser runner must use a fresh source archive and SQLite fixture on ports 3063/8063, installed Chrome, providers OFF, and external browser requests blocked. Read all three JSON logs and verify each has the intended `flowViewport`, `verdict: PASS`, and the safety fields in the handoff. The screenshots are evidence of the implemented slice only; they are not physical-device or accessibility certification.

## Exact-head and CI readback

After the worker push, read back:

```sh
git rev-parse HEAD origin/codex/clientrove-release-candidate origin/main
gh pr view 7 --json number,state,isDraft,headRefName,baseRefName,headRefOid,url
gh pr checks 7
```

The final head must be the exact source reviewed by CI, remain a draft, be based on current `origin/main`, and have no force-push, merge, approval, auto-merge, settings, secret, deploy, or release action. Independent review is a separate gate; do not mark this work accepted from the author's own tests.

## Known non-claims

No current-law freshness acceptance, real authentication/provider execution, hosted/Convex parity, real send, inbox/calendar/account connection, physical mobile keyboard, screen reader, 200% zoom, or remaining S1–S14 journey completion is included. Missing features must remain listed for later work rather than being represented as CSS or fixture completion.
