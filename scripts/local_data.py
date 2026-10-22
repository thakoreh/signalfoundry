"""Offline local data operator. Never sends, spends or activates a restore."""
import argparse
import json
import sqlite3
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from app.local_data import backup_database, erase_tenant, export_tenant, restore_quarantined
from app.store import Repository


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', type=Path, required=True, help='Explicit existing local SQLite file; never defaults to owner data')
    parser.add_argument('--tenant', default='local-demo')
    commands = parser.add_subparsers(dest='action', required=True)
    for name in ('backup', 'restore-drill', 'export'):
        child = commands.add_parser(name)
        child.add_argument('--output', type=Path, required=True, help='New file in an existing private directory')
    erase = commands.add_parser('erase-and-close')
    erase.add_argument('--confirm', required=True, help='ERASE AND CLOSE <tenant>; permanently closes this authority for that tenant')
    erase.add_argument('--owner-authorized', required=True, action='store_true')
    args = parser.parse_args()
    if not args.db.is_file():
        parser.error('Use an existing database. This command does not create a new authority.')
    try:
        if args.action == 'backup':
            result = backup_database(args.db, args.output)
        elif args.action == 'restore-drill':
            result = restore_quarantined(args.db, args.output)
        elif args.action == 'export':
            snapshot = export_tenant(Repository(args.db, args.tenant))
            # Do not echo contact data into a terminal or overwrite any file.
            with args.output.open('x', encoding='utf-8') as handle:
                json.dump(snapshot, handle, ensure_ascii=True, indent=2)
            result = {'status': 'export_written', 'contains_contact_data': True}
        else:
            erase_tenant(Repository(args.db, args.tenant), args.confirm)
            result = {'status': 'logically_erased_and_closed', 'retained': 'suppression, financial audit, closure facts; external copies and disk remnants require separate handling'}
        print(json.dumps(result))
        return 0
    except (OSError, ValueError, sqlite3.Error):
        print('Local data operation failed. No live restore was activated. Check the explicit paths, private output directory, confirmation and integrity locally.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
