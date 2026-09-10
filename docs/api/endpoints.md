# ZYRA API Endpoints

Base URL: `https://api.ceozyra.com` (prod) / `http://localhost:4020` (pm2) / `PORT` or `API_PORT` env (dev, default `4000`).

All routes below are from `apps/api/src/**/*.controller.ts`. Guard key: **A** = `AuthGuard` (JWT), **R** = `RolesGuard`. Routes marked "public" have no `@UseGuards`.

## Health

| Method | Route          | Guard | Notes                                     |
|--------|----------------|-------|-------------------------------------------|
| GET    | `/health`      | —     | Liveness probe (no DB/Redis hit)          |
| GET    | `/health/deep` | —     | Readiness (DB, Redis, disk, memory)       |

## Auth — `apps/api/src/auth`

| Method | Route                     | Guard | Notes                          |
|--------|---------------------------|-------|--------------------------------|
| POST   | `/auth/register`          | —     | Public                         |
| POST   | `/auth/login`             | —     | Public                         |
| POST   | `/auth/refresh`           | A     | Refresh access token           |
| GET    | `/auth/me`                | A     | Current user profile           |
| PATCH  | `/auth/change-password`   | A     | Requires `oldPassword`/`newPassword` |

### OAuth — `apps/api/src/auth/oauth`

| Method | Route                     | Guard | Notes                            |
|--------|---------------------------|-------|----------------------------------|
| GET    | `/auth/google`            | OAuth | PassportAuthGuard('google')      |
| GET    | `/auth/google/callback`   | OAuth | PassportAuthGuard('google')      |
| GET    | `/auth/github`            | OAuth | PassportAuthGuard('github')      |
| GET    | `/auth/github/callback`   | OAuth | PassportAuthGuard('github')      |
| POST   | `/auth/email/otp`         | —     | Public                           |
| POST   | `/auth/email/verify`      | —     | Public                           |

## Tenant — `apps/api/src/tenant`

| Method | Route          | Guard | Roles                          | Notes                  |
|--------|----------------|-------|--------------------------------|------------------------|
| GET    | `/tenants`     | A+R   | OWNER, ADMIN, SUPER_ADMIN      | Paginated list         |
| GET    | `/tenants/:id` | —     |                                | Public                 |
| POST   | `/tenants`     | A+R   | OWNER, ADMIN, SUPER_ADMIN      | Create tenant          |
| PUT    | `/tenants/:id` | A+R   | OWNER, ADMIN, SUPER_ADMIN      | Update tenant          |

## Users — `apps/api/src/user`

| Method  | Route           | Guard | Roles                          | Notes        |
|---------|-----------------|-------|--------------------------------|--------------|
| GET     | `/users/:id`    | —     |                                | Public       |
| GET     | `/users`        | A+R   | OWNER, ADMIN, SUPER_ADMIN      | By tenant    |
| POST    | `/users`        | A+R   | OWNER, ADMIN, SUPER_ADMIN      | Create user  |
| PATCH   | `/users/:id`    | A+R   | OWNER, ADMIN, SUPER_ADMIN      | Update user  |
| PATCH   | `/users/:id/role` | A+R | OWNER, ADMIN, SUPER_ADMIN      | Change role  |
| DELETE  | `/users/:id`    | A+R   | OWNER, SUPER_ADMIN            | Delete user  |

## Storefronts — `apps/api/src/storefront`

| Method | Route                | Guard | Roles                          | Notes            |
|--------|----------------------|-------|--------------------------------|------------------|
| GET    | `/storefronts/slug/:slug` | — |                            | Public (storefront data) |
| GET    | `/storefronts`       | A+R   | OWNER, ADMIN, SUPER_ADMIN      | By tenant        |
| GET    | `/storefronts/:id`   | —     |                                | Public           |
| POST   | `/storefronts`       | A+R   | OWNER, ADMIN                   | Create           |
| PATCH  | `/storefronts/:id`   | A+R   | OWNER, ADMIN                   | Update           |
| DELETE | `/storefronts/:id`   | A+R   | OWNER, ADMIN                   | Delete           |

## Products — `apps/api/src/product`

| Method | Route                          | Guard | Roles                          | Notes              |
|--------|--------------------------------|-------|--------------------------------|--------------------|
| GET    | `/products/storefront/:id`     | —     |                                | Public, paginated  |
| GET    | `/products`                    | A+R   | OWNER, ADMIN, MANAGER, EMPLOYEE | By tenant          |
| GET    | `/products/search`             | —     |                                | Public             |
| GET    | `/products/:id`                | —     |                                | Public             |
| POST   | `/products`                    | A+R   | OWNER, ADMIN, MANAGER          | Create             |
| PATCH  | `/products/:id`                | A+R   | OWNER, ADMIN, MANAGER          | Update             |
| DELETE | `/products/:id`                | A+R   | OWNER, ADMIN                   | Delete             |

