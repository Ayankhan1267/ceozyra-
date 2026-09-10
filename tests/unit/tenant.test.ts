import { describe, it, expect } from 'vitest';
import { AsyncLocalStorage } from 'node:async_hooks';

interface TenantStore {
  tenantId: string | null;
  userId: string | null;
}

const TENANT_CONTEXT = new AsyncLocalStorage<TenantStore>();

function getCurrentTenantId(): string | null {
  return TENANT_CONTEXT.getStore()?.tenantId ?? null;
}

describe('tenant context', () => {
  it('returns tenantId inside TENANT_CONTEXT.run', async () => {
    const result = await new Promise<string | null>((resolve) => {
      TENANT_CONTEXT.run({ tenantId: 't1', userId: null }, () => {
        resolve(getCurrentTenantId());
      });
    });
    expect(result).toBe('t1');
  });

  it('returns null outside of any async context', () => {
    expect(getCurrentTenantId()).toBeNull();
  });

  it('returns null when tenantId is null inside context', async () => {
    const result = await new Promise<string | null>((resolve) => {
      TENANT_CONTEXT.run({ tenantId: null, userId: 'u1' }, () => {
        resolve(getCurrentTenantId());
      });
    });
    expect(result).toBeNull();
  });

  it('isolates concurrent contexts', async () => {
    const results = await Promise.all([
      new Promise<string | null>((resolve) => {
        TENANT_CONTEXT.run({ tenantId: 'a', userId: null }, () => {
          resolve(getCurrentTenantId());
        });
      }),
      new Promise<string | null>((resolve) => {
        TENANT_CONTEXT.run({ tenantId: 'b', userId: null }, () => {
          resolve(getCurrentTenantId());
        });
      }),
    ]);
    expect(results).toEqual(['a', 'b']);
  });
});
