# Final focused frontend review — c929cba

## Verdict

**PASS, bounded to the requested returning-work / reply-date slice.** No blocking UI defect reproduced. This does not waive the remaining product scope or imply production readiness.

Reviewed exact commit: `c929cbaf0019909ff21bce3633f25842cf67c281` (`fix(local): wire next up and enforce reply safety`).

## Actual browser checks

Fresh fictional SQLite fixture, providers off, installed Chrome channel `155.0.8059.85`, same local Next/FastAPI app, no external requests:

- **1440px:** PASS
- **390px:** PASS
- **320px:** PASS
- Returning `/workspace` fetched `GET /api/outreach/next-up` and rendered one seeded interested reply.
- The primary action linked to the exact existing thread:
  `/workspace/outreach/search_900fed9db0de4d2f9f985577e8439b14?thread=outreach_9b2eda0bf5ac42aeaa892344eb6a8ca6`
- Opening the item, reload, and browser Back all preserved the existing search/thread identity.
- POST count across load/open/reload/back: **0**.
- Page errors: **0**.
- DOM overflow: none at all three widths (`scrollWidth == viewport width`).
- Queue and thread screenshots were captured under this directory, including `returning-next-up-{1440,390,320}.png` and the opened-thread evidence `returning-failure-390.png`.

The initial empty-queue observation was caused by a draft-only fixture. After seeding an actual inbound `interested` reply, the queue appeared; this was not treated as a product failure.

## Reply/date behavior

Real c929 repository sequence on a separate fresh SQLite fixture:

1. Seeded inbound `interested` → Next up returned `answer_reply`.
2. Completed contact basis, drafted the human answer with the saved footer, approved it, and recorded outbound → Next up became empty.
3. Added a newer inbound `question` → Next up returned `answer_reply` again.
4. Submitted `not_now` with only a timezone and pasted body → state became `awaiting_review`, `revisit_at` stayed null, and the pasted body remained intact; Next up exposed `review_reply` rather than scheduled work.
5. `PYTHONPATH=backend python -m unittest -q tests.test_outreach` → **31 tests OK**, including DST gap/offset/date controls.
6. `npm run test:landing -- landing-tests/next-up-queue.test.tsx` → **2 tests passed**.

## Files created/modified

Created review artifacts only:

- `evidence/frontend/focused_returning_flow.mjs`
- `evidence/frontend/findings.json`
- `final-frontend-review/FINAL_FRONTEND_REVIEW_c929cba.md`
- Fresh review SQLite fixtures and screenshots under `final-frontend-review/`

No product source files were changed. The owned review checkout remains detached at c929; Next development regenerated the pre-existing `frontend/next-env.d.ts` drift.

## Remaining gaps

This focused pass does not cover or accept the remaining requirements: real hosted auth/tenant parity, provider/offline prerequisites, mailbox/calendar integration, global monetary reserve/settle/history guard, privacy/export/delete, backup/restore, operations/alerts, full funnel/next-batch projections, bounded follow-up scheduling, timed meeting confirmation, physical-device and screen-reader verification, or the full remaining 14-step acceptance matrix. PR 7 remains draft and the product is not production-ready.
