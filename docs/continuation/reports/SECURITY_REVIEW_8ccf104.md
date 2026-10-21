# Final local boundary review — scoped PASS

Exact immutable checkpoint: `8ccf104be6f329dec5f142a968feeed90ea9ece4`, clean detached `worktrees/policy-review`. Reviewer made no product edits, commits or pushes. All fixture files/probes/reports are outside product source in `work/review-probes`. No owner database/env files, owner ports/services, browser, provider calls, sending, accounts or paid dispatch were used. API requests used the in-process FastAPI TestClient; launcher socket/process operations were mocks, with no application listener or server subprocess started.

## Independently executed evidence

- `boundary_independent_8ccf104.py/.json/.log`: **8 tests PASS, 0 failures**, exit 0 (including six nontrue-value subcases, two compatible local configurations and two preview configurations).
- `boundary_focused_8ccf104.py/.log`: **2 original API regression tests PASS**, exit 0: local off switches preserve saved records, and local-only export remains an attachment with no-store behavior.
- Source worktree remained clean after execution. The primary agent's whole-suite/build/CI figures were not independently rerun or adopted as this review's execution evidence.

Controls and actual results:

1. **Off switches:** `false`, `TRUE`, empty, `1`, leading-space true and trailing-space true all deny outreach list/next-up/insights/detail, start/approve and export. Valid mutation schemas were supplied to exercise authorization. Saved searches remain readable internally, workspace stays open, and local workspace GET remains available.
2. **Compatibility:** unset flags and exact `true` preserve existing local list/export behavior.
3. **Preview boundary:** public-access and configured-preview-origin instances both return 403 for outreach/export even with both local flags explicitly `true`.
4. **Existing-file refusal:** a deliberately non-SQLite sentinel file is rejected before constructing `Repository`; bytes remain unchanged. Mock construction would fail the test if reached.
5. **Creation race and fictional seed:** a competing file introduced at the exclusive-touch boundary is preserved byte-for-byte; `Repository` is not constructed. A separate fresh seed creates five clearly FICTIONAL companies with reserved `.example.org` emails, all contacts unverified and labeled manufactured. Five outreach threads are created and no paid attempts are recorded. HTTP transports and subprocess creation are denied during this execution.
6. **Port checks:** mock second-bind failure closes both owned probe sockets; duplicate ports are rejected before socket construction. Windows exclusive-address socket option precedes the first bind.
7. **Launcher admission:** occupied-port refusal reaches no `Popen`, after dependency checks and before process creation.
8. **Owned cleanup:** Windows stop uses only the active passed process's exact PID tree and waits for that object. An already-exited process causes no taskkill, kill or wait.

Initial probe runs exposed reviewer harness mistakes: revision 0 was correctly rejected with 422 before service authorization; the Account display field is `name`; and a direct reviewer SQLite connection needed explicit close before Windows fixture cleanup. These were corrected in the outside-tree probe. The initial diagnostic log is preserved as `boundary_independent_8ccf104_initial-harness.log`; these were not product defects. Final passing logs are the named evidence above.

## Source assessment

- `backend/app/main.py:157` rejects local export for any non-exact-true value and unconditionally for preview/public modes. `main.py:382–383` creates the outreach router with the analogous deny condition. The router's shared service gate precedes repository method execution. Outreach enablement is captured at app creation, consistent with `docs/continuation/LOCAL_SETUP.md` requiring a restart; it is not represented here as a dynamic process-wide kill switch.
- `scripts/seed_local_review.py:25–28` checks existing files/symlinks, then exclusively creates a new file before constructing the repository. It does not import `app.main`, invoke website analysis or instantiate provider transports. Manufactured source/contact/outcome data is explicitly labeled; it is review content, not customer, permission or demand evidence. The CLI requires both an explicit destination and `--fictional-only`.
- `scripts/dev.py:50–73` rejects duplicate/occupied requested ports before either child is launched. `dev.py:28–43` operates only on passed active Popen objects. It does not find/terminate an arbitrary process by occupied port.
- Original launcher tests are retained; new seeder checks are included in `scripts/check.sh`. Documentation describes a local manual-assisted candidate, monetary/live/hosted gaps and prohibited owner-preview interference, rather than production certification.

**No P0/P1 finding remains within these additions.** No product correction is requested from this focused review.

## Limits retained

The launcher free-port probe releases its sockets before real service startup; this is an early occupied-port refusal, not lifetime exclusive port ownership. The HTTP journey harness has the separate retained-listener/nonce protections reviewed at `3befd3d`; this review does not replace that distinction. Actual Windows taskkill/process-tree behavior, real launcher startup, OS socket races and rendered browser/mobile behavior were not exercised here.

Seeder exclusivity protects an existing final file; a later seed failure can leave its new isolated partial fixture. Windows file mode 0600 is not asserted to establish a private ACL; callers must choose the documented private review directory. Same-user filesystem tampering and a disconnected copy are not elevated into multi-user security guarantees.

Restore, source/approval and monetary modules were not changed in this boundary delta; earlier reports keep their exact scope and limitations. There is no new claim of hosted parity, cross-database global cost enforcement, accepted historical provider usage/pricing, physical device/browser acceptance, connected mailbox/calendar operation, disk wiping, production deployment or full-product readiness.
