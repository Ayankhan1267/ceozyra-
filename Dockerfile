# Multi-stage build for all services
FROM node:22-slim AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/
COPY packages/events/package.json ./packages/events/
COPY packages/security/package.json ./packages/security/
COPY packages/analytics/package.json ./packages/analytics/
COPY packages/auth/package.json ./packages/auth/
COPY packages/database/package.json ./packages/database/
COPY packages/integrations/package.json ./packages/integrations/
COPY packages/ui/package.json ./packages/ui/
COPY apps/web/package.json ./apps/web/
COPY apps/admin/package.json ./apps/admin/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile=false

FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/.pnpm-store ./.pnpm-store
COPY . .
RUN pnpm turbo run build --filter=...web --filter=...admin --filter=...api

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/web/.next/standalone ./apps/web
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
