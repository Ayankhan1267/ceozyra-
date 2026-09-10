/**
 * ZYRA — Request ID Middleware (Phase 0.11)
 *
 * Responsibilities:
 *   1. Reads X-Request-ID from the incoming request header (if present).
 *   2. If absent, generates a new RFC-4122 v4 UUID and sets it on the response.
 *   3. Attaches the ID to the Express request object as requestId.
 *   4. Emits the ID as the X-Request-ID response header.
 *
 * This middleware must run BEFORE the tenant and auth middlewares so the
 * request ID is available for any downstream log or metric.
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ZyraLogger, setRequestId, clearRequestId } from '@zyra/config';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Prefer an incoming X-Request-ID header (propagates from upstream load-balancers / API gateway).
    const incoming = req.get('x-request-id');
    const requestId: string = incoming ?? crypto.randomUUID();

    // Attach to request object so interceptors and services can read it.
    (req as unknown as { requestId: string }).requestId = requestId;

    // Expose to the structured logger context for this request.
    setRequestId(requestId);

    // Guarantee the header on the response regardless of outcome.
    res.setHeader('X-Request-ID', requestId);

    // Clean up logger context when the response finishes (prevent cross-request leakage).
    res.on('finish', () => {
      clearRequestId();
    });

    next();
  }
}
