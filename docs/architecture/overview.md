# ZYRA Architecture Overview

ZYRA is an AI-powered business operating system monorepo using **pnpm workspaces + Turborepo**. It contains 4 applications and 11 shared packages.

## Monorepo Layout

```
apps/
  api/     NestJS backend (TypeScript, Prisma, PostgreSQL)
  web/     Next.js customer-facing app + storefronts
  admin/   Next.js super-admin panel
  ai/      Python FastAPI AI gateway (Ollama / OpenAI-compatible)

packages/
  ai-client/      AI service client
  analytics/      Analytics utilities
  auth/           Authentication utilities
  config/         Shared config + env validation
  database/       Prisma schema + migrations + client
  events/         Event definitions + emitter
  integrations/   Provider adapters (payments, comms, etc.)
  security/       Password hashing, sanitization, crypto utilities
  types/          Shared TypeScript types
  ui/             Shared UI components (shadcn/ui based)
```

The root `pnpm-workspace.yaml` includes `apps/*` and `packages/*`.

## Technology Stack

- **Frontend:** Next.js 14 + React 18 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** NestJS 10 + TypeScript + Prisma + PostgreSQL
- **AI Service:** Python + FastAPI + LangGraph + Ollama
- **Queue/Cache:** Redis + BullMQ
- **Storage:** S3-compatible
- **Password hashing:** Node `crypto` (scrypt)

## Services & Ports

| Service | Port | PM2 process | Tech |
|---------|------|-------------|------|
| API | `4020` | `zyra-api` | NestJS |
| AI | `8020` | `zyra-ai` | FastAPI |
| Web | `3020` | `zyra-web` | Next.js |
| Admin | `3024` | `zyra-admin` | Next.js |
| Redis | `6379` | — | Redis |
| PostgreSQL | `5432` | — | PostgreSQL |
| Ollama | `11434` | — | Ollama (if installed) |

Dev-mode ports differ: web `3010`, admin `3014`, AI `8000`, API reads `PORT`/`API_PORT` (default `4000`).

## How Services Talk

- **Web/Admin** (Next.js) call the **API** over HTTP for all business data; auth via JWT.
- **API** (NestJS) owns business logic, Prisma/PostgreSQL access, and Redis. It exposes REST controllers grouped by module (see `docs/api/endpoints.md`).
- **AI** (FastAPI) is a separate gateway. It reads the PostgreSQL DB directly (BI layer) and serves chat/embeddings/models and ZYRA Agents. Loads `.env` at `/var/www/zyra/.env`.
- **Ollama** serves local LLM inference; the AI service points at `OLLAMA_URL` (default `http://localhost:11434`).
- **Redis** provides caching, queues (BullMQ), and rate limiting.

## Configuration

Environment files live at the repo root:

- `.env` — base config (loaded by API and AI)
- `.env.production` — production overrides
- `.env.qa` — QA overrides
- `.env.example` — documented template

`apps/api/src/main.ts` loads `.env` then overrides with the APP_ENV/NODE_ENV-specific file. The AI `main.py` loads `.env` and `.env.production`. Env vars are validated at boot by `@zyra/config` (see `packages/config/src/env.validation.ts`).

## Deployment

Production deploys via **PM2** using `ecosystem.config.js` (4 processes: `zyra-api` ×2 cluster, `zyra-web`, `zyra-admin`, `zyra-ai`). Logs go to `logs/*.log`. See `docs/guides/development.md`.
