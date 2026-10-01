# SignalFoundry frontend

Next.js 16 App Router UI with two intentionally separate deployment modes. The rich research workspace is shared, but authentication, storage, and routing are not.

## Run an independent local demo

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Start the Python local-demo API on `127.0.0.1:8000`, or use the root development launcher. Both `SIGNALFOUNDRY_MODE` and `NEXT_PUBLIC_SIGNALFOUNDRY_MODE` must be `local-demo`. The frontend binds to loopback. No Clerk, Convex, Stripe, or provider credentials are needed for fictional demo research. This mode has no multi-user authentication and must not be used as the SaaS deployment.

The local-demo API uses an explicit `beforeFiles` rewrite. Its strict local/approved-preview Host checks remain in place. The legacy preview option does not enable SaaS authentication.

## Authenticated SaaS

Set both modes to `saas`, configure the variables documented in `.env.example`, and rebuild. The build-time browser mode, runtime public mode, and server mode must match; invalid or absent settings render an inert configuration screen and make APIs fail closed. A local-mode build cannot be converted into SaaS by changing runtime variables alone.

Required frontend configuration:

- `APP_URL`: exact trusted application origin, HTTPS in deployment; HTTP localhost is accepted for development
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: your Clerk public key
- `CLERK_SECRET_KEY`: server-side Clerk secret
- `CONVEX_URL`: exact HTTPS `*.convex.cloud` deployment URL
- `CLERK_JWT_TEMPLATE`: optional, defaults to `convex`

Enable Clerk Organizations and configure `org:admin` and `org:member`. Activate the Clerk Convex integration and make its server-issued token include `sub`, expiry, and the active organization's ID and role (legacy `org_id`/`org_role` or compact `o.id`/`o.rol`). Configure the corresponding verified issuer and application audience in Convex. See the root production setup guide for database, worker, and Stripe configuration.

Sign-in, sign-up, and account recovery use Clerk's prebuilt flows. Signed-in users must select an active organization. Administrators initialize the organization's workspace, edit its profile, load its fictional demo profile, and manage billing. Members may research campaigns and review accounts. Backend functions enforce these permissions independently of UI controls.

Organization, user, and role changes remount the workspace and abort its prior request scope. Data from the previous organization is discarded. Account and campaign request scopes separately reject late results after navigation. The browser sends its expected organization in an intent-only header. The server compares that header with its verified session and rejects an organization-switch race; it never authorizes from the header.

## Same-origin API boundary

`app/api/[...path]/route.ts` authenticates each SaaS call through Clerk, obtains its server-side Convex template token, checks token identity/organization binding against that verified session, and creates a new authenticated `ConvexHttpClient` per call. Convex independently verifies JWT signature, issuer, audience, and tenant permissions. The claim-binding check is not a replacement for JWT verification.

`lib/server/adapter.ts` exposes a closed list of REST mappings. There is no browser-selectable function dispatcher, token forwarding from request bodies, local data fallback, arbitrary upstream URL, or browser-selected Stripe price. It requires same-origin writes and organization-intent binding, rejects unknown fields, limits JSON bodies to 32 KiB (including streamed bodies), applies input bounds, strips unrecognized errors, and returns private/no-store responses. Account exports neutralize spreadsheet formulas.

Research starts a durable job via `POST /api/campaigns/:id/research` with `{idempotencyKey}`. The UI discovers existing jobs with `GET /api/campaigns/:id/job`, polls with retry/backoff on transient failures, reloads accounts on completion, and supports `POST /api/jobs/:id/cancel`. An interrupted browser does not cancel server work. Cancellation is allowed only for the starter or an organization administrator, as enforced by Convex. No client timer marks unfinished research successful.

Billing uses `GET /api/billing` and `POST /api/billing/checkout` or `/portal` with `{requestId}`. Intentional clicks use a UUID retained across retries. The server chooses all prices and return locations. Missing configuration is displayed explicitly; this UI does not invent a plan price or activate access from a success query parameter. A verified Stripe webhook controls entitlement. Stripe-hosted checkout/portal redirect URLs are checked before navigation.

Clerk's strict nonce-based CSP is applied in middleware, with dynamic server rendering and a dynamic Clerk provider. Convex is accessed server-side, so no browser-wide Convex connection wildcard is required. Standard anti-framing, no-sniff, referrer, permissions, and HTTPS HSTS headers are included. Clerk requires inline style permission for its components; production does not add unsafe-eval.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run format:check
npm run test:convex
SIGNALFOUNDRY_MODE=local-demo NEXT_PUBLIC_SIGNALFOUNDRY_MODE=local-demo npm run build
```

Frontend tests cover the explicit mode/Host boundary, REST mappings, auth/org/role/template-token denial, no tenant or price injection, body/origin constraints, sanitized errors, token-session binding, CSV formula handling, existing account filtering, and stale detail selection. Convex tests cover data authorization and job/billing state. Tests with stub dependencies are not evidence of a configured live provider.

## Release validation still requires provisioned services

Before release, test real Clerk sign-up, sign-in, sign-out, password recovery/MFA, invitation acceptance, session expiry, and organization switching; verify both member/admin permissions and zero cross-organization data exposure. Test durable worker restart/retry/cancel, allowed/blocked public sites, Stripe test-mode checkout/portal/webhook replay, delayed billing status, and CSP with the configured Clerk domain. Confirm desktop/mobile navigation, repeated clicks, back/forward, modal dismissal/focus, copying drafts, and CSV download. Live authentication, payment, webhook, and deployment verification require the owner's configured accounts and credentials.

References: [Clerk App Router auth](https://clerk.com/docs/reference/nextjs/app-router/auth), [Clerk Organizations](https://clerk.com/docs/nextjs/guides/organizations/getting-started), [Clerk CSP](https://clerk.com/docs/guides/secure/best-practices/csp-headers), [Convex + Clerk](https://docs.convex.dev/auth/clerk), [Convex HTTP client](https://docs.convex.dev/api/classes/browser.ConvexHttpClient.html). Next.js routing/proxy/CSP conventions were checked against the installed Next.js 16.3.8 documentation before implementation.
