# SignalFoundry protected Coolify preview

This is one shared, single-operator workspace behind HTTPS and Basic authentication. It is not a production multi-user SaaS. Both Next and FastAPI remain private loopback processes. Only the authenticated gateway on container port 8080 is reachable by Coolify's proxy. Never publish ports 3000 or 8000, or remove the gateway/host/origin checks.

## Access and authorization gates

Use an existing authorized HTTPS Coolify session, or an authorized SSH tunnel for an HTTP-only dashboard. Do not send dashboard credentials over public HTTP. Do not create server keys, API credentials, accounts, firewall rules, or broad permissions to work around missing access. The preview password must be set by the owner through a secure flow, or its creation/configuration explicitly approved at action time. No passwords belong in chat, code, image layers, or build arguments.

The owner approved publishing this sanitized source at https://github.com/thakoreh/signalfoundry. Use that repository with the root Dockerfile. Alternatively, the generated source-embedded Dockerfile can be pasted into the authorized owner's Coolify “Dockerfile without Git” editor. This sends the source only to that Coolify server. Generate it with:

```bash
python3 scripts/package_coolify_inline.py
```

It writes `artifacts/signalfoundry-coolify-inline.Dockerfile`. The file includes source, not secrets or SQLite data. It must remain free of credentials and runtime data. It is self-contained because a normal Coolify Dockerfile-without-Git has no repository context for COPY instructions. The embedded-source path requires Docker BuildKit with Dockerfile heredoc support.

## New application settings

Create a separate SignalFoundry preview resource. Do not modify, stop, prune, or reuse the volume of another application.

- Build method: Dockerfile, root context `/`, Dockerfile `/Dockerfile`; or use the generated source-embedded Dockerfile without Git
- Public domain: one verified HTTPS hostname routed to this server, with a valid certificate and HTTP-to-HTTPS redirect
- Ports Exposes: `8080`; no host port mappings
- Runtime environment: `SIGNALFOUNDRY_PREVIEW_ORIGIN=https://<exact-hostname>` using lowercase DNS name, no trailing slash or port
- Decision engine: leave `rules`; no external API keys are required
- Persistent Storage: a new dedicated volume at `/app/data`, writable by UID/GID `10001:10001`; verify effective ownership before launch
- Protected authentication file: a read-only file mount at `/run/secrets/preview.htpasswd`, readable by UID 10001, containing exactly one bcrypt htpasswd account at cost 10–14
- Runtime CPU limit: `1`; hard memory limit: `768m`; soft reservation: `256m`; total memory+swap ceiling: `768m` where supported
- Optional container hardening: `--pids-limit=128 --security-opt=no-new-privileges:true --cap-drop=ALL`
- Restart policy: unless stopped; graceful stop: 30 seconds; bounded Docker logs: 10 MB × 3
- Keep the image-provided HEALTHCHECK: it checks both private servers and verifies the gateway rejects unauthenticated requests with 401; no public health-check bypass is needed
- One application instance only; do not enable horizontal replicas or simultaneous research workers for this SQLite preview

The reference `compose.preview.yml` mirrors the runtime constraints but does not attach a public proxy or publish host ports. Coolify application resource limits need to be entered separately when using the Dockerfile workflow. These are initial conservative ceilings, not measured production capacity; verify real usage under the demo workflow before increasing them. The frontend build uses a 768 MB V8 heap cap, but a build can consume additional native memory. Build one app at a time and check server headroom first.

For the password file, the owner can run `htpasswd -B -C 12 -c preview.htpasswd <chosen-username>` in a trusted local shell; it prompts privately. Store the password in the owner's password manager. Mount only the generated hash file, never the plaintext password. A managed Coolify File Mount is visible to resource administrators; use a protected host-file/secret mount when available. The app refuses to start with an absent, empty, plaintext, weak, or malformed password file. It ships with no default login.

## Live verification before sharing a link

1. Confirm the build succeeds and image HEALTHCHECK is healthy; inspect effective CPU/memory limits and the data/auth mounts
2. Confirm the public TLS certificate is valid, HTTP redirects to HTTPS, and `/`, `/api/workspace`, `/api/health`, and static assets require authentication
3. Confirm an incorrect password fails and an authenticated browser renders the page; enter credentials only through the approved secure browser flow
4. Verify foreign Host, Origin, Forwarded, and forwarded-host values return a rejection; HTTP to the gateway without trusted HTTPS forwarding returns 426
5. Use fictional demo data for smoke testing: load demo, create campaign, research, inspect an account, shortlist, generate a draft, and download CSV; no messages are sent
6. Restart only this new application; confirm its demo profile, campaign, and shortlist survive the dedicated SQLite volume
7. Confirm 3000/8000 are not mapped on the server, logs have no passwords, no other service was changed, and no memory/OOM restart loop occurs
8. Share only the verified HTTPS URL. Keep login delivery separate and secure

The existing SSRF restrictions remain in force: only public HTTP(S) hosts, DNS pinning, redirect revalidation, certificate verification, and bounded time/size. Do not widen those restrictions to make deployment work.

## Rollback and data protection

On first-launch failure, stop only the new preview resource and inspect its logs. Keep its dedicated data volume. On later release failure, roll back this application's image; never delete a volume or prune the server. Use SQLite's online backup API for a consistent copy when the app is running; copying only the live `.sqlite3` file while WAL is active can lose transactions. Backup destinations or schedules require the owner's approval.

## Verification status

Deployment preparation is not a live deployment. The source tests and actual checks performed are recorded in `DEPLOYMENT_VERIFICATION.md`. A final URL should be reported only after completing the live verification steps above.

## Official references

- [Coolify Dockerfile builds](https://coolify.io/docs/applications/builds/dockerfile)
- [Coolify persistent storage](https://coolify.io/docs/applications/configuration/persistent-storage)
- [Coolify file mounts](https://coolify.io/docs/core/persistent-storage/storage-mounts/file-mounts)
- [Coolify resource limits](https://coolify.io/docs/applications/configuration/resource-limits)
- [Coolify health checks](https://coolify.io/docs/applications/configuration/health-checks)
- [NGINX Basic authentication](https://nginx.org/en/docs/http/ngx_http_auth_basic_module.html)
