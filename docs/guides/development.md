# ZYRA Development Guide

## Prerequisites

- Node.js ≥ 20 (Node 22 used in CI), pnpm ≥ 9 (repo pins `pnpm@11.3.0`)
- PostgreSQL, Redis
- Ollama (optional, for local AI inference)
- PM2 for production deploys

## Install Dependencies

```bash
pnpm install
```

The repo is a pnpm monorepo (`pnpm-workspace.yaml` includes `apps/*` and `packages/*`) orchestrated by Turborepo (`turbo.json`).

## Environment Files

Env files live at the repo root (not committed to Git):

| File | Purpose |
|------|---------|
| `.env` | Base config — loaded by API (`apps/api/src/main.ts`) and AI (`apps/ai/src/main.py`) |
| `.env.production` | Production overrides (loaded when `APP_ENV=production`) |
| `.env.qa` | QA overrides (loaded when `APP_ENV=qa`) |
| `.env.example` | Documented template — copy to `.env` and fill in real values |

Copy the template and generate secrets:

```bash
cp .env.example .env
bash scripts/generate-secrets.sh
```

Env vars are validated at API boot by `@zyra/config` (`packages/config/src/env.validation.ts`); the process exits if critical vars (e.g. `DATABASE_URL`, `JWT_SECRET`) are missing or placeholders.

## Database

```bash
pnpm --filter @zyra/database run db:generate   # generate Prisma client (needed before builds)
pnpm --filter @zyra/database run db:migrate     # migrate dev (prisma migrate dev)
pnpm --filter @zyra/database run db:deploy      # apply migrations (prod)
pnpm --filter @zyra/database run db:seed        # seed
```

## Run in Development

Start all apps/packages via turbo:

```bash
pnpm dev            # turbo run dev
# or
bash scripts/dev.sh
```

Per-app dev scripts (from `apps/*/package.json`):

| App | Dev script | Dev port |
|-----|-----------|----------|
| API (`@zyra/api`) | `pnpm --filter @zyra/api dev` (`nest start --watch`) | `API_PORT`/`PORT` (default 4000) |
| Web (`@zyra/web`) | `pnpm --filter @zyra/web dev` (`next dev`) | 3010 |
| Admin (`@zyra/admin`) | `pnpm --filter @zyra/admin dev` (`next dev`) | 3014 |
| AI (`@zyra/ai`) | `cd apps/ai && source .venv/bin/activate && uvicorn main:app --port 8000 --reload --app-dir src` | 8000 |

## Build

```bash
pnpm build          # turbo run build (all apps + packages)
```

Prisma client generation is part of `@zyra/database`'s `build` script (`prisma generate && tsc`). To regenerate without a full build: `pnpm --filter @zyra/database run db:generate`.

## Test & Lint

```bash
pnpm exec vitest run            # unit tests in tests/ (fast, no DB/network)
pnpm test                       # turbo run test — requires upstream builds first
pnpm typecheck                  # turbo run typecheck
pnpm lint                       # turbo run lint
```

Unit tests live in `tests/unit/*.test.ts` and are picked up by `vitest.config.ts` (`include: ['tests/**/*.test.ts']`). They are self-contained (no DB, no network).

## Run Smoke Tests

```bash
bash scripts/smoke-test.sh
```

Checks API (`:4020/health`), AI (`:8020/health`), Web (`:3020`), Admin (`:3024`), Redis PONG, PostgreSQL `SELECT 1`, and Ollama (if installed). Exits 0 only if all checks pass.

## Deploy (Production)

Production runs under PM2 using `ecosystem.config.js` at the repo root:

```bash
pnpm install
pnpm build
pm2 start ecosystem.config.js    # or: pm2 start ecosystem.config.js && pm2 save
pm2 logs zyra-api                # tail logs (also in logs/*.log)
pm2 reload all                   # after rebuilding
```

PM2 processes and ports:

| Process name | Port | Notes |
|--------------|------|-------|
| `zyra-api` | 4020 | NestJS, cluster mode, 2 instances |
| `zyra-web` | 3020 | Next.js `next start` |
| `zyra-admin` | 3024 | Next.js `next start` |
| `zyra-ai` | 8020 | FastAPI via `apps/ai/.venv/bin/uvicorn`, 2 workers |

Logs: `logs/api-error.log`, `logs/api-out.log`, `logs/web-*.log`, `logs/admin-*.log`, `logs/ai-*.log`.

Per-service start helpers also exist at the repo root: `start-api.sh`, `start-web.sh`, `start-admin.sh`, `start-ai.sh`.

## Additional Scripts

```bash
bash scripts/setup.sh           # one-time machine setup
bash scripts/setup-ollama.sh    # install Ollama + pull models
bash scripts/seed.sh            # seed helper
bash scripts/generate-secrets.sh # generate JWT/DB secrets into .env
```