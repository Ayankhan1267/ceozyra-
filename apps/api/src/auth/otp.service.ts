/**
 * ZYRA — OTP Service
 * In-memory OTP store with Redis fallback.
 * Used for email-based passwordless login.
 */

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

const REDIS_PREFIX = 'otp:';

interface OtpEntry {
  code: string;
  email: string;
  createdAt: number;
  attempts: number;
}

@Injectable()
export class OtpService implements OnModuleInit, OnModuleDestroy {
  private memoryStore = new Map<string, OtpEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private redisAvailable = false;

  constructor(private readonly redisService: RedisService) {}

  onModuleInit() {
    // Test Redis availability
    this.redisService
      .set(`${REDIS_PREFIX}__probe__`, '1', 1)
      .then(() => {
        this.redisAvailable = true;
        this.redisService.del(`${REDIS_PREFIX}__probe__`);
      })
      .catch(() => {
        this.redisAvailable = false;
      });

    // Periodic cleanup of expired in-memory entries (every 60s)
    this.cleanupInterval = setInterval(() => this.cleanupMemory(), 60_000);
  }

  onModuleDestroy() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
  }

  /**
   * Generate a 6-digit OTP code
   */
  generateOTP(): string {
    return String(Math.floor(100_000 + Math.random() * 900_000));
  }

  /**
   * Store an OTP for the given email with a TTL (default 5 minutes)
   */
  async storeOTP(email: string, code: string, ttlSeconds = 300): Promise<void> {
    const key = this.makeKey(email);
    const entry: OtpEntry = { code, email, createdAt: Date.now(), attempts: 0 };

    if (this.redisAvailable) {
      try {
        await this.redisService.set(key, JSON.stringify(entry), ttlSeconds);
        return;
      } catch {
        // Fall through to memory store
      }
    }

    // In-memory fallback
    this.memoryStore.set(email, {
      ...entry,
      createdAt: Date.now() + ttlSeconds * 1000, // store expiry timestamp
    });
  }

  /**
   * Verify an OTP code against what was stored for the email.
   * Returns true if the code matches and is within TTL.
   * Consumes the OTP on success (one-time use).
   */
  async verifyOTP(email: string, code: string): Promise<boolean> {
    const key = this.makeKey(email);

    if (this.redisAvailable) {
      try {
        const raw = await this.redisService.get(key);
        if (!raw) return false;

        const entry: OtpEntry = JSON.parse(raw);

        // Check if expired (Redis handles TTL, but guard anyway)
        if (Date.now() - entry.createdAt > 300_000) {
          await this.redisService.del(key);
          return false;
        }

        // Rate-limit brute force: lock out after 5 wrong attempts
        entry.attempts += 1;
        if (entry.attempts > 5) {
          await this.redisService.del(key);
          return false;
        }

        if (entry.code === code) {
          await this.redisService.del(key); // consume on success
          return true;
        }

        await this.redisService.set(key, JSON.stringify(entry), 300);
        return false;
      } catch {
        // Fall through to memory store
      }
    }

    // In-memory fallback
    const entry = this.memoryStore.get(email);
    if (!entry) return false;

    // Check expiry
    if (Date.now() > entry.createdAt) {
      this.memoryStore.delete(email);
      return false;
    }

    entry.attempts += 1;
    if (entry.attempts > 5) {
      this.memoryStore.delete(email);
      return false;
    }

    if (entry.code === code) {
      this.memoryStore.delete(email); // consume on success
      return true;
    }

    return false;
  }

  /**
   * Delete an OTP entry (e.g. after successful verification)
   */
  async deleteOTP(email: string): Promise<void> {
    if (this.redisAvailable) {
      try {
        await this.redisService.del(this.makeKey(email));
        return;
      } catch {
        // fall through
      }
    }
    this.memoryStore.delete(email);
  }

  private makeKey(email: string): string {
    return `${REDIS_PREFIX}${email.toLowerCase()}`;
  }

  private cleanupMemory(): void {
    const now = Date.now();
    for (const [email, entry] of this.memoryStore.entries()) {
      if (now > entry.createdAt) {
        this.memoryStore.delete(email);
      }
    }
  }
}
