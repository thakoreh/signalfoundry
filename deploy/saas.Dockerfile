# SaaS frontend only. Convex is external; Python research uses worker.Dockerfile.
FROM node:24-bookworm-slim AS build
WORKDIR /build/frontend
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG APP_URL
ENV NEXT_TELEMETRY_DISABLED=1 SIGNALFOUNDRY_MODE=saas NEXT_PUBLIC_SIGNALFOUNDRY_MODE=saas
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY APP_URL=$APP_URL
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:24-bookworm-slim AS runtime
# Coolify may replace Docker HEALTHCHECK with its curl/wget HTTP probe.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 \
    SIGNALFOUNDRY_MODE=saas NEXT_PUBLIC_SIGNALFOUNDRY_MODE=saas
WORKDIR /app
COPY --from=build --chown=10001:10001 /build/frontend/.next/standalone/ ./
COPY --from=build --chown=10001:10001 /build/frontend/.next/static/ ./.next/static/
USER 10001:10001
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:3000/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]
