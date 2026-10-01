# Isolated SaaS worker. Build context is repository root, never the preview image.
FROM python:3.12-slim AS dependencies
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_NO_CACHE_DIR=1
COPY backend/requirements.lock.txt /tmp/requirements.lock.txt
RUN python -m venv /opt/venv && /opt/venv/bin/pip install -r /tmp/requirements.lock.txt

FROM python:3.12-slim AS runtime
ENV PATH="/opt/venv/bin:$PATH" PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 FORWARDED_ALLOW_IPS=""
WORKDIR /app
COPY --from=dependencies /opt/venv /opt/venv
# Explicit allowlist excludes SQLite repository, local API, tests, env, data.
COPY backend/app/__init__.py backend/app/worker.py backend/app/worker_config.py backend/app/primitives.py backend/app/models.py backend/app/fixtures.py backend/app/research.py backend/app/safety.py backend/app/jev.py /app/app/
COPY deploy/worker_healthcheck.py /app/worker_healthcheck.py
USER 10001:10001
EXPOSE 8001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["python", "/app/worker_healthcheck.py"]
# Default trusts no proxy headers. For a TLS proxy, use exact trusted proxy IPs
# through FORWARDED_ALLOW_IPS; NEVER use '*'. No query-string access logging.
CMD ["python", "-m", "uvicorn", "app.worker:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1", "--proxy-headers", "--no-access-log", "--limit-concurrency", "32", "--limit-max-requests", "10000", "--timeout-keep-alive", "5", "--timeout-graceful-shutdown", "115"]