## Orders — `apps/api/src/order`

| Method | Route                       | Guard | Notes                          |
|--------|-----------------------------|-------|--------------------------------|
| GET    | `/orders/tenant/:tenantId`  | A+R   | Paginated                      |
| GET    | `/orders/:id`               | —     | Public                         |
| GET    | `/orders/customer/:customerId` | —  | Public                         |
| POST   | `/orders`                   | —     | Public (create)                |
| PATCH  | `/orders/:id/status`        | A+R   | Update status                  |
| GET    | `/orders/tenant/:tenantId/stats` | A+R | Stats for tenant             |

## Customers — `apps/api/src/customer`

| Method | Route                  | Guard | Notes                          |
|--------|------------------------|-------|--------------------------------|
| GET    | `/customers/tenant/:tenantId` | A+R | Paginated                |
| GET    | `/customers/:id`       | —     | Public                         |
| GET    | `/customers/:id/360`   | —     | Public (360° customer view)    |
| POST   | `/customers`           | A+R   | Create                         |
| PATCH  | `/customers/:id`       | A+R   | Update                         |
| DELETE | `/customers/:id`       | A+R   | Delete                         |

## Commissions — `apps/api/src/commission` (all A+R)

| Method | Route                            | Notes               |
|--------|----------------------------------|---------------------|
| GET    | `/commissions/partner/:partnerId` | Paginated           |
| GET    | `/commissions/head/:headId`       | Paginated           |
| GET    | `/commissions/tenant/:tenantId`   | Paginated           |
| POST   | `/commissions/calculate`          | Compute partner/head split |
| PATCH  | `/commissions/:id/approve`        | Approve             |
| PATCH  | `/commissions/:id/pay`            | Mark paid           |
| PATCH  | `/commissions/:id/reject`         | Reject              |

## Agents — `apps/api/src/agent`

| Method | Route                          | Guard | Notes                |
|--------|--------------------------------|-------|----------------------|
| GET    | `/agents/runs/tenant/:tenantId` | A+R  | Paginated            |
| GET    | `/agents/runs/:id`             | —     | Public               |
| POST   | `/agents/runs`                 | A+R   | Create run           |
| PATCH  | `/agents/runs/:id/status`      | A+R   | Update run status    |
| GET    | `/agents/list/tenant/:tenantId` | A+R  | List agents          |
| GET    | `/agents/dashboard/tenant/:tenantId` | A+R | Dashboard data |

## Analytics — `apps/api/src/analytics` (all A+R)

| Method | Route                              | Notes           |
|--------|------------------------------------|-----------------|
| GET    | `/analytics/revenue/tenant/:tenantId` | Revenue over time (optional `startDate`/`endDate`) |
| GET    | `/analytics/kpis/tenant/:tenantId` | KPI dashboard   |

## Communication — `apps/api/src/communication` (all A+R)

| Method | Route                            | Notes             |
|--------|----------------------------------|-------------------|
| POST   | `/communication/email`           | Send email        |
| POST   | `/communication/whatsapp`        | Send WhatsApp     |
| POST   | `/communication/sms`             | Send SMS          |
| POST   | `/communication/email/bulk`      | Bulk email        |
| POST   | `/communication/whatsapp/bulk`   | Bulk WhatsApp     |

## Finance — `apps/api/src/finance` (all A+R)

| Method | Route                              | Notes                 |
|--------|------------------------------------|-----------------------|
| GET    | `/finance/pnl/tenant/:tenantId`    | P&L report (optional date range) |
| GET    | `/finance/metrics/tenant/:tenantId`| Financial metrics     |

## Email — `apps/api/src/email` (all A+R)

| Method | Route                  | Notes                                |
|--------|------------------------|--------------------------------------|
| POST   | `/email/send`          | Send a custom email                  |
| POST   | `/email/send-template` | Send from a named template           |
| GET    | `/email/templates`     | List available templates             |
| GET    | `/email/health`        | Verify SMTP connection               |

## Global prefixes & middleware

- `TenantMiddleware` runs on `*` and populates tenant context (see `apps/api/src/tenant/tenant.context.ts`).
- Global `ValidationPipe` (whitelist + transform), logging interceptor, and exception filter in `apps/api/src/main.ts`.
- API docs/swagger are not enabled; the OpenAPI endpoints are available on the **AI** service at `/docs` (`http://localhost:8020/docs`).