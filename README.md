# SignalFoundry

A B2B prospect research application with a Clerk + Convex + Stripe SaaS release candidate and a separate local demo. SignalFoundry is a temporary product name.

**SaaS launch is gated.** The new multi-user code requires provider configuration, review, and live-environment acceptance before customer use. Start with [SaaS setup](docs/SAAS_SETUP.md), [launch gates](docs/PRODUCTION_READINESS.md), and [operations](docs/OPERATIONS.md). Nothing in this branch automatically provisions accounts, credentials, prices, migrations, or a deployment.

## Local demo instructions

**This is a local demo, not a production multi-user SaaS.** There is no login, billing, outbound sending, or commercial lead-data subscription. Do not expose either application server publicly. An optional password-protected single-operator preview is described in [Coolify deployment](deploy/COOLIFY.md). The app has one local workspace, and anyone with access to that instance can see and edit its contents.

## Start

Requirements: Python 3.11+ with `venv`, Node.js 22.6+ and npm (tested with Node 24), and a Bash shell.

### Windows: recommended WSL 2 route

Use Ubuntu in WSL 2 for the supplied shell scripts. If needed, follow [Microsoft’s WSL installation guide](https://learn.microsoft.com/en-us/windows/wsl/install). Install Python and Node **inside Ubuntu**, not only on Windows; some distributions require the `python3-venv` package. Extract the project under your WSL Linux home directory, open its folder in the Ubuntu terminal, and run:

```bash
bash scripts/setup.sh
bash scripts/dev.sh
```

Then try http://localhost:3000 in your Windows browser. Keep both servers bound to loopback; do not expose them to your network. Linux checks passed in the build environment; **WSL 2 and native Windows were not tested**. Native PowerShell/Command Prompt launch scripts are not included. The separate protected-preview Docker setup does not change these local instructions.

### Linux / macOS shell

From the extracted project folder, run the same two Bash commands above. Verification was performed on Linux; macOS was not separately tested.

Open http://localhost:3000. FastAPI is available at http://127.0.0.1:8000/api/health and its interactive development API documentation at http://127.0.0.1:8000/docs.

1. Load the fictional demo to explore the full workflow, or enter your public business website and review the draft ideal customer profile
2. Edit your target industries, roles, company sizes, regions and keywords
3. Create a demo campaign or paste public business domains for a real research campaign
4. Run research, inspect each account's sources and scoring, and shortlist promising accounts
5. Create an evidence-grounded outreach draft for human review and export a CSV

A draft is never sent. Demo accounts and their supporting examples are fictional and labeled throughout. A homepage observation is not a verified buying signal. Unknown company details, contacts, email verification and event dates remain unknown.

## Local demo architecture

- Next.js / React / TypeScript frontend, with same-origin `/api` requests proxied to FastAPI
- FastAPI / Pydantic API with strict payload validation
- SQLite repository with tenant-scoped operations, using a single fixed local workspace
- Bounded public-website research and timestamped evidence records
- Replaceable decision-provider boundary; deterministic, explainable rules are the default
- Evidence-grounded text templates for drafts; no invented prior relationship or claim of personal experience

See [API contract](API_CONTRACT.md), [production checklist](docs/PRODUCTION_READINESS.md), and the backend and frontend README files for implementation details.

## Verify

```bash
./scripts/check.sh
```

Stop development servers before the full check suite; its isolated production-stack test uses local ports 8000 and 3001.

For a running disposable development instance, `python3 scripts/smoke.py` exercises the full HTTP workflow and initializes a fictional demo profile. This preserves existing campaigns but changes the active ICP. See [verification record](docs/VERIFICATION.md) for completed checks and explicit verification limits.

## Data and external services

The default installation needs no API key and performs no paid API calls. Manual website research makes ordinary HTTPS requests only to the public company URLs supplied for the campaign. The website analyzer is an editable draft, not a factual certification. Candidate discovery uses explicitly fictional fixtures in demo mode; real research starts with user-supplied domains. Commercial discovery and contact-verification integrations are intentionally not configured.

Never put credentials in browser variables or source code. Optional decision-provider setup is server-side, off by default, and documented separately. The OpenAI Decisions API remains an extension point until a public, verified contract is available.

## Local demo security boundary

SSRF defenses reject non-public addresses and unsafe schemes and recheck redirect destinations. Fetches have bounded time and size. CSV fields are neutralized against spreadsheet formula injection. Local access controls and tenant-scoped queries are useful defense in depth, but are **not authentication**. This app is intended for one trusted operator on a private machine.

## License and deployment

No application license or final commercial name is assigned. Review package licenses and establish your own product terms before distribution. The source is published at https://github.com/thakoreh/signalfoundry. Start a deployment handoff with [DEPLOYMENT_HANDOFF.md](DEPLOYMENT_HANDOFF.md). See [Coolify deployment](deploy/COOLIFY.md) for the protected-preview setup and verification gates; adding deployment configuration does not mean a live deployment exists.
