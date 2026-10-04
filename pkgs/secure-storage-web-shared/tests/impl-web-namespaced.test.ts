/**
 * Mirrors product-harness `dumpProductHarnessClientDurable` / restore: namespaced web
 * secure storage + namespaced Kv must round-trip through a localStorage dump
 * (session-scoped keys via sessionStorage).
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { asKeyword, asKeywordRecord } from '@pkgs/keyword-shared/keyword';
import {
  clearNamespacedKvWeb,
  dumpNamespacedKvWeb,
  KvImplWebNamespaced,
} from '@pkgs/kv-web-shared/impl-kv-web-namespaced';
import {
  clearNamespacedWebSecureStorage,
  createNamespacedWebSecureStorage,
} from '@pkgs/secure-storage-web-shared/impl-web';

const SESSION_SCOPED = new Set(['lastLocalAccountId']);

function installMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? (map.get(key) ?? null) : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

function dumpSessionPrefix(
  storage: Storage,
  namespace: string
): Record<string, string> {
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

function dumpClientDurable(namespace: string): Record<string, string> {
  return {
    ...dumpNamespacedKvWeb(namespace),
    ...dumpSessionPrefix(globalThis.sessionStorage, namespace),
  };
}

function restoreClientDurable(
  namespace: string,
  entries: Record<string, string>
): void {
  clearNamespacedKvWeb(namespace);
  clearNamespacedWebSecureStorage(namespace);
  for (const [rel, value] of Object.entries(entries)) {
    if (SESSION_SCOPED.has(rel)) {
      globalThis.sessionStorage.setItem(`${namespace}.${rel}`, value);
    } else {
      globalThis.localStorage.setItem(`${namespace}.${rel}`, value);
    }
  }
}

describe('namespaced web durable dump (product-harness clientKv)', () => {
  const previousLocal = globalThis.localStorage;
  const previousSession = globalThis.sessionStorage;
  let local: Storage;
  let session: Storage;

  beforeEach(() => {
    local = installMemoryStorage();
    session = installMemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: local,
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: session,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: previousLocal,
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: previousSession,
    });
  });

  it('round-trips session capability and kv across namespaces', async () => {
    const fromNs = 'harness_client_alice_e0';
    const toNs = 'harness_client_alice_e1';
    const secure = createNamespacedWebSecureStorage(fromNs);
    const kv = new KvImplWebNamespaced(fromNs);

    await secure.setItem('sessionToken', 'tok-abc');
    await secure.setItem('sessionExpiresAt', '2099-01-01T00:00:00.000Z');
    await secure.setItem('deviceId', 'dev-1');
    await secure.setItem('lastLocalAccountId', 'acct-1');
    await kv.put(
      asKeyword('playground.test/row'),
      asKeywordRecord({ 'playground.test/value': 'yes' }, 'durable test')
    );

    const dump = dumpClientDurable(fromNs);
    expect(dump['sessionToken']).toBe('tok-abc');
    expect(dump['deviceId']).toBe('dev-1');
    expect(dump['lastLocalAccountId']).toBe('acct-1');
    expect(dump['playground.test/row']).toBeDefined();

    clearNamespacedKvWeb(fromNs);
    clearNamespacedWebSecureStorage(fromNs);
    restoreClientDurable(toNs, dump);

    const restoredSecure = createNamespacedWebSecureStorage(toNs);
    const restoredKv = new KvImplWebNamespaced(toNs);
    expect(await restoredSecure.getItem('sessionToken')).toBe('tok-abc');
    expect(await restoredSecure.getItem('sessionExpiresAt')).toBe(
      '2099-01-01T00:00:00.000Z'
    );
    expect(await restoredSecure.getItem('deviceId')).toBe('dev-1');
    expect(await restoredSecure.getItem('lastLocalAccountId')).toBe('acct-1');
    expect(session.getItem(`${toNs}.lastLocalAccountId`)).toBe('acct-1');
    expect(local.getItem(`${toNs}.lastLocalAccountId`)).toBeNull();

    const row = await restoredKv.get(asKeyword('playground.test/row'));
    expect(row?.[asKeyword('playground.test/value')]).toBe('yes');
  });
});
