import { describe, expect, test } from 'bun:test';
import { asKeyword } from '../keyword/keyword';
import { KvImplInMemory } from '../kv/impl-in-memory';
import { DistributedLockImplKv } from './impl-kv';
import { LockHeldError } from './interface';

export function runDistributedLockContractTests(
  factory: () =>
    | InstanceType<typeof DistributedLockImplKv>
    | Promise<InstanceType<typeof DistributedLockImplKv>>
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

  test('releaseIfHeldById clears same token after normal release would no-op', async () => {
    const lock = await Promise.resolve(factory());
    const h = await lock.acquire('deploy');
    await h.release();
    expect(await lock.status()).toBeNull();
    await lock.releaseIfHeldById(h.id);
    expect(await lock.status()).toBeNull();
  });

  test('releaseIfHeldById removes row when id still matches', async () => {
    const lock = await Promise.resolve(factory());
    const h = await lock.acquire('deploy');
    const id = h.id;
    await lock.releaseIfHeldById(id);
    expect(await lock.status()).toBeNull();
    await h.release().catch(() => {});
  });
}

describe('DistributedLockImplKv + KvImplInMemory (contract)', () => {
  runDistributedLockContractTests(async () => {
    const kv = new KvImplInMemory();
    return new DistributedLockImplKv(kv, {
      key: asKeyword('gamezilla.test/distributed-lock-contract'),
    });
  });
});
