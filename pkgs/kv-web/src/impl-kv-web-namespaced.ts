import { hotAssert } from '@pkgs/assert';
import type { Keyword } from '@pkgs/keyword/keyword';
import { assertNamespacedKeyword } from '@pkgs/keyword/keyword';
import {
  assertKvRecord,
  parseKvRecordFromUnknown,
} from '@pkgs/kv/assert-kv-record';
import type { Kv, KvRecord } from '@pkgs/kv/interface';
import { KvImplWebNamespacedTx } from './impl-kv-web-namespaced-tx';

function assertKvKey(key: string): asserts key is Keyword {
  assertNamespacedKeyword(hotAssert(), key);
}

function requireLocalStorage(): Storage {
  if (typeof globalThis.localStorage === 'undefined') {
    throw new Error(
      'localStorage is not available — namespaced Kv cannot be used on this platform'
    );
  }
  return globalThis.localStorage;
}

/**
 * Web {@link Kv} that stores rows under `namespace.${keyword}` in localStorage
 * so multiple in-process actors (product-harness Alice/Bob) do not share KV state.
 */
export class KvImplWebNamespaced implements Kv {
  private chain: Promise<void> = Promise.resolve();

  constructor(private readonly namespace: string) {}

  private physicalKey(key: Keyword): string {
    return `${this.namespace}.${key}`;
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn);
    this.chain = run.then(
      () => {},
      () => {}
    );
    return run;
  }

  async get(key: Keyword): Promise<KvRecord | null> {
    assertKvKey(key);
    return this.enqueue(async () => {
      const raw = requireLocalStorage().getItem(this.physicalKey(key));
      if (raw === null || raw.length === 0) return null;
      return parseKvRecordFromUnknown(hotAssert(), raw, 'kv web ns get');
    });
  }

  async put(key: Keyword, value: KvRecord): Promise<void> {
    assertKvKey(key);
    assertKvRecord(hotAssert(), value, 'kv web ns put');
    return this.enqueue(async () => {
      requireLocalStorage().setItem(
        this.physicalKey(key),
        JSON.stringify(value)
      );
    });
  }

  async zap(key: Keyword): Promise<void> {
    assertKvKey(key);
    return this.enqueue(async () => {
      requireLocalStorage().removeItem(this.physicalKey(key));
    });
  }

  async tx<T>(fn: (tx: Kv) => Promise<T>): Promise<T> {
    return this.enqueue(async () =>
      fn(new KvImplWebNamespacedTx(this.namespace))
    );
  }
}

/** Removes every localStorage key that starts with `namespace.`. */
export function clearNamespacedKvWeb(namespace: string): void {
  const storage = globalThis.localStorage;
  if (storage === undefined) return;
  const prefix = `${namespace}.`;
  const toRemove: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null && key.startsWith(prefix)) {
      toRemove.push(key);
    }
  }
  for (const key of toRemove) {
    storage.removeItem(key);
  }
}

/** Dump `namespace.*` localStorage entries (relative keys without prefix). */
export function dumpNamespacedKvWeb(namespace: string): Record<string, string> {
  const storage = globalThis.localStorage;
  if (storage === undefined) return {};
  const prefix = `${namespace}.`;
  const out: Record<string, string> = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key === null || !key.startsWith(prefix)) continue;
    const value = storage.getItem(key);
    if (value !== null) out[key.slice(prefix.length)] = value;
  }
  return out;
}

/** Restore dump from {@link dumpNamespacedKvWeb} (clears namespace first). */
export function restoreNamespacedKvWeb(
  namespace: string,
  entries: Record<string, string>
): void {
  clearNamespacedKvWeb(namespace);
  const storage = globalThis.localStorage;
  if (storage === undefined) return;
  for (const [rel, value] of Object.entries(entries)) {
    storage.setItem(`${namespace}.${rel}`, value);
  }
}
