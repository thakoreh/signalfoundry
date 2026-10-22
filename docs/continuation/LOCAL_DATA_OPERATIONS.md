# Local data operations and restore gates

These are local tools, not hosted privacy readiness or secure disk erasure. No owner data was used to verify them. Tests use fictional temporary SQLite files. Never point a trial command at a saved owner database. Hosted export/deletion, retention policy, authenticated request handling and production support remain incomplete.

## Export

Returning local workspace → Your local data → Export saved workspace requests a tenant-scoped JSON attachment. It includes profile, research, drafts, manual messages/history, requests and suppression facts. Reads use one SQLite snapshot, bounded at10000 rows/table and32MB; an over-limit export fails explicitly rather than dropping rows. No global monetary catalogue, other tenant or credentials are exported. Treat the downloaded file as contact data. The public preview/hosted route is denied. The owner may also use:

```powershell
python scripts/local_data.py --db "<explicit-existing-db>" --tenant local-demo export --output "<new-private-export.json>"
```

## Backup and isolated restore drill

Use the selected project Python, not the Windows Store python3 alias. Use a private existing directory outside Git/source packaging and a new output filename. The command never overwrites an existing file or live authority. SQLite's backup API captures a consistent snapshot including WAL state, then checks integrity. Output includes a SHA256, not contact contents.

```powershell
python scripts/local_data.py --db "<explicit-existing-db>" backup --output "<new-private-backup.sqlite3>"
python scripts/local_data.py --db "<explicit-backup.sqlite3>" restore-drill --output "<new-private-drill.sqlite3>"
```

Restore drills contain a durable quarantine. Application writes and new paid reservations are denied, policies are disabled, and interrupted paid holds stay uncertain with their reserved amount. The original file is untouched. There is intentionally **no activation/unquarantine command**. A historical copy lacks later opt-outs, erasures and financial receipts; activating it could reopen outreach or reset exposure. A separately reviewed reconciliation/import is required before a disaster recovery can replace the single authoritative database. A drill is not production recovery acceptance.

## Explicit logical erasure and closure

This is destructive and requires separate explicit owner authorization; the implementation run did not execute it on owner data. Stop the app/background jobs and close stale tabs first. Use export/backup only if the owner authorizes retention of those copies. Confirm the exact tenant/path before running:

```powershell
python scripts/local_data.py --db "<explicit-existing-db>" --tenant local-demo erase-and-close --owner-authorized --confirm "ERASE AND CLOSE local-demo"
```

The transaction removes the tenant's profile, campaigns/accounts, searches, cached drafts, conversations and request records. It retains only existing suppression facts, financial policies/holds/receipts/audit, and a dated closure tombstone. Tenant spending is disabled. SQL insert/update triggers deny late/stale app writers; middleware returns410 after closure; monetary admission independently checks closure/quarantine. Another tenant is unaffected. There is no reset/reactivate action. Existing in-flight financial exposure remains accountable rather than being refunded by deletion.

This is **logical deletion**, not a secure wipe: SQLite free pages/WAL, operating-system backups, separate exports and mail-app messages can retain copies. The app does not delete or encrypt external files. Retention duration and the production deletion/subprocessor process still require an owner policy. Never remove the financial/suppression authority to make an allowance look unused.

## Rollback and operations

Preserve the authoritative database and disable paid work through the monetary stop tool. Prefer forward repairs and normal Git revert commits; never restore an old DB over current suppression/monetary facts. A quarantined drill is disposable review data; stop only the explicitly owned test instance. No inbox/transport/calendar or public deployment is enabled by these tools. Private exports/backups remain excluded from source archives.
