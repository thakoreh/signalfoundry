"""Durable local USD admission. No credentials, prices, or history are inferred.

One SQLite file is the authority for all its tenants. Hosted/stateless workers
have no context and cannot dispatch. Operator policy methods are not HTTP APIs.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json

CEILING = 25_000_000  # Integer micro-USD. This cap is not spending permission.
OPERATIONS = {'deepseek:search', 'brave:search', 'hunter:domain-search', 'hunter:email-verifier', 'deepseek:intro'}
SCHEMA = '''
CREATE TABLE IF NOT EXISTS cost_policies (
 scope TEXT NOT NULL, scope_id TEXT NOT NULL, period TEXT NOT NULL,
 cap INTEGER NOT NULL, historical INTEGER NOT NULL, cutoff TEXT NOT NULL,
 reference TEXT NOT NULL, enabled INTEGER NOT NULL, catalog TEXT NOT NULL,
 PRIMARY KEY(scope,scope_id,period)
);
CREATE TABLE IF NOT EXISTS paid_attempts (
 tenant TEXT NOT NULL, attempt TEXT NOT NULL, operation TEXT NOT NULL, fingerprint TEXT NOT NULL,
 period TEXT NOT NULL, reserved INTEGER NOT NULL, actual INTEGER, status TEXT NOT NULL,
 quote TEXT NOT NULL, usage TEXT, created_at TEXT NOT NULL, finished_at TEXT,
 resolution_lock INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(tenant,attempt)
);
CREATE INDEX IF NOT EXISTS paid_exposure ON paid_attempts(period,status,tenant);
CREATE TABLE IF NOT EXISTS monetary_audit (
 id INTEGER PRIMARY KEY, at TEXT NOT NULL, kind TEXT NOT NULL, scope TEXT NOT NULL, reference TEXT NOT NULL
);
'''


class CostDenied(ValueError):
    """Fixed safe reason; never format a provider response or private prompt."""


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=True, separators=(',', ':')).encode()).hexdigest()


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def positive_int(value, maximum=CEILING):
    if type(value) is not int or not 0 <= value <= maximum:
        raise CostDenied('The monetary policy or provider usage is invalid.')
    return value


def quote_call(operation, payload, spec):
    if operation not in OPERATIONS or not isinstance(spec, dict) or not spec.get('version') or not spec.get('source'):
        raise CostDenied('Current provider pricing and billing bounds have not been accepted.')
    encoded = json.dumps(payload, ensure_ascii=True, separators=(',', ':')).encode()
    if len(encoded) > 40_000:
        raise CostDenied('The paid request exceeds its admitted payload limit.')
    if operation == 'deepseek:intro':
        if spec.get('kind') != 'tokens' or payload.get('max_tokens') != 600 or payload.get('model') != spec.get('model'):
            raise CostDenied('The model or token bound is not covered by the current price policy.')
        # Deliberately pessimistic byte bound plus framing. No len(text)/4 guess.
        input_bound, output_bound = len(encoded) + 4096, 600
        input_rate = positive_int(spec.get('input_per_million'))
        output_rate = positive_int(spec.get('output_per_million'))
        hold = (input_bound * input_rate + output_bound * output_rate + 999_999) // 1_000_000
        return {'hold': max(1, hold), 'input_bound': input_bound, 'output_bound': output_bound, 'spec': spec}
    if spec.get('kind') != 'flat':
        raise CostDenied('This operation lacks an accepted per-request billing bound.')
    return {'hold': max(1, positive_int(spec.get('per_call'))), 'spec': spec}


def actual_cost(quote, raw):
    if quote['spec']['kind'] == 'flat':
        return quote['hold'], {}
    usage = raw.get('usage')
    if not isinstance(usage, dict):
        raise CostDenied('Provider usage is missing; monetary exposure needs reconciliation.')
    prompt = positive_int(usage.get('prompt_tokens'), 10_000_000)
    output = positive_int(usage.get('completion_tokens'), 10_000_000)
    if prompt > quote['input_bound'] or output > quote['output_bound']:
        raise CostDenied('Provider usage exceeded its admitted bound; monetary exposure needs reconciliation.')
    total = usage.get('total_tokens')
    if total is not None and (type(total) is not int or total != prompt + output):
        raise CostDenied('Provider usage is inconsistent; monetary exposure needs reconciliation.')
    spec = quote['spec']
    amount = (prompt * spec['input_per_million'] + output * spec['output_per_million'] + 999_999) // 1_000_000
    return amount, {'prompt_tokens': prompt, 'completion_tokens': output}


class CostLedger:
    def __init__(self, repository):
        self.repo = repository
        with self.repo.connect() as db:
            db.executescript(SCHEMA)
            db.execute('BEGIN IMMEDIATE')
            if 'resolution_lock' not in {row['name'] for row in db.execute('PRAGMA table_info(paid_attempts)')}:
                db.execute('ALTER TABLE paid_attempts ADD COLUMN resolution_lock INTEGER NOT NULL DEFAULT 0')

    def configure_scope(self, scope, scope_id, *, historical, cutoff, reference, cap=CEILING, enabled=False, catalog=None, period=None):
        """Trusted offline operator setup only. Never seed with an assumed zero.

        Historical import covers only usage before the first ledger attempt.
        Policy rows are immutable; kill state has a separate explicit operation.
        A new month requires its own reconciliation, never an automatic reset.
        """
        period = period or utc_now()[:7]
        if scope not in ('global', 'tenant') or (scope == 'global' and scope_id != 'all') or not scope_id:
            raise CostDenied('Invalid monetary scope.')
        positive_int(historical)
        positive_int(cap)
        try:
            boundary = datetime.fromisoformat(cutoff.replace('Z', '+00:00'))
            if boundary.tzinfo is None:
                raise ValueError()
            boundary = boundary.astimezone(timezone.utc)
            if boundary > datetime.now(timezone.utc) or boundary.strftime('%Y-%m') != period:
                raise ValueError()
        except (ValueError, AttributeError):
            raise CostDenied('Reconciliation needs an aware cutoff in the stated UTC month.') from None
        if not isinstance(reference, str) or not 8 <= len(reference) <= 240 or historical > cap:
            raise CostDenied('A bounded reconciliation reference and spend within the cap are required.')
        with self.repo.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            first = db.execute('SELECT MIN(created_at) FROM paid_attempts WHERE period=?', (period,)).fetchone()[0]
            if first and boundary >= datetime.fromisoformat(first):
                raise CostDenied('Historical import overlaps ledger attempts; reconcile their receipts separately.')
            try:
                db.execute('INSERT INTO cost_policies VALUES (?,?,?,?,?,?,?,?,?)',
                           (scope, scope_id, period, cap, historical, boundary.isoformat(), reference, int(enabled), json.dumps(catalog or {}, sort_keys=True)))
            except Exception:
                raise CostDenied('This monetary period already has a policy; it cannot be reset or overwritten.') from None
            db.execute('INSERT INTO monetary_audit(at,kind,scope,reference) VALUES (?,?,?,?)',
                       (utc_now(), 'policy_configured', scope + ':' + scope_id, reference))

    def kill(self, tenant=None):
        with self.repo.connect() as db:
            db.execute('UPDATE cost_policies SET enabled=0 WHERE scope=? AND scope_id=?',
                       ('tenant' if tenant else 'global', tenant or 'all'))
            db.execute('INSERT INTO monetary_audit(at,kind,scope,reference) VALUES (?,?,?,?)',
                       (utc_now(), 'kill', 'tenant:' + tenant if tenant else 'global:all', 'local operator stop'))

    def authorize(self, scope, identity, reference):
        """Trusted operator reauthorization of an existing immutable policy."""
        if scope not in ('global', 'tenant') or not isinstance(reference, str) or not 8 <= len(reference) <= 240:
            raise CostDenied('An explicit authorization reference is required.')
        with self.repo.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            if db.execute("SELECT 1 FROM paid_attempts WHERE status IN ('uncertain','dispatching') LIMIT 1").fetchone():
                raise CostDenied('Resolve every pending or uncertain attempt before reauthorization.')
            updated = db.execute('UPDATE cost_policies SET enabled=1 WHERE scope=? AND scope_id=? AND period=?',
                                 (scope, identity, utc_now()[:7]))
            if not updated.rowcount:
                raise CostDenied('Reconcile a current monetary policy before authorization.')
            db.execute('INSERT INTO monetary_audit(at,kind,scope,reference) VALUES (?,?,?,?)',
                       (utc_now(), 'authorized', scope + ':' + identity, reference))

    def recover_inflight(self):
        """Call once at app startup; abandoned dispatch claims never become free."""
        with self.repo.connect() as db:
            db.execute("UPDATE paid_attempts SET status='uncertain' WHERE status='dispatching'")

    def status(self, tenant):
        period = utc_now()[:7]
        with self.repo.connect() as db:
            global_policy = db.execute("SELECT * FROM cost_policies WHERE scope='global' AND scope_id='all' AND period=?", (period,)).fetchone()
            tenant_policy = db.execute("SELECT * FROM cost_policies WHERE scope='tenant' AND scope_id=? AND period=?", (tenant, period)).fetchone()
            unknown = db.execute("SELECT COUNT(*) FROM paid_attempts WHERE status IN ('uncertain','dispatching')").fetchone()[0]
            exposure = db.execute('SELECT COALESCE(SUM(COALESCE(actual,reserved)),0) FROM paid_attempts WHERE tenant=? AND period=?', (tenant, period)).fetchone()[0]
        ready = bool(global_policy and tenant_policy and global_policy['enabled'] and tenant_policy['enabled'] and not unknown)
        return {'status': 'admission_required' if ready else 'blocked', 'period': period, 'currency': 'USD',
                'historical_usage_known': bool(global_policy and tenant_policy),
                'tenant_ledger_exposure_micro_usd': exposure,
                'detail': 'Every request still needs atomic price/cap admission.' if ready else 'Paid work is blocked until history, pricing and owner authorization are reconciled. Saved work and manual outreach remain available.'}

    def reserve(self, tenant, attempt, operation, payload, *, billing_identity=None):
        created = utc_now()
        period = created[:7]
        fingerprint = digest([operation, payload, billing_identity])
        with self.repo.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            prior = db.execute('SELECT fingerprint FROM paid_attempts WHERE tenant=? AND attempt=?', (tenant, attempt)).fetchone()
            if prior:
                if prior['fingerprint'] != fingerprint:
                    raise CostDenied('This paid attempt is bound to different input.')
                raise CostDenied('This paid attempt already exists. Reuse its saved result; no automatic retry is allowed.')
            if db.execute("SELECT 1 FROM paid_attempts WHERE status IN ('uncertain','dispatching') LIMIT 1").fetchone():
                raise CostDenied('Uncertain or pending provider exposure blocks new paid work until a known receipt or reconciliation.')
            policies = []
            for scope, identity in (('global', 'all'), ('tenant', tenant)):
                row = db.execute('SELECT * FROM cost_policies WHERE scope=? AND scope_id=? AND period=?', (scope, identity, period)).fetchone()
                if not row or not row['enabled']:
                    raise CostDenied('Paid work is blocked: monetary history or owner authorization is missing.')
                policies.append(row)
            catalog = json.loads(policies[0]['catalog'])
            quote = quote_call(operation, payload, catalog.get(operation))
            if billing_identity is not None and quote['spec'].get('billing_identity') != billing_identity:
                raise CostDenied('The configured provider credential is not bound to this reconciled billing policy.')
            for row in policies:
                tenant_clause, args = (' AND tenant=?', (period, tenant)) if row['scope'] == 'tenant' else ('', (period,))
                spent = db.execute('SELECT COALESCE(SUM(COALESCE(actual,reserved)),0) FROM paid_attempts WHERE period=?' + tenant_clause, args).fetchone()[0]
                if row['historical'] + spent + quote['hold'] > row['cap']:
                    raise CostDenied('The monetary allowance cannot admit this request.')
            if db.execute('SELECT COUNT(*) FROM paid_attempts').fetchone()[0] >= 100_000:
                raise CostDenied('The monetary audit allowance is full. Preserve and review its history before continuing.')
            # One shared in-flight call. A failed settlement write cannot leave
            # a dispatching row that permits other processes to keep spending.
            db.execute('INSERT INTO paid_attempts(tenant,attempt,operation,fingerprint,period,reserved,actual,status,quote,usage,created_at,finished_at) VALUES (?,?,?,?,?,?,NULL,?,?,NULL,?,NULL)',
                       (tenant, attempt, operation, fingerprint, period, quote['hold'], 'dispatching', json.dumps(quote), created))
        return quote

    def uncertain(self, tenant, attempt):
        with self.repo.connect() as db:
            db.execute("UPDATE paid_attempts SET status='uncertain' WHERE tenant=? AND attempt=? AND status='dispatching'", (tenant, attempt))

    def settle(self, tenant, attempt, raw):
        failure = None
        with self.repo.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT * FROM paid_attempts WHERE tenant=? AND attempt=?', (tenant, attempt)).fetchone()
            if not row:
                raise CostDenied('Paid attempt not found.')
            if row['resolution_lock']:
                raise CostDenied('This receipt needs explicit operator reconciliation; a late response cannot replace it.')
            try:
                quote = json.loads(row['quote'])
                amount, usage = actual_cost(quote, raw)
                if amount > row['reserved']:
                    raise CostDenied('Actual cost exceeds its reservation; reconciliation is required.')
                if row['status'] == 'settled':
                    if row['actual'] != amount or json.loads(row['usage']) != usage:
                        raise CostDenied('Conflicting monetary receipt; reconciliation is required.')
                    return
                db.execute("UPDATE paid_attempts SET status='settled',actual=?,usage=?,finished_at=? WHERE tenant=? AND attempt=? AND status IN ('dispatching','uncertain')",
                           (amount, json.dumps(usage, sort_keys=True), utc_now(), tenant, attempt))
            except CostDenied as error:
                failure = error
                db.execute("UPDATE paid_attempts SET status='uncertain',resolution_lock=1 WHERE tenant=? AND attempt=?", (tenant, attempt))
        if failure:
            raise failure

    def reconcile(self, tenant, attempt, actual_micro_usd, reference):
        """Trusted operator receipt reconciliation; never a browser/provider claim."""
        positive_int(actual_micro_usd, 1_000_000_000)
        if not isinstance(reference, str) or not 8 <= len(reference) <= 240:
            raise CostDenied('A provider billing reconciliation reference is required.')
        with self.repo.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT reserved FROM paid_attempts WHERE tenant=? AND attempt=?', (tenant, attempt)).fetchone()
            if not row:
                raise CostDenied('Paid attempt not found.')
            # Over-bound receipts remain a global stop, with the observed amount
            # retained rather than clamped to the reservation or monthly cap.
            state = 'uncertain' if actual_micro_usd > row['reserved'] else 'settled'
            db.execute('UPDATE paid_attempts SET actual=?,status=?,usage=?,finished_at=?,resolution_lock=1 WHERE tenant=? AND attempt=?',
                       (actual_micro_usd, state, json.dumps({'operator_reference': reference}), utc_now(), tenant, attempt))
            db.execute('INSERT INTO monetary_audit(at,kind,scope,reference) VALUES (?,?,?,?)',
                       (utc_now(), 'receipt_reconciled', 'tenant:' + tenant + ':' + attempt, reference))

    def run(self, tenant, attempt, operation, payload, dispatch, *, billing_identity=None):
        self.reserve(tenant, attempt, operation, payload, billing_identity=billing_identity)
        try:
            result = dispatch()
            self.settle(tenant, attempt, result)
            return result
        except BaseException:
            self.uncertain(tenant, attempt)
            raise


@dataclass(frozen=True)
class CostContext:
    ledger: CostLedger
    tenant: str
    logical_attempt: str

    def run(self, operation, payload, dispatch, *, billing_identity=None):
        attempt = digest([self.logical_attempt, operation])
        return self.ledger.run(self.tenant, attempt, operation, payload, dispatch, billing_identity=billing_identity)

    def child(self, unit):
        return CostContext(self.ledger, self.tenant, digest([self.logical_attempt, unit]))


def paid_call(context, operation, payload, dispatch, *, billing_identity=None):
    if not isinstance(context, CostContext):
        raise CostDenied('Paid dispatch has no authoritative tenant monetary admission context.')
    return context.run(operation, payload, dispatch, billing_identity=billing_identity)
