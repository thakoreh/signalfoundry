# Baseline gate review — immutable `09a986f`

## Verdict

**Bounded baseline PASS for the two formerly failing fixes on immutable `09a986f3afa045fc85c83c77c491316fd5ca1fd7`.** The recipient-evidence safety gate and mobile Find customers CTA gate passed independent, fresh local browser retest.

**The final new-head review remains OPEN.** This report does not accept engineering's subsequent local-journey work, the full 14-step journey, current-head CI, or final release-candidate readiness.

## Reviewed source and isolation

- Review worktree: `<LOCAL_HOME>/microsaas-projects/signalfoundry-rc-review`
- Exact HEAD: `09a986f3afa045fc85c83c77c491316fd5ca1fd7` (`fix outreach recipient evidence and mobile CTA`)
- Worktree state: only pre-existing generated `frontend/next-env.d.ts` drift was preserved; no product source/test changes were made.
- Reviewer artifacts: `<HISTORICAL_LOCAL_ARTIFACT_ROOT>/deadline-review/`
- Fresh fictional SQLite fixture: `deadline-review/review.sqlite3`
- Reviewer-only ports: FastAPI `18073`, Next `13073`; both were free after cleanup.
- Owner ports/CDP were not used: `3000`, `8047`, `9222`.
- Providers were off, external browser requests were blocked, and no credentials, external messages, signup, billing, or provider calls were used.

## Actual checks

### Recipient evidence / safety — PASS

Fresh real-browser runs at `1440x900`, `390x900`, and `320x900` verified:

- Incomplete contact-basis save returned **HTTP 200** while preserving blank `captured_at` and `recipient_timezone`.
- Completing the basis and saving returned **HTTP 200**.
- A same-recipient profile refresh retained the unsaved basis fields.
- After changing `hello@business.com` to `new-recipient@business.com` without saving:
  - stale old source-anchor count was **0**;
  - old source/time/role/relevance values were immediately blank;
  - status became `edited recipient · verification not established`;
  - the explicit unsaved-recipient warning was visible;
  - approval, Copy, Record sent externally, and Sent with changes were disabled;
  - the private message draft and pasted inbound text remained intact.
- Seven unsafe source URL forms remained non-clickable. No external request was observed and no page errors occurred.

Evidence: `browser-1440.log`, `browser-390.log`, `browser-320.log`, and `recipient-edit-{1440,390,320}.png`.

### Mobile Find customers CTA — PASS

Fresh initial-viewport DOM measurements at `scrollY=0`:

| Viewport | Button bottom | Requirement | Other checks |
|---|---:|---:|---|
| 390×844 | 821.921875 | `<= 844` | 44px high; no overflow |
| 320×844 | 838.921875 | `<= 844` | 44px high; no overflow |
| 390×900 | 821.921875 | `<= 900` | 44px high; no overflow |
| 320×900 | 838.921875 | `<= 900` | 44px high; no overflow |

All four runs had `optionalRequiredControls=0`, `panelOverflow=false`, and the CTA preceded the optional section. Vision review of the 390×844 and 320×844 captures confirmed the complete button is visibly present in the initial viewport and optional fields are below it.

Evidence: `jux003-measurements.json`, `jux003.log`, and `jux003-{390x844,320x844,390x900,320x900}-viewport.png`.

## Focused automated regression

- `npm run test:landing -- landing-tests/outreach-workspace.test.tsx` — **42 tests passed**.
- `git diff --check` — **pass**.
- The reviewer probe itself completed with exit code **0**; its temporary FastAPI/Next processes were stopped and ports `18073`/`13073` were free afterward.

## Known open items

- The pinned baseline's recorded GitHub Actions run `39533220406` still has `source-checks` failing `pip-audit` for `certifi 2026.7.22` / `PYSEC-2026-4320`; this review did not waive or alter that blocker. `container-checks` and GitGuardian were recorded passing.
- No claim is made here about the engineer's new head, the remaining local return journey, current CI, full journey acceptance, provider-enabled behavior, tenant/auth/cost/privacy requirements, legal freshness, physical-device behavior, screen-reader certification, or 200% zoom.
- No direct Kanban/task-comment write was performed; the concrete incremental findings are in `deadline-review/findings.jsonl` for the existing engineering checkpoint.

## Reproduction command

```sh
REVIEW_SOURCE=<LOCAL_HOME>/microsaas-projects/signalfoundry-rc-review \
  BACKEND_PORT=18073 FRONTEND_PORT=13073 \
  <HISTORICAL_LOCAL_ARTIFACT_ROOT>/deadline-review/run_probe.sh
```

## Boundary

This is a **bounded baseline pass only**. The final review must be rerun on the frozen new head after engineering finishes the local journey and CI state is read back. Do not treat this report as approval, merge authorization, production readiness, or a full RC acceptance.
