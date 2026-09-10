/**
 * ZYRA — Logging Interceptor (Phase 0.11)
 *
 * Intercepts every HTTP request and logs:
 *   method, url, status code, response time, tenantId, userId, requestId
 *
 * Catches unhandled exceptions and records them before re-throwing
 * so NestJS's global exception filter still handles the response.
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger as NestLogger,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { ZyraLogger, createLogger, type LogContext } from '@zyra/config';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger: typeof ZyraLogger;

  constructor() {
    this.logger = createLogger(LoggingInterceptor.name);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    const start = performance.now();
    const method = request.method;
    const url = request.url;
    const userAgent = request.get('user-agent') ?? undefined;
    const ip = request.ip ?? request.connection.remoteAddress;

    // Tenant / user from request (set by TenantMiddleware / JWT guard)
    const tenantId = (request as unknown as { tenantId?: string }).tenantId
      ?? (request as unknown as { tenant?: { id?: string } }).tenant?.id;
    const userId = (request as unknown as { user?: { id?: string } }).user?.id;

    // requestId: prefer explicit header, else generate one
    const requestId = request.get('x-request-id') ?? crypto.randomUUID();

    const logContext: LogContext = {
      requestId,
      method,
      url,
      ip,
      userAgent,
    };

    if (tenantId) logContext.tenantId = tenantId;
    if (userId) logContext.userId = userId;

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Math.round(performance.now() - start);
          const status = response.statusCode;

          this.logger.info(
            `[HTTP] ${method} ${url} ${status} ${durationMs}ms`,
            { ...logContext, status, durationMs },
          );
        },
        error: (err: unknown) => {
          const durationMs = Math.round(performance.now() - start);
          const status = err instanceof BadRequestException
            ? err.getStatus()
            : err instanceof Error
              ? 'error'
              : 'unknown';

          this.logger.error(
            `[HTTP] ${method} ${url} ${status} ${durationMs}ms — unhandled error`,
            err instanceof Error ? err : undefined,
            { ...logContext, status, durationMs },
          );
        },
      }),
    );
  }
}
