/**
 * ZYRA — Security Package
 * Password hashing, input sanitization, and security utilities
 */

import { randomBytes, createHash, timingSafeEqual, scryptSync } from 'node:crypto';

// ─── Password Hashing (via crypto.scryptSync) ──────────

const SCRYPT_N = 16384;
const SCRYPT_r = 8;
const SCRYPT_p = 1;
const KEY_LEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_r, p: SCRYPT_p });
  return `scrypt:${SCRYPT_N}:${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash.startsWith('scrypt:')) {
    return false;
  }
  const parts = hash.split(':');
  if (parts.length !== 4) return false;

  const n = parseInt(parts[1], 10);
  const salt = parts[2];
  const expectedKey = parts[3];

  try {
    const derivedKey = scryptSync(password, salt, expectedKey.length / 2, { N: n, r: SCRYPT_r, p: SCRYPT_p });
    const derivedHex = derivedKey.toString('hex');
    return timingSafeEqual(Buffer.from(derivedHex, 'hex'), Buffer.from(expectedKey, 'hex'));
  } catch {
    return false;
  }
}

// ─── Input Sanitization ───────────────────────────────────────

const XSS_PATTERN = /[<>]/g;
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC|UNION|SCRIPT)\b)/i,
  /(;|\-\-|\/\*|\*\/|xp_)/,
];

export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(XSS_PATTERN, '')
    .trim();
}

export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function hasSqlInjection(input: string): boolean {
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
}

// ─── API Key Generation ───────────────────────────────────────

export function generateApiKey(prefix: string = 'zyra'): string {
  const id = randomBytes(24).toString('hex');
  return `${prefix}_${id}`;
}

export function generateSecretKey(): string {
  return randomBytes(32).toString('hex');
}

// ─── ID Generation ────────────────────────────────────────────

export function generateId(prefix?: string): string {
  const id = randomBytes(12).toString('hex');
  return prefix ? `${prefix}_${id}` : id;
}

// ─── Hashing Utilities ────────────────────────────────────────

export function hashString(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

// ─── Timing-safe Comparison ───────────────────────────────────

export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b)) ||
    a === b;
}

// ─── Tenant Context ───────────────────────────────────────────

export interface TenantContext {
  tenantId: string;
  userId: string;
  role: string;
}

export function createTenantContext(tenantId: string, userId: string, role: string): TenantContext {
  return { tenantId, userId, role };
}

// ─── Rate Limit Key Generator ─────────────────────────────────

export function getRateLimitKey(ip: string, identifier: string): string {
  return `ratelimit:${identifier}:${hashString(ip)}`;
}

// ─── CORS ─────────────────────────────────────────────────────

export function getAllowedOrigins(env: string): string[] {
  if (env === 'production') {
    return [
      'https://ceozyra.com',
      'https://www.ceozyra.com',
      'https://app.ceozyra.com',
      'https://admin.ceozyra.com',
    ];
  }
  if (env === 'qa') {
    return [
      'https://qa.ceozyra.com',
      'https://www.ceozyra.com',
    ];
  }
  return ['*'];
}
