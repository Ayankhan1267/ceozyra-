import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  sanitizeInput,
  sanitizeHtml,
  generateApiKey,
  generateId,
} from '../../packages/security/src/index';

describe('security', () => {
  it('hashes and verifies password', async () => {
    const hash = await hashPassword('secret123');
    expect(await verifyPassword('secret123', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('verifyPassword returns false for malformed hash', async () => {
    expect(await verifyPassword('password', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('password', 'md5:abc:xyz')).toBe(false);
    expect(await verifyPassword('password', '')).toBe(false);
  });

  it('generates a valid api key', () => {
    const key = generateApiKey();
    expect(key).toMatch(/^zyra_[a-f0-9]{48}$/);
  });

  it('generates id with prefix', () => {
    const id = generateId('usr');
    expect(id).toMatch(/^usr_[a-f0-9]+$/);
  });

  it('sanitizeInput strips angle brackets (XSS)', () => {
    expect(sanitizeInput('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
    expect(sanitizeInput('hello world')).toBe('hello world');
    expect(sanitizeInput('<img src=x onerror=alert(1)>')).toBe('img src=x onerror=alert(1)');
  });

  it('sanitizeHtml escapes HTML entities', () => {
    expect(sanitizeHtml('<script>x</script>')).toBe('&lt;script&gt;x&lt;/script&gt;');
    expect(sanitizeHtml('a "b" & c')).toBe('a &quot;b&quot; &amp; c');
    expect(sanitizeHtml("it's")).toBe("it&#039;s");
  });
});
