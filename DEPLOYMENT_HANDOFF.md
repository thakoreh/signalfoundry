# Deployment handoff

Deploy a new, isolated SignalFoundry preview using the root Dockerfile. Read [deploy/COOLIFY.md](deploy/COOLIFY.md) fully before acting.

## Owner must supply separately
- Authorized access to the selected Coolify server; no keys or tokens are included here
- A verified HTTPS hostname
- Securely configured bcrypt htpasswd file; there is no default password

## Settings
- Build: Dockerfile, repository root context, `/Dockerfile`
- Expose container port 8080 only; keep Next.js 3000 and FastAPI 8000 private
- Set `SIGNALFOUNDRY_PREVIEW_ORIGIN` to the exact HTTPS origin
- Dedicated persistent volume at `/app/data`, writable by UID/GID 10001
- Read-only authentication file at `/run/secrets/preview.htpasswd`
- Start with 1 CPU and 768 MiB memory; verify headroom before building
- Keep decision engine `rules`; no paid API keys are necessary

## Before returning a link
Build and test the actual image, verify valid HTTPS and unauthenticated 401 responses, authenticate securely, exercise fictional demo campaign/shortlist/draft/export, and confirm persistence after restarting only this app. Verify existing applications are unchanged.

## Verified versus pending
Source tests, frontend build and proxy tests passed during preparation. Docker/NGINX image execution, live Jev calls and hosted browser UI checks have not been verified. This is a single shared workspace, not a production multi-tenant SaaS. Discovery/contact verification integrations and billing are not configured. Do not expose it without its preview gateway protection.

No license has been selected. Do not delete existing applications, prune shared storage, change firewall/SSH credentials, or expose private infrastructure information. The owner must explicitly approve changes beyond this preview deployment.
