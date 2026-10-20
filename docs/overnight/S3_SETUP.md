# S3 isolated setup, off-switch, and rollback

## Scope

This document is for the narrow recipient publication-basis/region-safety checkpoint only. It describes local review evidence, not production release, legal clearance, consent verification, or real outreach permission.

The S3 contract is additive `contact_basis` v1 on an outreach thread. The saved object contains `published_email`, credential-free public `source_url`, explicit timezone-aware `captured_at`, `publisher_attribution`, `notice_status`, `recipient_role`, `message_relevance`, explicit `recipient_country`, optional IANA `recipient_timezone`, `basis_type`, and `version`. Missing or incomplete evidence may be saved for repair but fails approval. Only a matching email, recipient-attributable publication, explicitly clear notice review, non-empty role/relevance, and explicit US or CA country admit. Unknown/other regions deny. No date, country, role, consent, permission, or legal clearance is inferred.

The checkpoint also clears stale in-memory frontend basis overlays when a refreshed thread recipient no longer matches the overlay's `published_email`. This is a UI race guard; the backend remains the final fail-closed authority.

## Safe local review recipe

Prerequisites:

- Work only in `/Users/hiren/microsaas-projects/signalfoundry-rc` on the authorized working branch.
- Preserve owner Chrome 9222 and existing owner fixture/app ports 3000, 8047, 3001, and 8017.
- Use unused ports 3063 (Next) and 8063 (FastAPI), a fresh SQLite file, fictional fixture values, and installed dependencies only.
- Do not copy `.env`, credentials, owner databases, provider configuration, or real contact data. Providers remain OFF; browser requests outside the intended local frontend are blocked.

Build a disposable source tree for the exact committed source under review:

```sh
cd /Users/hiren/microsaas-projects/signalfoundry-rc
rm -rf /Users/hiren/.hermes/cto-pilot/signalfoundry-rc/s3-integration-source
mkdir -p /Users/hiren/.hermes/cto-pilot/signalfoundry-rc/s3-integration-source
git archive HEAD | tar -x -C /Users/hiren/.hermes/cto-pilot/signalfoundry-rc/s3-integration-source
cp -R frontend/node_modules /Users/hiren/.hermes/cto-pilot/signalfoundry-rc/s3-integration-source/frontend/node_modules
```

Start only the owned isolated processes:

```sh
env -i PATH=/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin HOME=/Users/hiren \
  PYTHONPATH=/Users/hiren/microsaas-projects/signalfoundry-rc/backend \
  SIGNALFOUNDRY_DB_PATH=/Users/hiren/.hermes/cto-pilot/signalfoundry-rc/s3-integration/s3-integration.sqlite3 \
  S3_DB_PATH=/Users/hiren/.hermes/cto-pilot/signalfoundry-rc/s3-integration/s3-integration.sqlite3 \
  S3_FRONTEND_ORIGIN=http://127.0.0.1:3063 S3_BACKEND_PORT=8063 \
  /Users/hiren/microsaas-projects/signalfoundry-rc/.venv/bin/python \
  /Users/hiren/.hermes/cto-pilot/signalfoundry-rc/s3_integration_serve.py

env -i PATH=/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin HOME=/Users/hiren \
  /usr/bin/python3 /Users/hiren/.hermes/cto-pilot/signalfoundry-rc/launch_s3_next.py
```

After both health checks respond on loopback, run the fresh fixture and browser matrix:

```sh
cd /Users/hiren/microsaas-projects/signalfoundry-rc/backend
S3_FRONTEND_PORT=3063 S3_BACKEND_PORT=8063 \
  /Users/hiren/.hermes/cto-pilot/signalfoundry-rc/s3_run_browser.sh
```

The runner rebuilds the fresh fictional SQLite fixture for each width and writes one JSON result to each `browser-{width}.log`, plus screenshots for the gate states. It must report actual `flowViewport` values for 1440, 390, and 320; do not summarize a screenshot loop using a stale final viewport. The result must show providers `OFF`, `externalRequests` `BLOCKED`, `realNextFastAPISQLite` `true`, and `verdict` `PASS`.

Automated verification:

```sh
cd /Users/hiren/microsaas-projects/signalfoundry-rc/backend
../.venv/bin/python -m unittest discover -s tests -v

cd /Users/hiren/microsaas-projects/signalfoundry-rc/frontend
npm test
npm run test:landing
npm run typecheck
npm run lint
```

## Off-switch

There is no admission bypass, region opt-in, provider enablement, or send switch in S3. To stop a review, close only the owned Next/FastAPI process handles created for ports 3063/8063 and leave owner processes untouched. Pausing a thread is an application safety action, not a way to approve an incomplete basis. Never send mail, call a provider, open a real account, or use `mailto:` during this review.

## Rollback

Roll forward is preferred. If the S3 change must be reverted, create a normal revert commit on the working branch, rerun the backend/frontend suites and the isolated browser matrix, and read back the exact remote/PR head. Do not force-push, rebase, merge main, or delete evidence/history. The SQLite data may contain additive `contact_basis` objects; never downgrade by deleting evidence or rewriting approved/sent snapshots. Older binaries may reject additive JSON fields, so compatibility must be tested before any rollback is used. A rollback does not establish legal or production readiness.

## Limits

This recipe proves only the local S3 slice. It does not prove real Clerk/auth/org isolation, hosted/Convex parity, provider permissions, consent, CASL or other current-law compliance, deliverability, physical mobile keyboards, screen readers, 200% zoom, or the remaining journey/funnel/cost/hosted/offline/privacy/operations scope.
