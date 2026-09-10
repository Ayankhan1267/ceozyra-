/**
 * ZYRA — Auth Package
 * Hashing, token generation, and security utilities for the API
 */

import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { sanitizeInput, hashString as coreHashString } from '@zyra/security';

export type UserRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'MARKETING' | 'FINANCE' | 'SUPPORT' | 'SUPER_ADMIN';

export const UserRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE',
  MARKETING: 'MARKETING',
  FINANCE: 'FINANCE',
  SUPPORT: 'SUPPORT',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenantId?: string;
  firstName?: string;
  lastName?: string;
}

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  tenantId?: string;
}

// ─── Token generation ────────────────────────────────────────
// NOTE: For actual JWT signing/verification, use @nestjs/jwt in the API.
// These are helpers for session ID and refresh token generation.

export function generateAccessToken(payload: TokenPayload): string {
  const data = JSON.stringify(payload);
  const encoded = Buffer.from(data).toString('base64url');
  const signature = createHash('sha256')
    .update(encoded + (process.env.JWT_SECRET || 'dev-secret'))
    .digest('hex');
  return `${encoded}.${signature}`;
}

export function generateRefreshToken(_payload?: TokenPayload): string {
  return 'rt_' + randomBytes(32).toString('hex');
}

export function generateSessionId(): string {
  return 'sess_' + randomBytes(24).toString('hex');
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) return null;

    const expectedSignature = createHash('sha256')
      .update(encoded + (process.env.JWT_SECRET || 'dev-secret'))
      .digest('hex');

    if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
      return null;
    }

    return JSON.parse(Buffer.from(encoded, 'base64url').toString());
  } catch {
    return null;
  }
}

// Re-export password helpers and security utilities
export { hashPassword, verifyPassword, sanitizeInput, hashString } from '@zyra/security';
