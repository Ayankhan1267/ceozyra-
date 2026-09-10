/**
 * ZYRA — HTTP Exception Filter (Phase 0.11)
 *
 * Global exception filter that converts all NestJS exceptions into a
 * consistent JSON response envelope:
 *
 *   {
 *     "statusCode": 404,
 *     "timestamp": "2026-01-15T12:00:00.000Z",
 *     "path": "/api/v1/orders/99",
 *     "method": "GET",
 *     "requestId": "abc-123",
 *     "error": "Not Found",
 *     "message": "Order not found"
 *   }
 *
 * All errors are logged with full context before the response is returned.
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger as NestLogger,
  BadRequestException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Request, Response } from 'express';
import { ZyraLogger, createLogger, type LogContext } from '@zyra/config';

export interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  requestId: string;
  error: string;
  message: string;
  errors?: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = createLogger(HttpExceptionFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { status, body } = this.buildErrorResponse(exception, request);

    const logContext: LogContext = {
      requestId: body.requestId,
      statusCode: status,
      path: body.path,
      method: body.method,
      error: body.error,
    };

    if (exception instanceof Error) {
      this.logger.error(
        `[HTTP_ERROR] ${body.method} ${body.path} ${status} — ${body.message}`,
        exception,
        logContext,
      );
    } else {
      this.logger.warn(
        `[HTTP_ERROR] ${body.method} ${body.path} ${status} — non-Error exception`,
        logContext,
      );
    }

    httpAdapter.reply(response, body, status);
  }

  private buildErrorResponse(
    exception: unknown,
    request: Request,
  ): { status: number; body: ErrorResponse } {
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'Internal Server Error';
    let message = 'An unexpected error occurred';
    let errors: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responseBody = exception.getResponse();

      if (typeof responseBody === 'string') {
        message = responseBody;
      } else if (typeof responseBody === 'object' && responseBody !== null) {
        const body = responseBody as Record<string, unknown>;
        message = typeof body.message === 'string' ? body.message : JSON.stringify(body);
        errors = body.message ?? body;
      } else {
        message = exception.message;
      }

      error = this.getErrorLabel(status);
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;
    }

    const requestId = request.get('x-request-id') ?? crypto.randomUUID();

    return {
      status,
      body: {
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        requestId,
        error,
        message,
        ...(errors !== undefined ? { errors } : {}),
      },
    };
  }

  private getErrorLabel(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'Bad Request';
      case HttpStatus.UNAUTHORIZED:
        return 'Unauthorized';
      case HttpStatus.FORBIDDEN:
        return 'Forbidden';
      case HttpStatus.NOT_FOUND:
        return 'Not Found';
      case HttpStatus.CONFLICT:
        return 'Conflict';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'Unprocessable Entity';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'Too Many Requests';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'Internal Server Error';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'Service Unavailable';
      default:
        return HttpStatus[status] ?? 'Error';
    }
  }
}
