"""Local-only demo API. Run bound to 127.0.0.1; no authentication is provided."""
from __future__ import annotations
import csv
import io
import logging
import os
import threading
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .config import preview_origin
from .fixtures import DEMO_PROFILE
from .models import Account, AccountStatus, AnalyzeRequest, Campaign, CampaignCreate, Draft, EmptyRequest, Profile, Workspace
from .research import RulesDecisionProvider, demo_accounts, infer_profile, make_draft
from .safety import FetchError, fetch_public_page, normalize_url
from .store import Repository
from .customers import CustomerSearch, CustomerSearchRequest, DiscoveryRequest, ProviderError, discover_customers, engine_status
from .primitives import now
from .cost_admission import CostLedger, CostContext
from .customer_drafts import CustomerDraft, DraftError, DraftTerminalError, DraftCostDenied, DraftInput, DraftRequest, draft_cache_key, draft_status, generate_customer_draft

logger = logging.getLogger(__name__)
ALLOWED_ORIGINS = [f'http://{host}:{port}' for host in ('localhost', '127.0.0.1') for port in (3000, 3001, 8000)]
PUBLIC_PREVIEW_READ_ONLY_DETAIL = (
    'Website analysis and manual research are disabled in this public preview. Use an authenticated SaaS workspace for these features.'
)


def csv_safe(value) -> str:
    text = str(value if value is not None else '')
    # Spreadsheet formulas can start after spaces or control characters.
    if text.lstrip(' \t\r\n').startswith(('=', '+', '-', '@')) or text.startswith(('\t', '\r', '\n')):
        return "'" + text
    return text


class BodyLimitMiddleware:
    def __init__(self, app, limit=65536):
        self.app, self.limit = app, limit

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            return await self.app(scope, receive, send)
        # Buffer bounded JSON input before dispatch, covering absent/spoofed lengths.
        messages, size = [], 0
        while True:
            message = await receive()
            if message['type'] == 'http.disconnect':
                return
            size += len(message.get('body', b''))
            if size > self.limit:
                response = JSONResponse({'detail': 'Request body exceeds the 64 KB limit'}, status_code=413)
                return await response(scope, receive, send)
            messages.append(message)
            if not message.get('more_body', False):
                break
        async def bounded_receive():
            return messages.pop(0) if messages else await receive()
        await self.app(scope, bounded_receive, send)


