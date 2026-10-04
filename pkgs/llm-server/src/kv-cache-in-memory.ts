import { KvImplInMemory } from '@pkgs/kv-shared/impl-in-memory';
import type { Kv } from '@pkgs/kv-shared/interface';

/**
 * In-process {@link Kv} for tests and local client-side caching.
 */
export function createLlmInMemoryKv(): Kv {
  return new KvImplInMemory();
}
