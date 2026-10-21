# Clientrove (SignalFoundry repository)

An application for B2B SaaS founders moving from a product website to relevant prospects, reviewed outreach, conversations, timed meetings and reported customer outcomes. The current local loop is manual-assisted: prepare and approve exact messages, copy or open them in an email app, explicitly record what was sent, paste replies, and return to Next up. Nothing sends automatically.

The homepage lives at `/`, returning work at `/workspace`, website-first setup at `/workspace/setup`, discovery at `/workspace/customers`, and saved results at `/workspace/customers/[searchId]`. DeepSeek search/initial drafting and optional Hunter require both explicit provider configuration and reconciled global/tenant monetary admission. Historical usage and actual pricing are not seeded; an existing key alone cannot authorize paid dispatch. Research and published emails are not proof of buying intent, verification or permission to send.

The private local application has persistent `/workspace/outreach/[searchId]` views for Review, Conversations, and Meetings, fresh referrals, max-two dated manual followups, company pauses, sticky opt-outs, timed meeting reports and an honest reported-company funnel. Local export/closure and quarantined backup/restore tools exist. Optional editable reply suggestions now have a separately disabled flag, context disclosure and monetary admission; offline tests are not live model verification. **Connected sending, inbox synchronization, automatic follow-ups, and calendar-confirmed booking are not implemented. Hosted outreach fails closed until tenant-backed parity exists.** This candidate remains incomplete. Use the [current status](docs/continuation/STATUS.md) and [consolidated local setup/off switches](docs/continuation/LOCAL_SETUP.md); earlier checks/screenshots do not accept the new complete journey.

**SaaS launch is gated.** The new multi-user code requires provider configuration, review, and live-environment acceptance before customer use. Start with [SaaS setup](docs/SAAS_SETUP.md), [launch gates](docs/PRODUCTION_READINESS.md), and [operations](docs/OPERATIONS.md). Nothing in this branch automatically provisions accounts, credentials, prices, migrations, or a deployment.

## Local demo instructions

**This is a local demo, not a production multi-user SaaS.** There is no login, billing, outbound sending, or commercial lead-data subscription. Do not expose either application server publicly. An optional password-protected single-operator preview is described in [Coolify deployment](deploy/COOLIFY.md). The app has one local workspace, and anyone with access to that instance can see and edit its contents.

## Start

Requirements: Python 3.11+ with `venv`, Node.js 22.6+ and npm (tested with Node 24), and a Bash shell.

### Native Windows

Use Python 3.11+ and Node.js 22.6+ (tested on this PC with Node 24). From the repository in PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.lock.txt
Push-Location frontend
npm ci
Pop-Location
.\.venv\Scripts\python.exe scripts/dev.py
```

The launcher starts both services on loopback. Set optional provider credentials in the backend's inherited environment as described in the engine setup; never commit secrets. The local workspace is stored in ignored SQLite data. Native Windows local startup, browser layouts and build/tests have been checked; that is not evidence of a deployed multi-user service.

### Windows: optional WSL 2 route

Use Ubuntu in WSL 2 for the supplied shell scripts. If needed, follow [Microsoft’s WSL installation guide](https://learn.microsoft.com/en-us/windows/wsl/install). Install Python and Node **inside Ubuntu**, not only on Windows; some distributions require the `python3-venv` package. Extract the project under your WSL Linux home directory, open its folder in the Ubuntu terminal, and run:

```bash
bash scripts/setup.sh
bash scripts/dev.sh
```

Then try http://localhost:3000 in your Windows browser. Keep both servers bound to loopback. WSL 2 was not separately tested. The separate protected-preview Docker setup does not change these local instructions.

### Linux / macOS shell

From the extracted project folder, run the same two Bash commands above. Verification was performed on Linux; macOS was not separately tested.

Open http://localhost:3000. FastAPI is available at http://127.0.0.1:8000/api/health and its interactive development API documentation at http://127.0.0.1:8000/docs.

1. Open `/workspace/setup`, enter a public business website, or use the quieter manual option.
2. Review the offering and ideal business buyer; advanced targeting is optional.
3. Choose a focused customer search (one to five businesses during testing); review progress on its saved run page.
4. Review the compact, contact-first list, explicitly create an AI draft if configured, or export selected businesses.
5. Choose Prepare outreach to save selected businesses into the local review/conversation/meeting workflow. Sending and outcomes are manual records, not external actions performed by the app.

A draft is never sent. Public preview and SaaS reject demo campaigns and demo-reset requests; test fixtures are limited to isolated private tests. A homepage observation is not a verified buying signal. Unknown company details, contacts, email verification and event dates remain unknown.

## Local demo architecture

- Next.js / React / TypeScript frontend, with same-origin `/api` requests proxied to FastAPI
- FastAPI / Pydantic API with strict payload validation
- SQLite repository with tenant-scoped operations, using a single fixed local workspace
- Bounded public-website research and timestamped evidence records
- Replaceable decision-provider boundary; deterministic, explainable rules are the default
- Explicit, bounded DeepSeek AI introductions from the saved offering and company evidence, with cached originals and human review
- SQLite-backed local outreach approvals, conversation records, suppression and reported outcomes; hosted outreach remains unavailable

See [API contract](API_CONTRACT.md), [production checklist](docs/PRODUCTION_READINESS.md), and the backend and frontend README files for implementation details.

## Verify

```bash
./scripts/check.sh
```

Stop development servers before the full check suite; its isolated production-stack test uses local ports 8000 and 3001.

For a running disposable development instance, `python3 scripts/smoke.py` exercises the full HTTP workflow and initializes a fictional demo profile. This preserves existing campaigns but changes the active ICP. See [verification record](docs/VERIFICATION.md) for completed checks and explicit verification limits.

## Data and external services

The default installation needs no API key and performs no paid API calls. Manual website research makes ordinary HTTPS requests only to the public company URLs supplied for the campaign. The website analyzer is an editable draft, not a factual certification. Research starts with user-supplied domains; there is no automatic prospect discovery. Commercial discovery and contact-verification integrations are intentionally not configured.

Never put credentials in browser variables or source code. Optional decision-provider setup is server-side, off by default, and documented separately. The OpenAI Decisions API remains an extension point until a public, verified contract is available.

## Local demo security boundary

SSRF defenses reject non-public addresses and unsafe schemes and recheck redirect destinations. Fetches have bounded time and size. CSV fields are neutralized against spreadsheet formula injection. Local access controls and tenant-scoped queries are useful defense in depth, but are **not authentication**. This app is intended for one trusted operator on a private machine.

## License and deployment

No application license or final commercial name is assigned. Review package licenses and establish your own product terms before distribution. The source is published at https://github.com/thakoreh/signalfoundry. Start a deployment handoff with [DEPLOYMENT_HANDOFF.md](DEPLOYMENT_HANDOFF.md). See [Coolify deployment](deploy/COOLIFY.md) for the protected-preview setup and verification gates; adding deployment configuration does not mean a live deployment exists.
