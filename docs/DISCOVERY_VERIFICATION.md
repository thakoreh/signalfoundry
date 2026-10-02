# Discovery-first verification

This is an offline implementation/review record, not production certification.
Base: main `496834f1df134a70a065d6b1de9c22dd531056b5`.

## Passed locally

- 115 backend tests (91 existing plus 24 adapter, gate, contract, provenance,
  SSRF, strict worker-boundary and local compatibility cases)
- Complete `scripts/check.sh` integration checkpoint: backend/source/packaging/
  deployment/launcher checks, TypeScript, ESLint, frontend Node tests, Convex tests,
  34 landing tests, production build, real Next API proxy/full-stack workflow,
  and protected-preview hostile-header checks
- Final focused checks passed: TypeScript, ESLint, 46 frontend Node cases,
  88 Convex cases (24 discovery cases), and 34 landing/motion cases
- Independent audit added duplicate/late-stage settlement, global monthly budget,
  PDL cross-tenant rate pacing, expiry/revocation and partial-result regressions
- Five offering-brief Node cases and eleven discovery browser scenarios added;
  Playwright lists 55 discovery cases across five viewports (117 total including
  inherited landing/motion cases)

The PR’s exact-head CI is the source of truth for the final commit. Do not use
an earlier local checkpoint or earlier commit's green run to certify later edits.

## Requested one-campaign walkthrough

The CI `campaign-walkthrough` job runs the explicitly labelled TEST DATA case on
1440px desktop and 390px mobile. It renders the actual production app with mocked
REST responses; every company/contact/source is fictional. It exercises offering
input → generated/edited brief → explicit review → Find customers → results →
evidence and contact provenance → shortlist → grounded draft → CSV download,
then captures the provider-unavailable state. Ten ordered PNGs, CSV bytes, and
expected/completed assertion manifests are uploaded under
`campaign-walkthrough-evidence`. The broader suite saves
`application-browser-evidence`. These are UI proofs, not live provider results.

## Explicit non-claims

No live providers, keys, agreements, purchases, messages or deployments were used.
Official Convex schema push, real Clerk/Stripe acceptance, live provider billing,
commercial rights and independent email verification remain untested/gated.
The local browser sandbox denied Chromium/loopback navigation in the preceding
work; screenshots must come from exact-head CI artifacts and be visually inspected.
Docker and dependency/security scans are defined in CI; an unrun stage is not a pass.
