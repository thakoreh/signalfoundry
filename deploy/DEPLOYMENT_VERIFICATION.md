# Protected preview verification

Prepared 2026-10-01. This record describes local checks, not a live deployment.

## Passed

- 47 backend unit/security tests, including exact preview-origin validation and configured persistent data path
- 13 frontend unit tests, including exact preview host, forwarded-header, and HTTPS-origin cases
- Frontend TypeScript check, ESLint, and production build on Next.js 16.3.8
- Three fail-closed deployment configuration tests: missing/weak auth, gateway structure, and container/persistence boundaries
- Packaging privacy test, including credentials, SQLite files/sidecars, and deployment secrets exclusions
- Two local launcher tests and shell syntax checks
- Production frontend/API smoke: eight end-to-end workflow checks, including fictional research, shortlist, draft, CSV, rejected unsafe inputs, and preserved data
- Built standalone frontend with a runtime HTTPS preview origin: page rendering, fictional demo/research/export, plus six rejected hostile-header cases
- Real Next rewrite regression: loopback host acceptance, foreign/spoofed host rejection, and a 31.26-second upstream response surviving the proxy timeout
- Source-embedded Dockerfile round trip: all 34 allowlisted source files match the local bytes; no repository COPY context, runtime database, password file, or private key is included

The full check command's initial long-running session was interrupted after the build. The production stack, preview stack, and slow proxy integration checks were then run separately to completion. No source changes followed those passing app checks; the remaining work was packaging and this record.

## Not run / still required

- Docker image build and runtime: Docker is not available in this preparation environment
- Actual NGINX syntax/startup/authentication flow: NGINX is not installed here
- Server capacity measurement, actual Coolify resource limits, mount permissions, TLS, live authenticated browser flow, or persistence across a deployed restart
- Public URL verification: no authenticated Coolify/SSH session was supplied, and no live deployment was attempted
- Independent security review did not complete before the task's execution was interrupted

## Resume gate

Use existing authorized secure Coolify/SSH access. Before exposing the new application, complete the owner-approved preview password setup, create the dedicated data/auth mounts, build the image, and perform the live checks in COOLIFY.md. Do not report a preview link until those checks pass. Existing applications and server security settings were not changed.
