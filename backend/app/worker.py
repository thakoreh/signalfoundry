"""Authenticated, stateless research worker; Convex owns all SaaS persistence.

This module MUST NOT import app.main/app.store or expose the local-demo API.
Only an authorized server may call it. There are no retries or external side
effects other than bounded page reads and explicitly opted-in Jev requests.
"""
from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
import hashlib
import hmac
import logging
import threading
import time
from typing import Annotated, Literal
from urllib.parse import urlsplit
from uuid import uuid4

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import Field, StringConstraints, model_validator

from .models import Account, AnalyzeRequest, Profile, StrictModel, URLText
from .research import RulesDecisionProvider, demo_accounts, infer_profile
from .safety import FetchError, fetch_public_page, normalize_url
from .worker_config import WorkerSettings

logger = logging.getLogger('signalfoundry.worker')
# Uvicorn only configures its own loggers. Emit the redacted worker record too.
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter('%(message)s'))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)
logger.propagate = False
MAX_BODY = 65_536
MAX_BODY_SECONDS = 10.0
RESEARCH_DEADLINE_SECONDS = 105.0


class ResearchRequest(StrictModel):
    profile: Profile
    campaign_id: Annotated[str, StringConstraints(pattern=r'^[A-Za-z0-9_-]{1,128}$')]
    mode: Literal['demo', 'manual']
    domains: list[URLText] = Field(max_length=10)

    @model_validator(mode='after')
    def valid_domains(self):
        if (self.mode == 'manual' and not self.domains) or (self.mode == 'demo' and self.domains):
            raise ValueError('Manual research requires domains; demo research requires an empty domain list')
        return self


class ResearchResponse(StrictModel):
    accounts: list[Account] = Field(max_length=10)
    errors: list[str] = Field(max_length=20)


class AnalyzeResponse(StrictModel):
    profile: Profile
    website: str


class WorkerBoundary:
    """Authenticate before buffering; never log headers, URLs, bodies, or errors."""
    def __init__(self, app, settings: WorkerSettings):
        self.app, self.settings = app, settings
        self.slots = threading.BoundedSemaphore(settings.max_jobs)
        self.expected = hashlib.sha256(settings.token.encode()).digest()

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            return await self.app(scope, receive, send)
        request_id = uuid4().hex  # Do not reflect attacker-supplied log/request IDs.
        started = time.monotonic()
        status = 500
        acquired = False
        response_started = False
        path = scope.get('path', '')
        operation = {'/healthz': 'health', '/readyz': 'ready', '/worker/research': 'research', '/worker/analyze': 'analyze'}.get(path, 'unknown')

        async def response_send(message):
            nonlocal status, response_started
            if message['type'] == 'http.response.start':
                status = message['status']
                response_started = True
                message['headers'] = list(message.get('headers', [])) + [
                    (b'x-request-id', request_id.encode()), (b'cache-control', b'no-store'),
                    (b'x-content-type-options', b'nosniff'), (b'referrer-policy', b'no-referrer')]
            await send(message)

        async def reject(code, detail, headers=None):
            response = JSONResponse({'detail': detail}, status_code=code, headers=headers)
            await response(scope, receive, response_send)

        try:
            if operation in ('health', 'ready') and scope['method'] == 'GET':
                return await self.app(scope, receive, response_send)
            if operation == 'unknown':
                return await reject(404, 'Not found')
            if not self.settings.ready:
                return await reject(503, 'Worker is not configured')
            headers = scope.get('headers', [])
            auth = [v for k, v in headers if k.lower() == b'authorization']
            if len(auth) != 1 or len(auth[0]) > 512 or not auth[0].startswith(b'Bearer '):
                return await reject(401, 'Worker authorization required')
            supplied = hashlib.sha256(auth[0][7:]).digest()
            if not hmac.compare_digest(supplied, self.expected):
                return await reject(401, 'Worker authorization required')
            values = {k.lower(): v for k, v in headers}
            if b'origin' in values:
                return await reject(403, 'This endpoint accepts server-to-server requests only')
            origin = urlsplit(self.settings.origin)
            if values.get(b'host', b'').decode('latin-1').lower() != origin.netloc:
                return await reject(400, 'Invalid worker host')
            if scope.get('scheme') != origin.scheme:
                return await reject(426, 'Configured worker transport is required')
            if scope['method'] != 'POST':
                return await reject(405, 'Method not allowed')
            if values.get(b'content-type', b'').split(b';')[0].lower() != b'application/json':
                return await reject(415, 'Requests require application/json')
            if values.get(b'content-encoding', b'identity') not in (b'identity', b''):
                return await reject(415, 'Compressed request bodies are unsupported')
            content_lengths = [v for k, v in headers if k.lower() == b'content-length']
            if content_lengths:
                if len(content_lengths) != 1 or len(content_lengths[0]) > 6 or not content_lengths[0].isdigit():
                    return await reject(400, 'Invalid request length')
                if int(content_lengths[0]) > MAX_BODY:
                    return await reject(413, 'Request exceeds 64 KiB')
            if not self.slots.acquire(blocking=False):
                return await reject(429, 'Worker is at capacity; retry later', {'Retry-After': '5'})
            acquired = True
            body = bytearray()
            deadline = time.monotonic() + MAX_BODY_SECONDS
            while True:
                if time.monotonic() >= deadline:
                    return await reject(408, 'Request body deadline exceeded')
                try:
                    message = await asyncio.wait_for(receive(), timeout=max(0.001, deadline-time.monotonic()))
                except TimeoutError:
                    return await reject(408, 'Request body deadline exceeded')
                if message['type'] == 'http.disconnect':
                    return
                body.extend(message.get('body', b''))
                if len(body) > MAX_BODY:
                    return await reject(413, 'Request exceeds 64 KiB')
                if not message.get('more_body', False):
                    break
            if content_lengths and int(content_lengths[0]) != len(body):
                return await reject(400, 'Invalid request length')
            consumed = False
            async def bounded_receive():
                nonlocal consumed
                if not consumed:
                    consumed = True
                    return {'type': 'http.request', 'body': bytes(body), 'more_body': False}
                return await receive()
            await self.app(scope, bounded_receive, response_send)
        except Exception:
            # Never stringify provider errors, raw validation inputs, or traceback
            # locals. Callers correlate this safe failure using X-Request-ID.
            if not response_started:
                await reject(503, 'Worker could not complete this operation')
        finally:
            if acquired:
                self.slots.release()
            logger.info('worker_request request_id=%s operation=%s status=%d duration_ms=%d',
                        request_id, operation, status, int((time.monotonic()-started)*1000))


