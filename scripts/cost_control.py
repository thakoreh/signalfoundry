"""Local operator monetary controls. Never contacts a provider or reads keys."""
import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from app.cost_admission import CostDenied, CostLedger
from app.store import Repository


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', required=True, type=Path, help='Explicit existing authoritative app database')
    parser.add_argument('--tenant', default='local-demo')
    sub = parser.add_subparsers(dest='action', required=True)
    sub.add_parser('status')
    sub.add_parser('stop')
    configure = sub.add_parser('configure')
    configure.add_argument('--policy', required=True, type=Path, help='Private JSON with explicit global and tenant policies')
    authorize = sub.add_parser('authorize')
    authorize.add_argument('--scope', choices=['global', 'tenant'], required=True)
    authorize.add_argument('--reference', required=True)
    reconcile = sub.add_parser('reconcile')
    reconcile.add_argument('--attempt', required=True, help='Hashed attempt ID from the local ledger')
    reconcile.add_argument('--actual-micro-usd', type=int, required=True)
    reconcile.add_argument('--reference', required=True)
    for child in (configure, authorize, reconcile):
        child.add_argument('--owner-authorized', required=True, action='store_true', help='Confirm separate owner authorization and real source evidence; this flag is not permission to spend')
    args = parser.parse_args()
    if not args.db.is_file():
        parser.error('Use an existing database; this command will not create a new budget authority.')
    ledger = CostLedger(Repository(args.db, args.tenant))
    try:
        if args.action == 'stop':
            ledger.kill()
        elif args.action == 'configure':
            if args.policy.stat().st_size > 32_768:
                raise CostDenied('The private policy file is too large.')
            policies = json.loads(args.policy.read_text(encoding='utf-8'))
            if set(policies) != {'global', 'tenant'} or policies['tenant'].get('scope_id') != args.tenant:
                raise CostDenied('Provide exactly global and current tenant policies, with explicit scope_id.')
            for scope in ('global', 'tenant'):
                values = dict(policies[scope])
                identity = values.pop('scope_id')
                ledger.configure_scope(scope, identity, **values)
        elif args.action == 'authorize':
            ledger.authorize(args.scope, 'all' if args.scope == 'global' else args.tenant, args.reference)
        elif args.action == 'reconcile':
            ledger.reconcile(args.tenant, args.attempt, args.actual_micro_usd, args.reference)
        print(json.dumps(ledger.status(args.tenant), indent=2))
    except (CostDenied, ValueError, TypeError, OSError):
        # A malformed operator file could contain private values. Do not echo it.
        print('Monetary control was not completed. Check the policy fields, current immutable period, pending exposure and source references locally.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
