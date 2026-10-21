"""Synthetic monetary policies for offline tests. These are NOT provider prices."""
from datetime import datetime, timezone
from pathlib import Path
import tempfile
from app.cost_admission import CostLedger, CostContext
from app.store import Repository

CATALOG = {operation: {'kind': 'flat', 'per_call': 100, 'version': 'fictional-v1', 'source': 'offline-test-fixture'}
           for operation in ('deepseek:search', 'brave:search', 'hunter:domain-search', 'hunter:email-verifier')}
CATALOG['deepseek:intro'] = {'kind': 'tokens', 'model': 'deepseek-flash', 'input_per_million': 1_000_000,
                            'output_per_million': 2_000_000, 'version': 'fictional-v1', 'source': 'offline-test-fixture'}


def cost_context(case, *, cap=25_000_000, historical=0, tenant='fixture-tenant', logical='fixture-attempt'):
    temp = tempfile.TemporaryDirectory()
    case.addCleanup(temp.cleanup)
    ledger = CostLedger(Repository(Path(temp.name) / 'fictional-cost.sqlite3', tenant))
    cutoff = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    for scope, identity in (('global', 'all'), ('tenant', tenant)):
        ledger.configure_scope(scope, identity, historical=historical, cutoff=cutoff, reference='fictional-reconciled-fixture',
                               cap=cap, enabled=True, catalog=CATALOG)
    return CostContext(ledger, tenant, logical)
