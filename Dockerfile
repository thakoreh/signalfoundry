# No credentials or runtime databases are copied into the image.
FROM node:24-bookworm-slim AS frontend-build
WORKDIR /build/frontend
ENV NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=768
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim-bookworm AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production \
    NODE_OPTIONS=--max-old-space-size=256 \
    SIGNALFOUNDRY_DB_PATH=/app/data/signalfoundry.sqlite3 \
    DECISION_ENGINE=rules
RUN apt-get update && apt-get install -y --no-install-recommends nginx ca-certificates bash libstdc++6 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 app && useradd --uid 10001 --gid app --no-create-home app
COPY --from=frontend-build /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
COPY backend/requirements.lock.txt /app/backend/requirements.lock.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.lock.txt
COPY backend/app/ /app/backend/app/
COPY --from=frontend-build /build/frontend/.next/standalone/ /app/frontend/
COPY --from=frontend-build /build/frontend/.next/static/ /app/frontend/.next/static/
COPY deploy/ /app/deploy/
RUN mkdir -p /app/data /app/frontend/.next/cache && chown -R app:app /app/data /app/frontend/.next/cache
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 CMD ["python", "/app/deploy/healthcheck.py"]
ENTRYPOINT ["bash", "/app/deploy/start.sh"]
