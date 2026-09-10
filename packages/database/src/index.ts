/**
 * ZYRA — Database Package
 * Prisma client singleton, connection helpers, and repository helpers
 */

import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('[DB] Connected to database');
  } catch (error) {
    console.error('[DB] Connection failed:', error);
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

export async function healthCheck(): Promise<{ status: 'healthy' | 'unhealthy' }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy' };
  } catch {
    return { status: 'unhealthy' };
  }
}

// ─── Repository Helpers (typed via Prisma delegate) ──────────

type PrismaDelegate = {
  findMany: (args?: object) => Promise<unknown[]>;
  findUnique: (args: object) => Promise<unknown>;
  create: (args: object) => Promise<unknown>;
  update: (args: object) => Promise<unknown>;
  delete: (args: object) => Promise<unknown>;
  count: (args?: object) => Promise<number>;
};

function getDelegate(model: string): PrismaDelegate {
  const delegate = (prisma as unknown as Record<string, PrismaDelegate | undefined>)[model];
  if (!delegate) {
    throw new Error(`Unknown Prisma model: ${model}`);
  }
  return delegate;
}

export async function findMany(model: string, args: object = {}): Promise<unknown[]> {
  return getDelegate(model).findMany(args) as Promise<unknown[]>;
}

export async function findUnique(model: string, args: { where: Record<string, unknown> }): Promise<unknown> {
  return getDelegate(model).findUnique(args);
}

export async function create(model: string, args: { data: Record<string, unknown> }): Promise<unknown> {
  return getDelegate(model).create(args);
}

export async function update(
  model: string,
  args: { where: Record<string, unknown>; data: Record<string, unknown> }
): Promise<unknown> {
  return getDelegate(model).update(args);
}

export async function deleteRecord(model: string, args: { where: Record<string, unknown> }): Promise<unknown> {
  return getDelegate(model).delete(args);
}

export async function count(model: string, args: { where?: Record<string, unknown> } = {}): Promise<number> {
  return getDelegate(model).count(args);
}

// ─── Transaction Wrapper ──────────────────────────────────────

export async function transaction<T>(
  callback: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => callback(tx as PrismaClient));
}
