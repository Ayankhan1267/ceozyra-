import { describe, it, expect } from 'vitest';
import { validateEnv, type ValidationResult } from '../../packages/config/src/env.validation';

function runValidation(overrides: Record<string, string>): ValidationResult {
  const original = { ...process.env };
  for (const key of Object.keys(overrides)) {
    process.env[key] = overrides[key];
  }
  const result = validateEnv();
  process.env = original;
  return result;
}

describe('env validation', () => {
  it('fails when DATABASE_URL is missing', () => {
    const result = runValidation({ DATABASE_URL: '' });
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes('DATABASE_URL'))).toBe(true);
  });

  it('warns when DATABASE_URL has wrong protocol', () => {
    const result = runValidation({
      DATABASE_URL: 'mysql://localhost/db',
      JWT_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'a'.repeat(32),
    });
    expect(result.warnings.some((w) => w.includes('DATABASE_URL'))).toBe(true);
  });

  it('fails when JWT_SECRET is too short', () => {
    const result = runValidation({
      DATABASE_URL: 'postgresql://localhost/db',
      JWT_SECRET: 'short',
      JWT_REFRESH_SECRET: 'a'.repeat(32),
    });
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes('JWT_SECRET'))).toBe(true);
  });

  it('warns on placeholder JWT_SECRET', () => {
    const result = runValidation({
      DATABASE_URL: 'postgresql://localhost/db',
      JWT_SECRET: 'CHANGE_ME_IN_PRODUCTION',
      JWT_REFRESH_SECRET: 'CHANGE_ME_IN_PRODUCTION',
    });
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes('PLACEHOLDER'))).toBe(true);
  });

  it('passes with valid env', () => {
    const result = runValidation({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db?schema=public',
      JWT_SECRET: 'a'.repeat(64),
      JWT_REFRESH_SECRET: 'a'.repeat(64),
    });
    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('warns when SMTP is unconfigured', () => {
    const result = runValidation({
      DATABASE_URL: 'postgresql://localhost/db',
      JWT_SECRET: 'a'.repeat(64),
      JWT_REFRESH_SECRET: 'a'.repeat(64),
      SMTP_HOST: '',
      SMTP_PORT: '',
    });
    expect(result.warnings.some((w) => w.includes('SMTP'))).toBe(true);
  });
});
