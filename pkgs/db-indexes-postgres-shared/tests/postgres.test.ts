import { describe, expect, test } from 'bun:test';

/**
 * Postgres port integration is exercised against Neon/embedded with hypopg
 * in CD environments. Unit coverage of the reconcile loop lives in HarnessDb DST.
 * This placeholder documents the contract and stays green without a live PG.
 */
describe('postgres port contract', () => {
  test('createPostgresPort is exported', async () => {
    const mod = await import('@pkgs/db-indexes-postgres-shared/create-postgres-port');
    expect(typeof mod.createPostgresPort).toBe('function');
  });
});
