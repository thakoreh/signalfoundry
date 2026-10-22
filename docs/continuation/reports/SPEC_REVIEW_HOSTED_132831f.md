# Hosted prerequisite repair recheck: 132831f

Reviewed 2026-10-21 at clean detached `worktrees/legal-review`, exact `132831f751f0fc5d2c7793d62b0923c387a31eb6`. Source/offline contract review only. No product edits/commits, browser/personal profile, provider/network, deployment, owner configuration/data, accounts or real sends. Probe/config/cache files are outside source under `work/review-probes`. The original `SPEC_REVIEW_HOSTED_4bf4621.md` is unchanged.

## Scoped verdict

The two independently reported P2 defects are fixed for their original reproductions. The added website-analysis identity boundary also passes independent fixtures: worker data cannot supply, clear or replace founder-saved sender identity. No further concrete P0/P1/P2 was established in this narrow repair recheck. This is not hosted parity, remote acceptance or completion of the owner goal.

## Measured cases

| Case | Result |
|---|---|
| Malformed preferred address followed by valid direct and shared alternates | Original independent probe now chooses `valid.person@example.com`, preserving published/unverified status. |
| Every saved candidate invalid (`bad@@example.com`, `info@localhost`) | Recipient remains empty/missing; no approval/manual readiness. |
| Numeric-only timezone `-05:00` supplied separately | Original independent IANA-contract probe now rejects it. |
| Named `UTC`, `Etc/GMT+5`, both valid Toronto November fold offsets | All parse to their corresponding exact instants. Existing gap/mismatch/original-calendar checks continue passing. |
| Worker omits all sender fields | Saved founder name, address and contact remain unchanged; old approval is invalidated. |
| Worker sends empty sender fields | Saved founder identity remains unchanged. |
| Worker invents sender name/address/contact | Worker identity is discarded; founder identity remains unchanged. |
| Founder explicitly cleared mailing address before analysis; worker supplies a complete identity | Cleared address stays empty; footer/readiness cannot be established from worker text. |
| No saved profile identity; worker supplies complete sender identity | Returned business profile has no sender fields and the ledger footer remains empty. |
| Founder edits contact and clears address after analysis begins | Stale `finishAnalyze` rejects; the newer contact and explicit address clear remain intact. |
| Old authenticated profile save omits sender fields after a partial explicit clear | Omitted fields preserve current founder state, including the deliberate blank; no approval is restored. |

## Source reasoning

`outreachLedger.start` validates every contact before ranking valid candidates. It no longer turns a single invalid first candidate into a missing-contact result when a valid alternate exists.

`outreachLedgerPolicy.timezone` now restricts the zone syntax to named identifiers before Intl validation. It retains named UTC/IANA aliases and the separate original-wall-time/offset check; no timezone or consent is inferred.

`workspaces.finishAnalyze` removes all three worker sender fields, then copies only current saved founder values before profile validation. Its existing lease/profile-version guard precedes the update. `saveProfile` still treats omission as preserve and explicit blank as clear; the analysis path does not weaken that distinction. Analysis can update business facts but cannot become an identity authority.

## Commands and results

- Exact original external config rerun on this immutable repair: **41/41 passed**, including the two previously failing independent assertions.
- Extended independent harness `hosted-spec-probe-132831f.test.ts`: **49/49 passed** in 1.04s. This contains the old 36 fixture cases plus independent review cases; it is not the author's entire 119-test Convex suite. Config/generator: `vitest-hosted-spec-132831f.config.mjs`, `prepare_hosted_spec_probe_132831f.py`. Existing continuation dependencies only, edge-runtime, immutable legal-review source and external cache; no installs or dependency links.
- Command shape: `node <existing continuation node_modules>/vitest/vitest.mjs run --config <external vitest-hosted-spec-132831f.config.mjs>`.
- `node --experimental-strip-types --test tests/api-adapter.test.ts`: **14/14 passed**, including omitted/cleared sender arguments and authenticated hosted outreach **503**, with no local/Convex outreach fallback.
- Worktree hash/status checked; tracked source remains clean. Full author suite/type/lint results were supplied by root, not independently rerun wholesale in this pass.

## Gates still intact

Internal persistence remains feature-gated, with no hosted outreach UI/REST activation. Hosted lifecycle scheduling, meetings/outcomes, Next up/funnel, hosted privacy operations and broader parity remain unbuilt/gated as documented. Mocked identity and transaction fixtures do not prove real JWT propagation, remote Convex OCC, schema deployment or browser usability. No Chrome/mobile/provider/live acceptance is inferred, and no owner flag/configuration was changed.
