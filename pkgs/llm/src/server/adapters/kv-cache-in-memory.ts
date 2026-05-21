import { KvImplInMemory } from '@pkgs/kv/impl-in-memory';
import type { Kv } from '@pkgs/kv/interface';

/**
 * In-process {@link Kv} for tests and local client-side caching.
 */
export function createLlmInMemoryKv(): Kv {
  return new KvImplInMemory();
}
