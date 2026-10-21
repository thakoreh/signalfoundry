# Restore recheck and HTTP fixture isolation — 58bd82b

Exact immutable checkpoint: `58bd82bcd808ad50166225ed4d7397ac60d629f1`, clean detached `worktrees/policy-review`. No product edits/push, owner data/env, browser, provider or real sending. Fictional DBs and explicitly owned short-lived fault subprocesses only; the separate HTTP identity probe creates **no actual socket/process/network**.

## Restore repair: PASS

- Current local-data suite: **9 PASS**, exit0 (`local_data_focused_58bd82b.log`).
- Independent local-data controls: **9 PASS**, exit0 (`local_data_independent_58bd82b.py/.json/.log`).
- Original crash immediately after real backup returns: requested final file absent; no active workspace or cost admission available.
- Crash immediately before atomic publication: final absent.
- Crash immediately after real hard-link publication: final exists but is durably quarantined and rejects new monetary reservation.
- Competing destination created after initial validation: publication raises, preserves its exact sentinel bytes, and does not unlink/overwrite it.
- Earlier closure/tenant/stale-writer/financial/suppression/WAL/export/failure controls continue to pass.

The source stages privately, commits and closes the quarantine, then publishes with atomic non-overwriting `os.link`. The reported ce37b6c P1 is closed within this scope. Abrupt exits can leave a private staging directory; this is not a disk-wipe/privacy-retention guarantee or an activation path at the requested final destination.

## New P1: HTTP smoke can mutate a foreign service after child startup fails

Location: `scripts/test_local_journey_http.py:42–75`. It releases a probed free port before starting uvicorn, then accepts any successful `/health` response before checking whether its child is still alive. A service that acquires that port can therefore be mistaken for the owned fixture.

Independent pure spy reproduction (`http_fixture_identity_58bd82b.py/.json/.log`): socket is fake, Popen returns a failed child with `poll()==1`, opener supplies a foreign health200 and empty workspace. Actual requested sequence:

```text
GET /health
GET /workspace
PUT /workspace/profile
```

The fake opener stopped that PUT; no actual service was contacted or modified. This proves the test can reach its first mutation without establishing fixture ownership. Because this script is newly in `check.sh`, an accidental collision must fail safely instead of risking the owner's preview/data.

Fix direction agreed with root: retain the actual bound/listening socket and pass it into the child using supported process socket transfer; do not release/rebind the port. Add Windows exclusive bind where appropriate. Clear/whitelist child environment before importing the app and attest an unpredictable per-fixture response identity. Keep cleanup limited to the exact owned child. Existing provider-disabled env, fresh SQLite, proxy-disabled HTTP and zero-paid-attempt assertion are good but do not establish port ownership by themselves.

Root is implementing a separate fixture ownership repair. Overall new-checkpoint signoff remains pending that P1; the application restore repair itself passes. No owner service, live HTTP smoke, Chrome/Next/OS email-client, hosted auth/deletion, real provider/price/history or production verification was performed by this reviewer.