def create_app(db_path: str | Path | None = None, *, testing: bool = False) -> FastAPI:
    configured_origin = preview_origin()
    public_access = os.environ.get('SIGNALFOUNDRY_PUBLIC_ACCESS') == 'true'
    allowed_origins = ALLOWED_ORIGINS + ([configured_origin] if configured_origin else [])
    app = FastAPI(title='SignalFoundry local demo', version='0.1.0',
                  description='Local demo only. No authentication. Never expose this service to a public network.')
    app.state.repository = Repository(db_path or os.environ.get('SIGNALFOUNDRY_DB_PATH') or Path(__file__).resolve().parents[1] / 'data' / 'signalfoundry.sqlite3')
    app.state.cost_ledger = CostLedger(app.state.repository)
    app.state.cost_ledger.recover_inflight()
    app.state.fetch_page = fetch_public_page
    app.state.decision_provider = RulesDecisionProvider()
    # Explicit opt-in is mandatory. Merely having unrelated credentials in the
    # environment never activates a paid provider. This branch is not used by tests.
    if not public_access and not testing and os.environ.get('DECISION_ENGINE', 'rules') == 'jev':
        from .jev import JevDecisionProvider
        app.state.decision_provider = JevDecisionProvider.from_environment()
    app.state.research_lock = threading.Lock()
    app.state.generate_customer_draft = generate_customer_draft
    app.add_middleware(BodyLimitMiddleware)
    app.add_middleware(CORSMiddleware, allow_origins=allowed_origins,
                       allow_methods=['GET', 'POST', 'PUT', 'PATCH'], allow_headers=['Content-Type'],
                       allow_credentials=False)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=['127.0.0.1', 'localhost'] + (['testserver'] if testing else []))

    @app.middleware('http')
    async def security_headers(request: Request, call_next):
        origin = request.headers.get('origin')
        if origin and origin not in allowed_origins:
            return JSONResponse({'detail': 'Only the configured workspace browser may access this API'}, status_code=403)
        if request.method in ('POST', 'PUT', 'PATCH') and request.headers.get('content-type', '').split(';')[0].lower() != 'application/json':
            return JSONResponse({'detail': 'Mutations require application/json'}, status_code=415)
        response = await call_next(request)
        # Host middleware returns plain text by default; keep the documented error shape.
        if response.status_code == 400 and request.headers.get('host', '').split(':')[0] not in ('localhost', '127.0.0.1', 'testserver' if testing else ''):
            response = JSONResponse({'detail': 'Invalid local demo host'}, status_code=400)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Referrer-Policy'] = 'no-referrer'
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Frame-Options'] = 'DENY'
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, error: RequestValidationError):
        details = '; '.join(f"{'.'.join(str(x) for x in item['loc'] if x != 'body') or 'body'}: {item['msg']}" for item in error.errors()[:5])
        return JSONResponse({'detail': details}, status_code=422)

    @app.exception_handler(FetchError)
    async def fetch_error(request: Request, error: FetchError):
        return JSONResponse({'detail': str(error)}, status_code=422)

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, error: Exception):
        logger.error('Unexpected API failure', exc_info=error)
        return JSONResponse({'detail': 'The local service could not complete this operation. Existing data was preserved; please retry.'}, status_code=503)

    def repository() -> Repository:
        return app.state.repository

    def get_campaign(campaign_id: str) -> Campaign:
        result = repository().campaign(campaign_id)
        if not result:
            raise HTTPException(404, 'Campaign not found')
        return result

    def get_account(account_id: str) -> Account:
        result = repository().account(account_id)
        if not result:
            raise HTTPException(404, 'Account not found')
        return result

    @app.get('/api/health')
    def health():
        return {'status': 'ok', 'mode': ('public-preview' if os.environ.get('SIGNALFOUNDRY_PUBLIC_ACCESS') == 'true' else 'protected-preview') if configured_origin else 'local-demo', 'decision_engine': app.state.decision_provider.name,
                'providers': {'discovery': 'demo', 'contacts': 'not_configured'}}

    @app.get('/api/workspace', response_model=Workspace)
    def workspace():
        return repository().workspace()

    @app.get('/api/customers/engine')
    def customer_engine():
        state = engine_status()
        state['monetary'] = ({'status': 'blocked', 'historical_usage_known': False, 'detail': 'Hosted paid admission is unavailable.'}
                             if configured_origin or public_access else app.state.cost_ledger.status(repository().tenant_id))
        if configured_origin:
            state['discovery'].update(status='unavailable', detail='Customer discovery requires an authenticated workspace on hosted deployments.')
        return state

    @app.get('/api/cost/status')
    def cost_status():
        if configured_origin or public_access:
            raise HTTPException(403, PUBLIC_PREVIEW_READ_ONLY_DETAIL)
        return app.state.cost_ledger.status(repository().tenant_id)

    @app.post('/api/customers/search', response_model=CustomerSearch)
    def customer_search_start(body: CustomerSearchRequest):
        if configured_origin:
            raise HTTPException(403, PUBLIC_PREVIEW_READ_ONLY_DETAIL)
        if engine_status()['discovery']['status'] != 'ready':
            raise HTTPException(503, 'Customer discovery is not connected yet.')
        workspace = repository().workspace()
        if workspace.profile is None:
            raise HTTPException(422, 'Save your business profile before finding customers.')
        try:
            search, created = repository().create_customer_search(body.idempotency_key, body.target)
        except ValueError as exc:
            raise HTTPException(429, str(exc)) from None
        if created:
            request = DiscoveryRequest(profile=workspace.profile, website=workspace.website, search_id=search.id,
                                       target=body.target, geography=body.geography, limit=body.limit)
            def execute():
                try:
                    search.status, search.stage, search.updated_at = 'running', 'Finding businesses and checking public facts', now()
                    repository().save_customer_search(search)
                    result = discover_customers(request, fetch_page=app.state.fetch_page,
                        cost=CostContext(app.state.cost_ledger, repository().tenant_id, 'search:' + search.id))
                    search.accounts, search.errors, search.query = result.accounts, result.errors, result.query
                    search.status = ('partial' if result.accounts else 'failed') if result.errors else 'complete'
                    search.stage = 'Search finished'
                except ProviderError as exc:
                    search.status, search.stage, search.errors = 'failed', 'Search could not finish', [str(exc)]
                except Exception:
                    search.status, search.stage, search.errors = 'failed', 'Search could not finish', ['Customer research could not complete. No automatic retry was made.']
                finally:
                    search.updated_at = now()
                    repository().save_customer_search(search)
            threading.Thread(target=execute, daemon=True, name='customer-search').start()
        return search

    @app.get('/api/customers/searches/{search_id}', response_model=CustomerSearch)
    def customer_search_get(search_id: str):
        search = repository().customer_search(search_id)
        if search is None:
            raise HTTPException(404, 'Customer search not found')
        from datetime import datetime, timezone
        if search.status in ('queued', 'running') and (datetime.now(timezone.utc) - datetime.fromisoformat(search.created_at.replace('Z', '+00:00'))).total_seconds() > 180:
            search.status, search.stage = 'failed', 'Search interrupted'
            search.errors = ['Search was interrupted or timed out. Start a new search when ready; no automatic retry was made.']
            search.updated_at = now()
            repository().save_customer_search(search)
        return search

    @app.post('/api/workspace/analyze', response_model=Workspace)
    def analyze(body: AnalyzeRequest):
        if public_access:
            raise HTTPException(403, PUBLIC_PREVIEW_READ_ONLY_DETAIL)
        # Nothing persists unless both safe fetching and profile validation succeed.
        page = app.state.fetch_page(normalize_url(body.website))
        try:
            profile = infer_profile(page)
        except ValueError as exc:
            raise HTTPException(422, 'The website content could not produce a readable draft profile. Try another public page or edit your ICP manually.') from exc
        return repository().save_profile(profile, page.url, set_website=True)

    @app.post('/api/customers/searches/{search_id}/accounts/{account_id}/draft', response_model=CustomerDraft)
    def customer_draft(search_id: str, account_id: str, body: DraftRequest):
        if configured_origin or public_access:
            raise HTTPException(403, PUBLIC_PREVIEW_READ_ONLY_DETAIL)
        search = repository().customer_search(search_id)
        account = next((a for a in search.accounts if a.id == account_id), None) if search else None
        if not search or not account:
            raise HTTPException(404, 'Customer not found in this search')
        if search.status not in ('complete', 'partial'):
            raise HTTPException(409, 'Wait for customer research to finish before drafting.')
        profile = repository().workspace().profile
        if profile is None:
            raise HTTPException(422, 'Save your business profile before drafting a message.')
        try:
            key = draft_cache_key(profile, account)
            cached = repository().reserve_customer_draft(key, body.idempotency_key, allow_new=draft_status()['status'] == 'ready')
            if cached:
                return cached
        except DraftTerminalError as exc:
            return JSONResponse({'detail': str(exc), 'code': 'DRAFT_FAILED'}, status_code=503)
        except DraftError as exc:
            raise HTTPException(409, str(exc)) from None
        try:
            draft = app.state.generate_customer_draft(DraftInput(profile=profile, account=account),
                cost=CostContext(app.state.cost_ledger, repository().tenant_id, 'intro:' + body.idempotency_key))
        except DraftCostDenied as error:
            repository().finish_customer_draft(key, body.idempotency_key)
            return JSONResponse({'detail': str(error), 'code': 'COST_BLOCKED'}, status_code=503)
        except Exception:
            repository().finish_customer_draft(key, body.idempotency_key)
            # Never log/stringify the model, provider, prompt or credential error.
            return JSONResponse({'detail': 'AI drafting could not finish safely. No automatic retry was made.', 'code': 'DRAFT_FAILED'}, status_code=503)
        if not repository().finish_customer_draft(key, body.idempotency_key, draft):
            return JSONResponse({'detail': 'This draft attempt was interrupted. Choose Try draft again when ready.', 'code': 'DRAFT_FAILED'}, status_code=503)
        return draft

    @app.put('/api/workspace/profile', response_model=Workspace)
    def save_profile(body: Profile):
        return repository().save_profile(body)

    @app.post('/api/demo/reset', response_model=Workspace)
    def load_demo(body: EmptyRequest):
        if configured_origin:
            raise HTTPException(410, "Fictional data is disabled on deployed previews")
        return repository().save_profile(DEMO_PROFILE, 'https://signalfoundry.example/', set_website=True)

    @app.get('/api/campaigns', response_model=list[Campaign])
    def campaigns():
        return repository().campaigns()

    @app.post('/api/campaigns', response_model=Campaign, status_code=201)
    def create_campaign(body: CampaignCreate):
        if configured_origin and body.mode == "demo":
            raise HTTPException(410, "Fictional campaigns are disabled on deployed previews")
        domains = list(dict.fromkeys(normalize_url(domain) for domain in body.domains))
        try:
            return repository().create_campaign(body.name, body.mode, domains)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc

    @app.get('/api/campaigns/{campaign_id}', response_model=Campaign)
    def campaign(campaign_id: str):
        return get_campaign(campaign_id)

    @app.post('/api/campaigns/{campaign_id}/research', response_model=Campaign)
    def research(campaign_id: str, body: EmptyRequest):
        if public_access:
            raise HTTPException(403, PUBLIC_PREVIEW_READ_ONLY_DETAIL)
        campaign = get_campaign(campaign_id)
        if configured_origin and campaign.mode == "demo":
            raise HTTPException(410, "Fictional research is disabled on deployed previews")
        profile = repository().workspace().profile
        if profile is None:
            raise HTTPException(422, 'Analyze a website, save an ICP profile, or load the fictional demo first')
        if not app.state.research_lock.acquire(blocking=False):
            raise HTTPException(409, 'Research is already running. Wait for it to finish before retrying')
        try:
            accounts, errors = [], []
            if campaign.mode == 'demo':
                accounts = demo_accounts(profile, campaign.id)
            else:
                for domain in campaign.domains:
                    try:
                        page = app.state.fetch_page(domain)
                        account = app.state.decision_provider.evaluate(profile, page, campaign_id=campaign.id)
                        # Use the supplied canonical host for stable reruns even when
                        # a site redirects between www or another public hostname.
                        account.domain = urlsplit(domain).hostname
                        accounts.append(account)
                    except FetchError as exc:
                        errors.append(f'{urlsplit(domain).hostname}: {exc}')
                    except Exception:
                        logger.exception('Research adapter failed for a public domain')
                        errors.append(f'{urlsplit(domain).hostname}: Research could not finish. Previous results were preserved; try again.')
            return repository().save_research(campaign.id, accounts, errors)
        finally:
            app.state.research_lock.release()

    @app.get('/api/campaigns/{campaign_id}/accounts', response_model=list[Account])
    def accounts(campaign_id: str):
        get_campaign(campaign_id)
        return repository().accounts(campaign_id)

    @app.get('/api/accounts/{account_id}', response_model=Account)
    def account(account_id: str):
        return get_account(account_id)

    @app.patch('/api/accounts/{account_id}', response_model=Account)
    def patch_account(account_id: str, body: AccountStatus):
        result = repository().set_account_status(account_id, body.status)
        if result is None:
            raise HTTPException(404, 'Account not found')
        return result

    @app.post('/api/accounts/{account_id}/draft', response_model=Draft)
    def draft(account_id: str, body: EmptyRequest):
        account = get_account(account_id)
        profile = repository().workspace().profile
        if profile is None:
            raise HTTPException(422, 'Save a workspace profile before generating a draft')
        return make_draft(account, profile)

    @app.get('/api/campaigns/{campaign_id}/export.csv')
    def export(campaign_id: str):
        get_campaign(campaign_id)
        output = io.StringIO(newline='')
        writer = csv.writer(output)
        writer.writerow(['name', 'domain', 'score', 'confidence', 'status', 'industry', 'employee_range',
                         'location', 'description', 'why_fit', 'why_now', 'unknowns', 'evidence_urls',
                         'researched_at', 'decision_engine', 'is_demo'])
        for account in repository().accounts(campaign_id):
            writer.writerow([csv_safe(value) for value in [
                account.name, account.domain, account.score, account.confidence, account.status,
                account.industry, account.employee_range, account.location, account.description,
                ' | '.join(account.why_fit), ' | '.join(account.why_now), ' | '.join(account.unknowns),
                ' | '.join(dict.fromkeys(e.url for e in account.evidence)), account.researched_at,
                account.decision_engine, str(account.is_demo).lower(),
            ]])
        return Response(output.getvalue(), media_type='text/csv',
                        headers={'Content-Disposition': f'attachment; filename="signalfoundry-{campaign_id}.csv"'})

    from .outreach import outreach_router
    app.include_router(outreach_router(repository, blocked_preview=bool(configured_origin or public_access)))
    return app


app = create_app()
