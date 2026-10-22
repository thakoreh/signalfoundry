# Focused mobile illustration repair addendum

**Original P2 closed in this focused review.** Exact clean detached source: `fd4e030a6590b8b471afcacd151e60a20edff9d7`. Reviewed only the two-file diff `e8e4942..fd4e030` and supplied root-authored production capture `landing-feedback-v2-fixed-320.jpg`, opened at original detail with view_image. No new actionable finding in this repair.

The 320px capture clearly shows the complete “Your next step” heading and “Right where you left it.” subtitle. Answer a reply sits above, Update a meeting below-left and Review a message below-right; none obscures the center words. The visible explanation and availability text remain intact.

The change is scoped to the ≤560px media rule: approve token moves from top137 to top258, meeting token from bottom32 to bottom84. It keeps the same artwork, labels, control behavior and motion policy; desktop rules and product/auth/intake code are untouched. New positions provide separation from the center text with the existing small vertical drift. The supplied capture proves the static rendered state, not an independently sampled complete animation cycle.

The added mobile browser assertion measures actual token rectangles against both center-text rectangles under reduced motion. It checks nonintersection rather than mirroring the new CSS constants or asserting a screenshot. It supplements existing mobile readability/overflow checks; none was removed or weakened. I inspected this test but did not drive or execute a browser.

Root separately reports actual production320 rectangle coverage=false and scrollWidth=clientWidth=305, plus exact-commit webpack build/type and focused lint/format passes. Those are root's executions; direct evidence here is the supplied capture, source diff and clean/hash check. No baseline suite was unnecessarily repeated. No product edits, build, browser/port control, owner data/env, providers, accounts, paid calls, send or deployment action.

This closes only the decorative overlap recorded in `UX_LANDING_REVIEW_e8e4942.md`; it does not constitute broader release, whole-journey, cross-browser or WCAG acceptance.
