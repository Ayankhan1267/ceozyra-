# ZYRA — AI Business Operating System

## Tech Stack
- **Frontend:** Next.js + React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** NestJS + TypeScript + Prisma + PostgreSQL
- **AI Service:** Python + FastAPI + LangGraph
- **Cache:** Redis + BullMQ
- **Storage:** S3-compatible
- **CDN:** Cloudflare-compatible

## Quick Start

```bash
# Install dependencies
pnpm install

# Start all services (requires Docker)
pnpm docker:up

# Run database migrations
pnpm db:migrate

# Seed database
pnpm db:seed

# Start development
pnpm dev
```

## Project Structure
```
apps/
  web/     — Customer-facing app (app.ceozyra.com + storefronts)
  api/     — NestJS backend API (api.ceozyra.com)
  admin/   — Super admin panel (admin.ceozyra.com)
  ai/      — Python FastAPI AI service

packages/
  database/   — Prisma schema + migrations
  ui/         — Shared UI components (shadcn/ui based)
  types/      — Shared TypeScript types
  config/     — Shared configuration
  auth/       — Authentication utilities
  events/     — Event definitions + emitter
  integrations/ — Provider adapters (payments, comms, etc.)
  analytics/  — Analytics utilities
  security/   — Security utilities
```

## Domain Architecture
- `ceozyra.com` — Marketing site
- `app.ceozyra.com` — Customer dashboard
- `admin.ceozyra.com` — Super admin
- `api.ceozyra.com` — Backend API
- `*.ceozyra.com` — Customer storefronts

## Documentation
See `docs/` directory for detailed architecture docs.
