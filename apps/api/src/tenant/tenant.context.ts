/**
 * ZYRA — Tenant Context
 * AsyncLocalStorage-based tenant context that flows through the request lifecycle.
 */

import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Request, Response, NextFunction } from 'express';

export interface TenantContext {
  tenantId: string | null;
  userId: string | null;
}

export const TENANT_CONTEXT = new AsyncLocalStorage<TenantContext>();

@Injectable()
export class TenantContextMiddleware {
  use(req: any, _res: Response, next: NextFunction) {
    const tenantId = req.tenant?.id ?? null;
    const userId = req.user?.sub ?? null;
    TENANT_CONTEXT.run({ tenantId, userId }, () => next());
  }
}

/**
 * Helper: register tenant context middleware on the NestJS app.
 */
export function registerTenantContextMiddleware(app: any): void {
  const middleware = (req: any, res: Response, next: NextFunction) => {
    new TenantContextMiddleware().use(req, res, next);
  };
  app.use(middleware);
}

export function getCurrentTenantId(): string | null {
  return TENANT_CONTEXT.getStore()?.tenantId ?? null;
}

export function getCurrentUserId(): string | null {
  return TENANT_CONTEXT.getStore()?.userId ?? null;
}
