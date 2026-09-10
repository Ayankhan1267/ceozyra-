"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZyraLogger = void 0;
exports.setRequestId = setRequestId;
exports.clearRequestId = clearRequestId;
exports.createLogger = createLogger;
const SERVICE_NAME = 'zyra-api';
const SERVICE_VERSION = '0.1.0';
// ---------------------------------------------------------------------------
// Resolve pino at module load time (no bundler involvement).
// Falls back to console-based structured logger when pino is absent.
// ---------------------------------------------------------------------------
let pinoInstance = null;
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
}
catch {
    // pino not installed — console fallback is used throughout.
}
// ---------------------------------------------------------------------------
// Console-based structured logger (fallback)
// ---------------------------------------------------------------------------
function consoleLog(level, message, context = {}) {
    const entry = {
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
let activeRequestId;
function setRequestId(id) {
    activeRequestId = id;
}
function clearRequestId() {
    activeRequestId = undefined;
}
function buildContext(extra) {
    return {
        ...extra,
        requestId: extra?.requestId ?? activeRequestId,
    };
}
// ---------------------------------------------------------------------------
// Logger class
// ---------------------------------------------------------------------------
class ZyraLogger {
    static debug(message, context) {
        if (usePino && pinoInstance) {
            pinoInstance.debug(context, message);
        }
        else {
            consoleLog('debug', message, buildContext(context));
        }
    }
    static info(message, context) {
        if (usePino && pinoInstance) {
            pinoInstance.info(context, message);
        }
        else {
            consoleLog('info', message, buildContext(context));
        }
    }
    static warn(message, context) {
        if (usePino && pinoInstance) {
            pinoInstance.warn(context, message);
        }
        else {
            consoleLog('warn', message, buildContext(context));
        }
    }
    static error(message, error, context) {
        const errorContext = {
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
        }
        else {
            consoleLog('error', message, errorContext);
        }
    }
}
exports.ZyraLogger = ZyraLogger;
/**
 * Create a child logger scoped to a namespace (e.g. a NestJS service name).
 *
 * @param namespace - The NestJS service/module name for log source attribution.
 */
function createLogger(namespace) {
    if (usePino && pinoInstance) {
        const child = pinoInstance.child({ ns: namespace });
        return {
            debug: (msg, ctx) => child.debug(ctx, msg),
            info: (msg, ctx) => child.info(ctx, msg),
            warn: (msg, ctx) => child.warn(ctx, msg),
            error: (msg, err, ctx) => {
                const c = { ...ctx, ...(err ? { error: { message: err.message, name: err.name, stack: err.stack } } : {}) };
                child.error(c, msg);
            },
        };
    }
    return {
        debug: (msg, ctx) => consoleLog('debug', `[${namespace}] ${msg}`, buildContext(ctx)),
        info: (msg, ctx) => consoleLog('info', `[${namespace}] ${msg}`, buildContext(ctx)),
        warn: (msg, ctx) => consoleLog('warn', `[${namespace}] ${msg}`, buildContext(ctx)),
        error: (msg, err, ctx) => consoleLog('error', `[${namespace}] ${msg}${err ? ` — ${err.message}` : ''}`, buildContext(ctx)),
    };
}
