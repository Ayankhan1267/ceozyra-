/**
 * ZYRA — Redis Service
 * Dual-client: node-redis v4 for key-value operations, ioredis for BullMQ.
 */

import { Injectable, OnModuleInit, OnModuleDestroy, Logger as NestLogger } from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';
import { Redis as IORedis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new NestLogger(RedisService.name);

  /** node-redis v4 client — used by services for KV operations */
  client: RedisClientType;

  /** ioredis client — used by BullMQ for queue connections */
  ioredis: IORedis;

  constructor() {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    this.client = createClient({ url });

    // ioredis accepts a plain URL string for the constructor
    // maxRetriesPerRequest: null is required by BullMQ for blocking commands
    this.ioredis = new IORedis(url, { maxRetriesPerRequest: null });
  }

  async onModuleInit() {
    await this.client.connect();
    this.ioredis.on('connect', () => {
      this.logger.debug('[Redis] ioredis connected');
    });
    this.ioredis.on('error', (err) => {
      this.logger.error(`[Redis] ioredis error: ${err.message}`);
    });
    this.logger.log('[Redis] node-redis and ioredis clients ready');
  }

  async onModuleDestroy() {
    await this.client.disconnect();
    await this.ioredis.quit();
    this.logger.debug('[Redis] Both clients disconnected');
  }

  // -----------------------------------------------------------------------
  // node-redis v4 KV operations (unchanged API surface)
  // -----------------------------------------------------------------------

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<string | null> {
    if (ttlSeconds) {
      return this.client.setEx(key, ttlSeconds, value);
    }
    return this.client.set(key, value);
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return Number(result) === 1;
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.client.expire(key, seconds);
    return Number(result) === 1;
  }

  // -----------------------------------------------------------------------
  // Rate limiting
  // -----------------------------------------------------------------------

  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number }> {
    const current = await this.incr(key);
    if (current === 1) {
      await this.expire(key, windowSeconds);
    }
    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
    };
  }

  // -----------------------------------------------------------------------
  // ioredis helpers for BullMQ / batch operations
  // -----------------------------------------------------------------------

  /** Return the raw ioredis instance for BullMQ Queue / Worker construction. */
  getIoredisClient(): IORedis {
    return this.ioredis;
  }
}
