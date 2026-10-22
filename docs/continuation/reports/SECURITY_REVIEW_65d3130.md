# Packaging privacy review — scoped source/mock PASS

Immutable checkpoint: `65d31301488c8ea1d531e6532a8301f555354a54`, clean detached `worktrees/policy-review`. Application source is unchanged from the prior `8ccf104` scoped boundary PASS. This review addresses `.dockerignore`, `.gitignore`, `scripts/test_container_context_privacy.py`, and its call from `scripts/production_container_smoke.py` only.

No product edits/push, actual Docker daemon/client process, owner ports/data/env files, browser, provider or paid action was used. The independent probe and all manufactured temporary files are outside product source under `work/review-probes`.

## Evidence

`container_privacy_independent_65d3130.py/.json/.log`: **6 tests PASS, 0 failures**, exit 0. Every Docker command is mocked; real subprocess creation and socket connection are denied. Checks inspect the actual temporary context on disk at the fake build boundary.

1. Successful path uses a fresh temporary context outside the repository, containing exactly the copied `.dockerignore`, a two-line `FROM scratch`/`COPY` Dockerfile and 20 manufactured nonsecret files. The build/create calls use network none. No `run`, `start`, `exec` or `pull` command occurs. Export and cleanup use only the returned fictional container ID and the generated image tag; the temporary context is removed.
2. A simulated exported private file causes assertion failure and cleanup of the owned container/image.
3. A simulated missing allowed public file causes assertion failure and cleanup.
4. Build failure fails the check without attempting create or deleting an unconfirmed image/container.
5. Create failure fails the check and removes only the built image.
6. Export failure fails the check and removes the created container and built image. Raw simulated Docker error text is not included in the raised safe error.

## Source findings

**No P0/P1 identified in this packaging delta.**

- Added recursive `.local`, `private`, `exports`, `backups` and lowercase CSV exclusions cover root/nested manufactured sensitive artifacts; CSV is also Git-ignored. Existing environment, SQLite/WAL, key, dependency and compiled-output exclusions remain intact. `.env.example` remains explicitly permitted.
- The new test reads only the repository ignore file, never copies the actual repository/data as context, and does not interpolate owner secrets or shell commands. `subprocess.run` uses an argument list and fixed timeout.
- The test contains 16 negative and four positive archive-membership assertions. Actual Docker semantics are exercised by the intended build/export execution rather than a custom glob imitation. The mock review confirms the assertions reject a leak/drop but does not purport to prove Docker's implementation of ignore rules.
- `FROM scratch` requires no external base image. The Dockerfile has no `RUN`, and the created container is never started. Archive data is inspected in memory, not extracted to the host; exported size is checked before tar parsing. Resource names use a random 128-bit suffix and cleanup names only the captured container ID and generated image tag, without prune/global removal.
- The test is invoked before the existing production worker smoke. Missing Docker or command failure fails the run; there is no successful skip. No real Docker execution or CI result was inferred from these mocks.

## Remaining limits

Actual Docker context exclusion/positive-file retention is **not independently executed here** and remains pending real CI evidence. The archive cap is checked after command output capture, not a streaming memory cap; the context itself is tiny and entirely manufactured. A daemon timeout, interruption after creation or cleanup failure can leave uniquely named fixture resources; cleanup is not guaranteed after every daemon failure, and if container removal raises, later image removal is not attempted. This is a nonblocking fixture-resource limitation, not authorization to run broad cleanup.

Python's normal assertion-enabled execution is assumed by the current CI invocation; no `-O`/`PYTHONOPTIMIZE` invocation was found in the checked workflow. This test is evidence for the named paths and lowercase extensions, not every possible arbitrary sensitive filename or case variant. Existing worker runtime smoke behavior and unrelated packaging/source/app boundaries retain their earlier evidence and limitations.

The source worktree remained clean. No new claim is made for complete production readiness, deployed secrecy, live provider prices/history, hosted parity, connected mailbox/calendar behavior, rendered browser/device acceptance or CI acceptance at this head.
