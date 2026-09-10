/**
 * ZYRA — Structured Logger (Phase 0.11)
 *
 * JSON-structured logging using pino when available, falling back to
 * console-based structured logging when pino is not installed.
 *
 * Log levels (SRE-aligned):
 *   debug  — verbose development detail
 *   info   — normal operational events
 *   warn   — recoverable anomalies
 *   error  — failures that affect a user or operation
 *
 * Every log record is enriched with:
 *   timestamp, level, service, env, requestId, tenantId, userId
 */

import { Logger } from 'pino';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  /** ID that links all logs for a single HTTP request */
  requestId?: string;
  /** Tenant slug or ID — scopes log to a merchant */
  tenantId?: string;
  /** User ID (from JWT) — scopes log to a specific user */
  userId?: string;
  /** Queue name, when logging from a queue handler */
  queueName?: string;
  /** Any extra key-value pairs the caller wants to attach */
  [key: string]: unknown;
}

export type LogMetadata = {
  timestamp: string;
  level: LogLevel;
  service: string;
  env: string;
  requestId?: string;
  tenantId?: string;
  userId?: string;
  msg: string;
} & Record<string, unknown>;

const SERVICE_NAME = 'zyra-api';
const SERVICE_VERSION = '0.1.0';

// ---------------------------------------------------------------------------
// Resolve pino at module load time (no bundler involvement).
// Falls back to console-based structured logger when pino is absent.
// ---------------------------------------------------------------------------

let pinoInstance: Logger | null = null;
let usePino = false;

// Synchronous resolution — pino is a regular dependency, not dynamic.
try {
  const pinoModule = require('pino');
  const env = process.env.APP_ENV || process.env.NODE_ENV || 'development';

  pinoInstance = pinoModule.default({
    level: process.env.LOG_LEVEL || 'info',
    base: { service: SERVICE_NAME, env, version: SERVICE_VERSION },
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  });

  usePino = true;
} catch {
  // pino not installed — console fallback is used throughout.
}

// ---------------------------------------------------------------------------
// Console-based structured logger (fallback)
// ---------------------------------------------------------------------------

function consoleLog(
  level: LogLevel,
  message: string,
  context: LogContext = {},
): void {
  const entry: LogMetadata = {
    timestamp: new Date().toISOString(),
    level,
    service: SERVICE_NAME,
    env: process.env.APP_ENV || process.env.NODE_ENV || 'development',
    msg: message,
    ...context,
  };

  const json = JSON.stringify(entry);

  switch (level) {
    case 'debug':
      console.debug(json);
      break;
    case 'info':
      console.log(json);
      break;
    case 'warn':
      console.warn(json);
      break;
    case 'error':
      console.error(json);
      break;
  }
}

// ---------------------------------------------------------------------------
// Injected request-ID context (set by RequestIdMiddleware, cleared per-request)
// ---------------------------------------------------------------------------

let activeRequestId: string | undefined;

export function setRequestId(id: string): void {
  activeRequestId = id;
}

export function clearRequestId(): void {
  activeRequestId = undefined;
}

function buildContext(extra?: LogContext): LogContext {
  return {
    ...extra,
    requestId: extra?.requestId ?? activeRequestId,
  };
}

// ---------------------------------------------------------------------------
// Logger class
// ---------------------------------------------------------------------------

export class ZyraLogger {
  static debug(message: string, context?: LogContext): void {
    if (usePino && pinoInstance) {
      pinoInstance.debug(context, message);
    } else {
      consoleLog('debug', message, buildContext(context));
    }
  }

  static info(message: string, context?: LogContext): void {
    if (usePino && pinoInstance) {
      pinoInstance.info(context, message);
    } else {
      consoleLog('info', message, buildContext(context));
    }
  }

  static warn(message: string, context?: LogContext): void {
    if (usePino && pinoInstance) {
      pinoInstance.warn(context, message);
    } else {
      consoleLog('warn', message, buildContext(context));
    }
  }

  static error(message: string, error?: Error, context?: LogContext): void {
    const errorContext: LogContext = {
      ...buildContext(context),
      ...(error
        ? {
            error: {
              message: error.message,
              name: error.name,
              stack: error.stack,
            },
          }
        : {}),
    };

    if (usePino && pinoInstance) {
      pinoInstance.error(errorContext, message);
    } else {
      consoleLog('error', message, errorContext);
    }
  }
}

/**
 * Create a child logger scoped to a namespace (e.g. a NestJS service name).
 *
 * @param namespace - The NestJS service/module name for log source attribution.
 */
export function createLogger(namespace: string): typeof ZyraLogger {
  if (usePino && pinoInstance) {
    const child = pinoInstance.child({ ns: namespace });
    return {
      debug: (msg: string, ctx?: LogContext) => child.debug(ctx, msg),
      info: (msg: string, ctx?: LogContext) => child.info(ctx, msg),
      warn: (msg: string, ctx?: LogContext) => child.warn(ctx, msg),
      error: (msg: string, err?: Error, ctx?: LogContext) => {
        const c = { ...ctx, ...(err ? { error: { message: err.message, name: err.name, stack: err.stack } } : {}) };
        child.error(c, msg);
      },
    } as typeof ZyraLogger;
  }

  return {
    debug: (msg: string, ctx?: LogContext) =>
      consoleLog('debug', `[${namespace}] ${msg}`, buildContext(ctx)),
    info: (msg: string, ctx?: LogContext) =>
      consoleLog('info', `[${namespace}] ${msg}`, buildContext(ctx)),
    warn: (msg: string, ctx?: LogContext) =>
      consoleLog('warn', `[${namespace}] ${msg}`, buildContext(ctx)),
    error: (msg: string, err?: Error, ctx?: LogContext) =>
      consoleLog('error', `[${namespace}] ${msg}${err ? ` — ${err.message}` : ''}`, buildContext(ctx)),
  } as typeof ZyraLogger;
}
