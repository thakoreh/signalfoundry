# SignalFoundry

An AI B2B customer-discovery and outreach-preparation application: describe your offering, review an editable target brief, discover potential customer companies, inspect public-site evidence and named contacts, then shortlist, draft and export. Manual website/CSV import is an optional starting point.

The public homepage lives at `/`; the application lives at `/workspace`. It includes a responsive landing page, a discovery-first workspace, real Exa company-search and People Data Labs Person Search adapters, and an optional Jev qualifier for manual research. Commercial discovery is **disabled by default** until separately approved server credentials, provider rights and spend limits are configured. Independent email verification is an unconfigured extension point; provider-returned emails remain unverified. Email delivery, reply tracking, meeting booking and consumer/community discovery are not implemented.

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

1. Open `/workspace` and create a customer campaign from your app/website or offering description
2. Generate and edit the suggested buyer roles, industries, company sizes, geography, keywords and exclusions
3. Review the frozen campaign brief, then save a draft. In an approved SaaS environment, choose **Find customers**; local/preview discovery remains disabled
4. Inspect discovered company evidence, fit limitations and provider-reported contacts; shortlist promising accounts. Manual website/CSV import remains available
5. Create an evidence-grounded outreach draft for human review and export a licensed CSV when export rights are approved

A draft is never sent. Public preview and SaaS reject demo campaigns and demo-reset requests; test fixtures are limited to isolated private tests. A homepage observation is not a verified buying signal. Unknown company details, contacts, email verification and event dates remain unknown.

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

The default installation needs no API key and performs no paid API calls. Manual website research makes ordinary HTTPS requests only to the public company URLs supplied for the campaign. The website analyzer is an editable draft, not a factual certification. Discovery adapters accept a reviewed campaign brief and find company domains; local/preview mode still allows only manual-domain research. Commercial discovery/contact keys, licenses and spend limits are not configured by this repository. Read [discovery contracts and commercial gates](backend/DISCOVERY.md) and the current [review handoff](NEXT_STEPS.md).

Never put credentials in browser variables or source code. Optional decision-provider setup is server-side, off by default, and documented separately. The OpenAI Decisions API remains an extension point until a public, verified contract is available.

## Local demo security boundary

SSRF defenses reject non-public addresses and unsafe schemes and recheck redirect destinations. Fetches have bounded time and size. CSV fields are neutralized against spreadsheet formula injection. Local access controls and tenant-scoped queries are useful defense in depth, but are **not authentication**. This app is intended for one trusted operator on a private machine.

## License and deployment

No application license or final commercial name is assigned. Review package licenses and establish your own product terms before distribution. The source is published at https://github.com/thakoreh/signalfoundry. Start a deployment handoff with [DEPLOYMENT_HANDOFF.md](DEPLOYMENT_HANDOFF.md). See [Coolify deployment](deploy/COOLIFY.md) for the protected-preview setup and verification gates; adding deployment configuration does not mean a live deployment exists.
