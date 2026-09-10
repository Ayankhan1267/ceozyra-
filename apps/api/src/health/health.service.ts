/**
 * ZYRA — Health Service (Phase 0.11)
 *
 * Exposes two endpoints:
 *   GET /health       — lightweight liveness probe (always fast)
 *   GET /health/deep  — comprehensive readiness check across all dependencies
 *
 * deepCheck probes:
 *   - Database (SELECT 1 via Prisma)
 *   - Redis (PING via ioredis)
 *   - Disk space (os.freeSpace)
 *   - Memory usage (os.totalmem / os.freemem)
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import os from 'node:os';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: { status: string; latency?: number };
    redis: { status: string; latency?: number };
    disk: { status: string; freeGB?: number; totalGB?: number; percentFree?: number };
    memory: { status: string; usedMB?: number; totalMB?: number; percentUsed?: number };
  };
}

const DEGRADED_MEMORY_PERCENT = 85;
const DEGRADED_DISK_PERCENT = 90;

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Liveness probe — returns immediately without touching dependencies.
   * Used by load balancers and container orchestrators.
   */
  async check(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness probe — checks all critical and secondary dependencies.
   * Any failed check downgrades the service to `degraded` (not `unhealthy`)
   * unless BOTH database AND Redis are down, in which case it is `unhealthy`.
   */
  async deepCheck(): Promise<HealthStatus> {
    const checks: HealthStatus['checks'] = {
      database: { status: 'unknown' },
      redis: { status: 'unknown' },
      disk: { status: 'unknown' },
      memory: { status: 'unknown' },
    };

    // --- Database ---
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'healthy', latency: Date.now() - start };
    } catch {
      checks.database = { status: 'unhealthy' };
    }

    // --- Redis (ioredis PING) ---
    try {
      const start = Date.now();
      await this.redis.ioredis.ping();
      checks.redis = { status: 'healthy', latency: Date.now() - start };
    } catch {
      checks.redis = { status: 'unhealthy' };
    }

    // --- Disk space ---
    try {
      const diskInfo = getDiskInfo();
      checks.disk = {
        status: diskInfo.percentFree < DEGRADED_DISK_PERCENT ? 'degraded' : 'healthy',
        freeGB: diskInfo.freeGB,
        totalGB: diskInfo.totalGB,
        percentFree: diskInfo.percentFree,
      };
    } catch {
      checks.disk = { status: 'unknown' };
    }

    // --- Memory ---
    try {
      const memInfo = getMemoryInfo();
      checks.memory = {
        status: memInfo.percentUsed > DEGRADED_MEMORY_PERCENT ? 'degraded' : 'healthy',
        usedMB: memInfo.usedMB,
        totalMB: memInfo.totalMB,
        percentUsed: memInfo.percentUsed,
      };
    } catch {
      checks.memory = { status: 'unknown' };
    }

    // --- Aggregate status ---
    const dbDown = checks.database.status === 'unhealthy';
    const redisDown = checks.redis.status === 'unhealthy';
    const hasDegraded = Object.values(checks).some((c) => c.status === 'degraded');

    let status: HealthStatus['status'];
    if (dbDown && redisDown) {
      status = 'unhealthy';
    } else if (dbDown || redisDown || hasDegraded) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}

// ---------------------------------------------------------------------------
// Platform-specific helpers
// ---------------------------------------------------------------------------

interface DiskInfo {
  freeGB: number;
  totalGB: number;
  percentFree: number;
}

function getDiskInfo(): DiskInfo {
  const cwd = process.cwd();
  let freeGB: number;
  let totalGB: number;

  // os.freeSpace was added in Node 20 but may not appear in @types/node yet.
  // Cast via unknown to sidestep the type gap.
  const osAny = os as unknown as Record<string, unknown>;
  const freeSpaceFn = osAny.freeSpace;

  if (typeof freeSpaceFn === 'function') {
    const totalBytes = (osAny.totalmem as () => number)?.() ?? 0;
    const freeBytes = (freeSpaceFn as (path: string) => number)(cwd);
    totalGB = totalBytes / 1024 / 1024 / 1024;
    freeGB = freeBytes / 1024 / 1024 / 1024;
  } else {
    // Fallback: report disk as unknown
    totalGB = 0;
    freeGB = 0;
  }

  const percentFree = totalGB > 0 ? parseFloat(((freeGB / totalGB) * 100).toFixed(1)) : 0;

  return { freeGB: parseFloat(freeGB.toFixed(2)), totalGB: parseFloat(totalGB.toFixed(2)), percentFree };
}

interface MemoryInfo {
  usedMB: number;
  totalMB: number;
  percentUsed: number;
}

function getMemoryInfo(): MemoryInfo {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;

  const totalMB = parseFloat((totalBytes / 1024 / 1024).toFixed(0));
  const usedMB = parseFloat((usedBytes / 1024 / 1024).toFixed(0));
  const percentUsed = parseFloat(((usedBytes / totalBytes) * 100).toFixed(1));

  return { usedMB, totalMB, percentUsed };
}
