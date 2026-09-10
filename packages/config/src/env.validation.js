"use strict";
/**
 * ZYRA — Environment Variable Validation
 *
 * Validates all required environment variables at startup with
 * descriptive error messages. Run this once before the app boots.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnv = validateEnv;
exports.assertEnvValid = assertEnvValid;
const isURL = (v) => {
    try {
        new URL(v);
        return true;
    }
    catch {
        return false;
    }
};
const isPort = (v) => /^\d+$/.test(v) && parseInt(v, 10) > 0 && parseInt(v, 10) <= 65535;
const hasMinLength = (min) => (v) => v.length >= min;
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const rules = [
    // ─── Critical ───────────────────────────────────────────────
    {
        key: 'DATABASE_URL',
        required: true,
        validate: (v) => v.startsWith('postgresql://') || v.startsWith('postgres://'),
        label: 'Database connection string',
    },
    {
        key: 'JWT_SECRET',
        required: true,
        validate: hasMinLength(32),
        label: 'JWT signing secret',
    },
    {
        key: 'JWT_REFRESH_SECRET',
        required: true,
        validate: hasMinLength(32),
        label: 'JWT refresh token secret',
    },
    // ─── Redis ──────────────────────────────────────────────────
    {
        key: 'REDIS_URL',
        required: false,
        validate: (v) => !v || v.startsWith('redis://') || v.startsWith('rediss://'),
        label: 'Redis connection URL',
    },
    // ─── Email (SMTP) ───────────────────────────────────────────
    {
        key: 'SMTP_HOST',
        required: false,
    },
    {
        key: 'SMTP_PORT',
        required: false,
        validate: (v) => !v || isPort(v),
        label: 'SMTP port (must be 1-65535)',
    },
    {
        key: 'SMTP_USER',
        required: false,
    },
    {
        key: 'SMTP_PASS',
        required: false,
    },
    {
        key: 'EMAIL_FROM',
        required: false,
        validate: (v) => !v || isEmail(v),
        label: 'From email address',
    },
    // ─── Storage ────────────────────────────────────────────────
    {
        key: 'S3_ENDPOINT',
        required: false,
    },
    {
        key: 'S3_ACCESS_KEY',
        required: false,
    },
    {
        key: 'S3_SECRET_KEY',
        required: false,
    },
    // ─── Payments ───────────────────────────────────────────────
    {
        key: 'RAZORPAY_KEY_ID',
        required: false,
    },
    {
        key: 'RAZORPAY_KEY_SECRET',
        required: false,
    },
    {
        key: 'STRIPE_SECRET_KEY',
        required: false,
    },
    {
        key: 'STRIPE_WEBHOOK_SECRET',
        required: false,
    },
    // ─── OAuth ──────────────────────────────────────────────────
    {
        key: 'GOOGLE_CLIENT_ID',
        required: false,
    },
    {
        key: 'GOOGLE_CLIENT_SECRET',
        required: false,
    },
    // ─── Observability ──────────────────────────────────────────
    {
        key: 'LOG_LEVEL',
        required: false,
        validate: (v) => !v || ['error', 'warn', 'log', 'debug', 'verbose'].includes(v),
        label: 'NestJS log level',
    },
];
/**
 * Run validation against current process env.
 * Call this early in main.ts before NestFactory.create().
 */
function validateEnv() {
    const result = {
        passed: true,
        errors: [],
        warnings: [],
    };
    for (const rule of rules) {
        const value = process.env[rule.key];
        if (rule.required && !value) {
            result.errors.push(`[MISSING] ${rule.label || rule.key}: ${rule.key} is required but not set`);
            result.passed = false;
            continue;
        }
        if (value && rule.validate && !rule.validate(value)) {
            if (rule.key === 'JWT_SECRET' || rule.key === 'JWT_REFRESH_SECRET') {
                result.errors.push(`[INVALID] ${rule.label || rule.key}: ${rule.key} must be at least 32 characters (currently ${value.length}). ` +
                    `Generate a secure secret: openssl rand -base64 64`);
                result.passed = false;
            }
            else {
                result.warnings.push(`[WARN] ${rule.label || rule.key}: ${rule.key} appears malformed: "${value.substring(0, 40)}${value.length > 40 ? '...' : ''}"`);
            }
        }
        // Warn on placeholder values for critical keys
        if (value &&
            (value.startsWith('CHANGE_ME') || value.startsWith('REPLACE_') || value === '')) {
            const isCritical = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL'].includes(rule.key);
            if (isCritical) {
                result.errors.push(`[PLACEHOLDER] ${rule.label || rule.key}: ${rule.key} still has a placeholder value. Set a real value before deploying.`);
                result.passed = false;
            }
            else {
                result.warnings.push(`[PLACEHOLDER] ${rule.label || rule.key}: ${rule.key} has a placeholder value.`);
            }
        }
    }
    // Warn if email is unconfigured (SMTP all empty)
    if (!process.env.SMTP_HOST && !process.env.SMTP_PORT) {
        result.warnings.push('[WARN] SMTP not configured — email sending will silently fail. Set SMTP_HOST and SMTP_PORT.');
    }
    // Warn if JWT secrets look short even when passing validation
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 64) {
        result.warnings.push(`[WARN] JWT_SECRET is only ${process.env.JWT_SECRET.length} chars. Use 64+ chars for production: openssl rand -base64 64`);
    }
    return result;
}
/**
 * Throw if validation fails. Convenience wrapper used at app bootstrap.
 */
function assertEnvValid() {
    const result = validateEnv();
    if (result.errors.length > 0) {
        console.error('\n❌ Environment validation failed:\n');
        for (const err of result.errors) {
            console.error(`   ${err}`);
        }
        console.error('\n   Fix the above and restart.\n');
        process.exit(1);
    }
    if (result.warnings.length > 0) {
        console.warn('\n⚠️  Environment warnings:');
        for (const warn of result.warnings) {
            console.warn(`   ${warn}`);
        }
        console.warn('');
    }
    console.log('✅ Environment validation passed.');
}
