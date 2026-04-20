import { describe, expect, test } from 'bun:test';
import { KvImplInMemory } from './impl-in-memory';
import type { Kv } from './interface';

export function runKvContractTests(factory: () => Kv | Promise<Kv>): void {
  test('get returns null for missing key', async () => {
    const kv = await Promise.resolve(factory());
    expect(await kv.get('nope')).toBeNull();
  });

  test('put then get returns value', async () => {
    const kv = await Promise.resolve(factory());
    await kv.put('a', '1');
    expect(await kv.get('a')).toBe('1');
  });

  test('put overwrites', async () => {
    const kv = await Promise.resolve(factory());
    await kv.put('a', '1');
    await kv.put('a', '2');
    expect(await kv.get('a')).toBe('2');
  });

  test('zap is idempotent', async () => {
    const kv = await Promise.resolve(factory());
    await kv.zap('ghost');
    await kv.put('x', 'y');
    await kv.zap('x');
    await kv.zap('x');
    expect(await kv.get('x')).toBeNull();
  });

  test('transaction isolates put', async () => {
    const kv = await Promise.resolve(factory());
    await kv.transaction(async (tx) => {
      await tx.put('t', 'v');
    });
    expect(await kv.get('t')).toBe('v');
  });
}

describe('KvImplInMemory (contract)', () => {
  runKvContractTests(() => new KvImplInMemory());
});
