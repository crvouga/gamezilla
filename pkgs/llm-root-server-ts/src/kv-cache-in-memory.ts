import { KvImplInMemory } from '@pkgs/kv-root-shared-ts/impl-in-memory';
import type { Kv } from '@pkgs/kv-root-shared-ts/interface';

/**
 * In-process {@link Kv} for tests and local client-side caching.
 */
export function createLlmInMemoryKv(): Kv {
  return new KvImplInMemory();
}
