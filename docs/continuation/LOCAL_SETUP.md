# Local continuation setup, controls and rollback

Current scope: local manual-assisted candidate, not public production. Use the existing release-candidate branch/PR7. Never copy the owner's env/database into a fixture, restart their preview or choose occupied ports. Inspect Git/status/worktrees first. No command here authorizes spending, connection, outreach, deployment or merge.

## Runtime and one local run command

Existing stack: Node24, Python3.12+ (this continuation tested3.13 on Windows), pinned frontend lockfile and backend requirements.lock.txt including tzdata for Windows. Use the chosen Node on PATH; avoid the Windows Store python3 alias. Install existing lockfiles into this checkout only. The ordinary run command is:

```powershell
.\.venv\Scripts\python.exe scripts/dev.py
```

The launcher binds loopback API8000/browser3000 by default. Existing authorized env may select BACKEND_PORT and FRONTEND_PORT3000 or3001. The launcher refuses occupied/equal ports before starting; do not stop the owner's services to make it fit. Set SIGNALFOUNDRY_DB_PATH to an explicit isolated SQLite file for disposable testing. Without it, the existing backend/data default is used—do not point a test at saved owner data. SQLite is not authentication and must remain private.

`scripts/dev.sh` wraps the launcher on supported POSIX setups. Windows uses the selected Python command above. Stop only the launcher/process tree you started. Windows cleanup now stops its explicitly created tree, including a venv redirector child; it does not enumerate/kill another app's ports.

## One check command and Windows limits

The complete required check entry point remains `bash scripts/check.sh` on the Ubuntu CI environment. It includes backend tests, the new actual loopback HTTP+fresh SQLite manual journey, packaging/deployment/launcher/preflight/worker, frontend Node/Convex/component/type/lint/build and proxy/full-stack checks. CI additionally runs browser, dependency/secret and container checks. Do not skip or loosen them.

On Windows, run backend tests from backend with `..\.venv\Scripts\python.exe -m unittest discover -s tests -q`; frontend npm commands use Node24. `python scripts/test_local_journey_http.py` runs the credential-free isolated API journey and stops/removes its own fixture. It holds the listening socket across allocation→child→teardown, checks process/nonce ownership before requests and never selects an existing app DB. This is not rendered-browser proof. Native `python scripts/package_source.py` supports source packaging; the Bash wrapper honors PYTHON. POSIX-only Nginx path renderer/proxy scripts still require Ubuntu, and Docker tests require a daemon. Record unsupported local runs honestly and require exact-head CI; never relax security paths for Windows.

The proxy integration test preloads `scripts/fixture_loopback_fetch.cjs` into its own disposable Next child only. This keeps framework metadata fetches offline: Next's development version checker has no timeout and otherwise can hang before serving requests. All original host/security/delayed-response assertions and deadlines remain unchanged. The preload admits loopback HTTP fetch with original request/abort options and rejects external fetch; it is not a generic network firewall. No user env variable is added and ordinary app dev/build/start never loads it. Rollback is an ordinary revert of this test-launch seam, not an app security setting or data reset.

## Configuration and off switches

| Setting / control | Meaning and safe default |
|---|---|
|SIGNALFOUNDRY_MODE / NEXT_PUBLIC_SIGNALFOUNDRY_MODE|Both local-demo for the local app; hosted saas never falls back to local SQLite. Launcher supplies local values.|
|SIGNALFOUNDRY_DB_PATH|Explicit existing authority or NEW disposable fixture path. Never change to an old/copied DB to reset spending/opt-outs.|
|BACKEND_PORT / FRONTEND_PORT / API_BASE_URL|Private selected service ports; frontend allowed3000/3001. Launcher supplies matching API_BASE_URL; production Next rewrites are build-time. Do not reuse owner preview ports/build assets.|
|CLIENTROVE_LOCAL_OUTREACH_ENABLED|Default true locally for compatibility. Set false and restart to deny the outreach adapter, including fresh Copy/mailto preflight, while retaining saved records/research. Hosted/public preview remains denied regardless.|
|CLIENTROVE_LOCAL_EXPORT_ENABLED|Default true only for private local export. Set false to deny export; no deletion occurs. Public/hosted export stays denied.|
|SIGNALFOUNDRY_HOSTED_OUTREACH_PERSISTENCE_ENABLED|Default off. Tests alone set true for the new internal Convex manual-ledger prerequisites. It does not open the closed hosted adapter, deploy anything or permit paid/send operations. Leave unset in owner configuration. Off retains records; see HOSTED_LEDGER.md and HOSTED_LIFECYCLE.md for internal lifecycle coverage, incomplete parity and rollback.|
|CLIENTROVE_SEARCH_PROVIDER|Existing deepseek/brave selection; does not grant paid permission.|
|CLIENTROVE_DEEPSEEK_ENABLED / CLIENTROVE_BRAVE_SEARCH_ENABLED / CLIENTROVE_HUNTER_ENABLED|Existing explicit provider activation flags, default off. Keep off for QA; never put real keys in fixtures.|
|CLIENTROVE_DEEPSEEK_DRAFTS_ENABLED / DEEPSEEK_API_KEY|Existing initial AI draft opt-in+private key. Keys alone do not activate. Monetary admission must also allow every request.|
|CLIENTROVE_DEEPSEEK_REPLIES_ENABLED|Default off. Explicit true permits local founder-requested reply suggestions only after context disclosure, active classified interested/question reply, source/sender checks and separate `deepseek:reply` token-price admission. Keep off for review. No provider calls are authorized by this documentation. Saved unchanged suggestions can reopen without a new call; manual writing remains available. See REPLY_COPILOT.md.|
|BRAVE_SEARCH_API_KEY / HUNTER_API_KEY|Existing optional private provider keys; never needed by offline tests. No new subscriptions/accounts are authorized.|
|DECISION_ENGINE|Keep rules. Legacy live Jev is monetary-gated/no authority, not an alternative paid fallback.|
|SIGNALFOUNDRY_PREVIEW_ORIGIN / SIGNALFOUNDRY_PUBLIC_ACCESS|Existing protected/public-preview configuration; neither enables hosted outreach or public export. Never expose the local API publicly.|
|Monetary stop|`python scripts/cost_control.py --db <explicit-authority> stop` denies further paid admission. Already admitted requests retain their hold; it cannot retract a call. Reauthorization/history/prices need separate owner authority; see MONETARY_SAFEGUARDS.md.|

