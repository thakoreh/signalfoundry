# Discovery-first verification

This is an offline implementation/review record, not production certification.
Base: main `496834f1df134a70a065d6b1de9c22dd531056b5`.

## Combined approval-led mission checkpoint, 2026-10-03

Independent review of the combined working tree passed 140 backend tests, 126
Convex tests, 62 frontend Node tests, TypeScript, ESLint and whitespace validation.
The 34 landing/motion unit tests and production build also passed locally. The
browser runner enumerates 152 cases across five viewports, including new audience,
company-only, evidence/unknown, feedback/Undo, suppression recovery and reduced-
motion checks. Enumeration is not execution: local Chromium fails before launch
with `socket EPERM`, so exact-head CI and visual artifact inspection remain open.

Review fixes include server-side contact selection/provenance on every output path,
pre-dispatch bounded tenant exclusions, response/save-time race checks, preserved
historical rows, suppressed-domain draft blocking, first-campaign snapshot drafting,
strict Undo scope preservation and conservative buyer/industry language rules.
All these tests use synthetic fixtures or offline provider transports; they do not
prove production provider access, licensing, actual billing or live auth behavior.

## Capability-separation checkpoint, 2026-10-03

Focused offline checks for the company-only default and optional contacts:

- 28 backend discovery tests passed (`test_discovery.py`), including Exa-only
  readiness/execution, explicit contact selection, independent PDL licensing and
  budget gates, strict boolean inputs, legacy defaults, and local draft persistence
- 48 Convex discovery tests passed (`convex-tests/discovery.test.ts`), including
  company-only successful completion with PDL absent or configured, no implicit
  contact/verification calls, legacy missing fields, selected-contact approval
  failures, PDL runtime revocation/budget/failure preservation, and spend-versus-read
  access separation. Seven additional boundary regressions cover injected people
  in company-search responses, defensive finalization, false/missing legacy
  campaign opt-in across read/export/status/draft paths, missing or revoked PDL
  provenance, and honest manual role-only placeholders. Five further cases cover
  tenant-scoped exclusion forwarding, ignored company exclusions before PDL,
  suppression during readiness and during PDL response, bounded overflow, and
  cancellation during readiness. Existing tenant, idempotency, cancellation, conservative
  settlement, pacing, expiry and retention tests remain covered
- TypeScript and ESLint passed against the shared release working tree during this
  checkpoint. Other release edits were still in progress; these focused results do
  not certify the later combined release, build, browser walkthrough or exact-head CI

Company-only campaigns now default `enrich_contacts=false`. Selected contacts are
separately gated, and verification remains unconfigured. All provider tests use
mock responses; no paid calls, keys, provider agreements or deployments were used.

## Historical discovery-first checkpoint (before capability separation)

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