def create_worker() -> FastAPI:
    settings = WorkerSettings.from_environment()
    app = FastAPI(title='SignalFoundry stateless worker', version='1.0.0', docs_url=None,
                  redoc_url=None, openapi_url=None)
    app.state.settings = settings
    app.state.fetch_page = fetch_public_page
    app.state.decision_provider = RulesDecisionProvider()
    if settings.engine == 'jev':
        from .jev import JevDecisionProvider
        app.state.decision_provider = JevDecisionProvider.from_environment()
    app.add_middleware(WorkerBoundary, settings=settings)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(_, error):
        # Pydantic errors may include user input and attacker-controlled keys.
        return JSONResponse({'detail': 'Invalid worker request; check the documented fields and limits'}, status_code=422)

    @app.exception_handler(FetchError)
    async def fetch_error(_, error):
        return JSONResponse({'detail': str(error)}, status_code=422)

    @app.get('/healthz')
    async def health():
        return {'status': 'ok'}

    @app.get('/readyz')
    async def ready():
        usable = settings.ready
        return JSONResponse({'status': 'ready' if usable else 'not_ready'}, status_code=200 if usable else 503)

    @app.post('/worker/analyze', response_model=AnalyzeResponse)
    def analyze(body: AnalyzeRequest):
        page = app.state.fetch_page(normalize_url(body.website))
        return AnalyzeResponse(profile=infer_profile(page), website=page.url)

    @app.post('/worker/research', response_model=ResearchResponse)
    def research(body: ResearchRequest):
        if body.mode == 'demo':
            return ResearchResponse(accounts=demo_accounts(body.profile, body.campaign_id), errors=[])
        # Each domain gets one fetch (8s incl. DNS/redirects) and at most one Jev
        # call (8s). Four lanes finish ten domains in <=48s network budget.
        # Admission caps total work at two requests / eight domain lanes.
        deadline = time.monotonic() + RESEARCH_DEADLINE_SECONDS
        domains = list(dict.fromkeys(body.domains))
        def evaluate(raw):
            try:
                url = normalize_url(raw)
            except FetchError:
                return None, 'Invalid domain: use a public HTTP(S) business URL'
            label = urlsplit(url).hostname
            if time.monotonic() >= deadline - 16:
                return None, f'{label}: Research deadline reached; try again later'
            try:
                page = app.state.fetch_page(url)
                account = app.state.decision_provider.evaluate(body.profile, page, campaign_id=body.campaign_id)
                return account, None
            except FetchError as exc:
                return None, f'{label}: {exc}'
            except Exception:
                return None, f'{label}: Research could not complete safely; try again later'
        with ThreadPoolExecutor(max_workers=settings.parallel_domains, thread_name_prefix='research') as pool:
            results = list(pool.map(evaluate, domains))
        accounts = []
        seen = set()
        for account, _ in results:
            if account is not None and account.domain not in seen:
                accounts.append(account)
                seen.add(account.domain)
        return ResearchResponse(accounts=accounts, errors=[error for _, error in results if error])

    return app


app = create_worker()
