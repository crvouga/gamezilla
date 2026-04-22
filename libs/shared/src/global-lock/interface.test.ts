import { describe, expect, test } from 'bun:test';
import { KvImplInMemory } from '../kv/impl-in-memory';
import { GlobalLockImplKv } from './impl-kv';
import { LockHeldError } from './interface';

export function runGlobalLockContractTests(
  factory: () => InstanceType<typeof GlobalLockImplKv> | Promise<InstanceType<typeof GlobalLockImplKv>>
): void {
  test('acquire then status shows holder', async () => {
    const lock = await Promise.resolve(factory());
    const h = await lock.acquire('deploy');
    const s = await lock.status();
    expect(s).not.toBeNull();
    expect(s!.operation).toBe('deploy');
    await h.release();
    expect(await lock.status()).toBeNull();
  });

  test('second acquire throws LockHeldError', async () => {
    const lock = await Promise.resolve(factory());
    const h = await lock.acquire('a');
    await expect(lock.acquire('b')).rejects.toBeInstanceOf(LockHeldError);
    await h.release();
  });

  test('forceUnlock returns prior holder', async () => {
    const lock = await Promise.resolve(factory());
    const h = await lock.acquire('x');
    const prior = await lock.forceUnlock();
    expect(prior).not.toBeNull();
    expect(prior!.operation).toBe('x');
    expect(await lock.status()).toBeNull();
    await h.release().catch(() => {});
  });
}

describe('GlobalLockImplKv + KvImplInMemory (contract)', () => {
  runGlobalLockContractTests(async () => {
    const kv = new KvImplInMemory();
    return new GlobalLockImplKv(kv, { key: 'test-lock' });
  });
});
