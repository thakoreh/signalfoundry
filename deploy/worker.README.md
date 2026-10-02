# Stateless research worker

The production SaaS uses Clerk identity, Convex tenant data/jobs/usage, and Stripe
billing. This Python worker neither knows user identities nor stores SaaS data.
`app.main:app`, SQLite, the root Dockerfile, and `compose.preview.yml` remain
isolated demo/preview artifacts; none is a production authentication boundary.
The new image explicitly excludes both `app.main` and `app.store`.

## Contract

Server calls use `Authorization: Bearer <operator-provided worker token>`.

- `POST /worker/analyze` takes `{ "website": "https://public-business.com" }`
  and returns `{ "profile": <Profile>, "website": <final public URL> }`
- `POST /worker/research` takes `{ "profile": <Profile>, "campaign_id": <id>,
  "mode": "manual" | "demo", "domains": <up to ten URLs> }` and returns
  `{ "accounts": <Account[]>, "errors": <string[]> }`. Profile and Account
  schemas are in `backend/app/models.py`. Demo requires empty domains and always
  returns explicitly fictional rule-based results. Manual requires at least one
  domain. Convex validates, tenant-scopes, merges and stores the returned data
- `/healthz` reports only process liveness. `/readyz` returns 503 until worker
  token and origin exist. Readiness makes no upstream call and does not assert
  external reachability, DNS, TLS, quota, or provider readiness
- Errors: 401 invalid auth, 403 browser Origin, 413 body limit, 415 content type,
  422 validation, 426 wrong transport, 429 capacity (Retry-After: 5), 503 unavailable
- Every response has generated `X-Request-ID`. Logs contain only that ID,
  operation category, status, and duration. They exclude profiles, domains, URL
  queries, credentials, raw exception messages, and request/response bodies

## Deployment policy

Build from repo root with `docker build -f deploy/worker.Dockerfile .` or use
`docker compose -f deploy/worker.compose.yml config` after authorized settings.
Run only `app.worker:app`. The image has no database or persistent volume, runs
as UID/GID 10001, uses a read-only filesystem in Compose, drops capabilities,
and exposes no published host port. Pin the Python base image by approved digest
in a release pipeline after verifying the actual registry image; the source
currently uses the maintained `python:3.12-slim` tag, not an invented digest.

Managed Convex is on another host: configure an HTTPS worker origin with a valid
certificate, authenticated requests, host firewall, and a TLS reverse proxy.
Only the gateway may reach port 8001. Set the exact proxy IP or narrow CIDR in
`SIGNALFOUNDRY_TRUSTED_PROXY_IPS` (`FORWARDED_ALLOW_IPS` inside the container).
Never use wildcard trust or expose an HTTP worker to the internet. Preserve
Host and set X-Forwarded-Proto from the actual connection, strip any inbound
forwarded headers, and do not log Authorization or request bodies. Configure
proxy request body 64 KiB, header/body timeouts 10 seconds, upstream timeout
115 seconds, and rate limits appropriate to expected load. The application also
enforces body and concurrency limits but is not a network DDoS boundary.

Set the identical server-only `SIGNALFOUNDRY_WORKER_TOKEN` in authorized Convex
server settings and worker runtime, plus `SIGNALFOUNDRY_WORKER_URL` in each.
No browser configuration may contain this token. No credential is generated,
stored, or configured by the setup files. Populate the blank example only via an
approved secret-management flow. Rotation needs coordinated Convex and worker
updates; restart the worker because environment settings are captured at startup.
Do not grant the worker Stripe, Clerk, Convex admin, database, or user tokens.

HTTP is accepted only when `SIGNALFOUNDRY_WORKER_ALLOW_PRIVATE_HTTP=true` and the
origin is exactly `http://research-worker:8001`, `http://worker:8001`,
`http://localhost:8001`, or `http://127.0.0.1:8001`. This is a deliberately explicit
same-host private-container/local test escape hatch. It cannot be used from
managed/cloud Convex and must never cross hosts or a public network. Production
Compose disables this flag. The application verifies scheme and Host; proxy
trust is a deployment responsibility that must be verified before release.

## Work limits and retry semantics

Two requests per process, four domain lanes per research request; excess work
gets 429 without queueing. At most ten domains, eight DNS resolvers with zero
queued submissions, 8-second absolute page budgets, 512,000-byte HTML responses,
24,000-character parsed text, three validated redirects, DNS/IP checks and IP
pinning. Private/mixed DNS, metadata endpoints, credentials, nonstandard ports,
IP literals and compressed responses are rejected. Exact Azure WireServer
`168.63.129.16` and Oracle Cloud Machine `192.0.0.192` endpoints are explicitly
blocked even if a Python version classifies one as public. AWS/GCP link-local
and IPv6 metadata, and Alibaba shared-space metadata, are also regression-tested.
The deployment still requires worker-scoped egress firewall rules denying private,
link-local, platform-control and metadata destinations; application DNS/IP checks
do not replace that gate. Do not block Azure host-agent traffic globally: scope
the worker's egress controls so required platform services keep working. DNS tasks stuck inside OS
resolution consume bounded slots rather than create an unbounded queue.

Rules are default even if an unrelated provider key exists. Explicit
`DECISION_ENGINE=jev` opt-in alone enables the Jev adapter and its per-domain
8-second call budget. The worker never retries a website or paid provider call.
Ten domains across four lanes budget at most 48 seconds of network work plus
bounded parsing. A 105-second request admission deadline stops remaining domains
from starting when fewer than 16 seconds remain. Convex owns leases, idempotency,
retry policy, account identity, and atomic persistence. Requests can be safely
repeated in rules/demo mode, but explicit Jev retries can incur additional charges.
Local worker admission limits are per process; keep one Uvicorn worker and account
for replica limits at the gateway. This is not a distributed queue or quota system.

## Verification

Run offline checks from the repository root:

```sh
PYTHONPATH=backend python -m unittest discover -s backend/tests -v
python scripts/production_preflight.py
python scripts/production_worker_checks.py
# After building signalfoundry-worker:ci with Docker:
python scripts/production_container_smoke.py
```

The production checks include a local loopback Uvicorn subprocess, authenticated
round trip, fail-closed configuration, no-demo-route exposure, fixture-secret
regressions, and static container boundaries. They create runtime-only random
mock tokens; no real credential or paid network call is used. Docker build/runtime
verification must be run separately when Docker is available. A passing static
check is not a deployment, registry, TLS, health-through-proxy, or live-provider
verification. Historical secret alerts require exact occurrence investigation and
provider rotation if real; source cleanup cannot dismiss or remediate history.
