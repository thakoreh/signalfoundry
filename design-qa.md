# Shader theme QA — October 22, 2026

Current scope: the owner-requested OGL Flowmap poster, Paper GrainGradient and consistent pearl/lilac/ink theme. Source checks pass; optimized build and fresh browser verification are pending. Earlier component QA is archived in docs/continuation/COMPONENT_POLISH_DESIGN_QA.md and proves only the earlier component slice.

Chrome was unavailable for four attempts. The owner chose to reconnect rather than authorize another automation method. Reconnect now works; official Paper reference is open. No alternate browser automation was used.

## Iteration 1 finding

[P2] Workflow illustration caption has dark text on a dark translucent surface. Evidence:17-desktop-workflow.png at1440x1000. The theme conversion carried a light-surface alpha into ink. Fix: .sf-tour-caption background uses --surface-tint with --ink text. Current state stays blocked until a fresh same-state capture confirms the repair.

Final result: blocked.