Keep actual keys/statements/policy JSON private and outside Git. There are no seeded real prices/history/balances. US$25 includes earlier DeepSeek activity, which remains unknown. No Ads spend. Do not set a zero balance/history to get past a gate. Quarantined/erased workspaces cannot admit paid requests even if policies are later enabled.

## Data and manual operating loop

For an owner-controlled visual review, create a NEW clearly fictional database first (parent directory must already exist):

```powershell
.\.venv\Scripts\python.exe scripts/seed_local_review.py --db "<new-private-review.sqlite3>" --fictional-only
$env:SIGNALFOUNDRY_DB_PATH = "<same-absolute-review.sqlite3>"
# Choose free allowed ports; keep all real provider flags/keys out of this test shell.
.\.venv\Scripts\python.exe scripts/dev.py
```

The seeder refuses even to open an existing file, makes no network calls, and prints the saved results/outreach paths. Every company/identity/source/contact/historical message is a manufactured fixture in this separate database, not customer/consent/demand evidence. Next up includes pending initial review, a due unapproved followup, a question to answer, and a past-time meeting to report; a future OOO date appears in departure. Shared monetary history remains unknown, so the review cannot authorize paid dispatch. Fixture preservation/new-file refusal and expected queue states are tested by `scripts/test_review_fixture.py`. No existing owner preview was restarted for this command.

Saved profile → customer search/results → prepared exact recipient/message review → fresh approval → Copy or Open in email app → explicit approved/changed/not-yet report → paste/classify replies → approved human answer or dated followup → timed meeting/outcome → Next up on return. Opening the email app is not sending. Unknown stays unknown. Shared inboxes are teams, not named people. Publication is unverified until actual verifier evidence exists.

Export, backup, restore drill and destructive erase-and-close commands are documented in LOCAL_DATA_OPERATIONS.md. They are explicit local owner operations; no owner data was used in tests. Restore has no activation command. Logical deletion does not wipe disk remnants or external exports/messages. Suppression and financial facts are retained deliberately. Hosted privacy, inbox/OAuth/transport/calendar and actual billing remain gated/unbuilt as STATUS.md states.

## Browser and review limits

Use Chrome only, never the in-app browser. Latest explicit owner answer "use my chrome" permits dedicated app-testing tabs through the connected tool. Do not read other owner tabs, profile files or saved data; this grants no standalone automation exception. CHROME_LOCAL_REVIEW_5c861c7.md records fresh partial local evidence and remaining full-journey/CSV/dialog/zoom gaps. Current CI and scoped captures are distinct from physical-phone/screen-reader or provider verification. For standalone local review, set matching modes and the owned API_BASE_URL **at build time**, then validate the built rewrite before launch; a runtime-only override cannot change a baked rewrite. Keep generated assets/builds separate from the owner preview.

## Rollback

Prefer forward fixes or normal reviewed revert commits, preserving additive saved data, sent snapshots, suppressions and financial audit. Keep all paid/provider/hosted operations off while diagnosing. Never force/rebase pushed history, roll an old DB over newer stop/cost facts, remove policies to reset exposure, merge/main-push/change rules, or delete the working branch. Stop only disposable owned processes. The owner performs any eventual deployment, account authority and merge after reviewing the exact final checks.
