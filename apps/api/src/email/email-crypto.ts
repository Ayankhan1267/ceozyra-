/**
 * ZYRA — Email Crypto
 *
 * AES-256-GCM encryption for tenant SMTP credentials (passwords).
 * Key from MAIL_ENCRYPTION_KEY, falling back to JWT_SECRET with a warning.
 * Format: iv:authTag:ciphertext (base64).
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes, type CipherKey } from 'node:crypto';

const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  let secret = process.env.MAIL_ENCRYPTION_KEY;
  if (!secret) {
    secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('MAIL_ENCRYPTION_KEY / JWT_SECRET is not set; cannot encrypt SMTP credentials');
    }
    console.warn('[EmailCrypto] MAIL_ENCRYPTION_KEY not set — falling back to JWT_SECRET for SMTP credential encryption.');
  }
  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(plain: string): string {
  if (!plain) return '';
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key as CipherKey, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptSecret(blob: string): string {
  if (!blob) return '';
  try {
    const [ivB64, tagB64, dataB64] = blob.split(':');
    if (!ivB64 || !tagB64 || !dataB64) return '';
    const key = getKey();
    const decipher = createDecipheriv(ALGO, key as CipherKey, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return '';
  }
}
