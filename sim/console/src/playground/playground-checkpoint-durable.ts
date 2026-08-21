/**
 * Namespaced web durable dumps for playground client checkpoints.
 */

import { clearNamespacedAuthClientStorage } from '@pkgs/auth-better-auth/client';
import {
  clearNamespacedKvWeb,
  dumpNamespacedKvWeb,
} from '@pkgs/kv/impl-kv-web-namespaced';
import { clearNamespacedWebSecureStorage } from '@pkgs/secure-storage/impl-web';

/** Mirrors `@pkgs/secure-storage` session-scoped keys (tab-local). */
const SESSION_SCOPED_DURABLE_KEYS = new Set(['lastLocalAccountId']);

function dumpStoragePrefix(
  storage: Storage | undefined,
  namespace: string
): Record<string, string> {
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

/** Auth + secure + kv under `namespace.` (localStorage + sessionStorage). */
export function dumpPlaygroundClientDurable(
  namespace: string
): Record<string, string> {
  return {
    ...dumpNamespacedKvWeb(namespace),
    ...dumpStoragePrefix(globalThis.sessionStorage, namespace),
  };
}

/** Drop all namespaced web durable keys for a playground client actor. */
export function clearPlaygroundClientDurable(namespace: string): void {
  clearNamespacedKvWeb(namespace);
  clearNamespacedAuthClientStorage(namespace);
  clearNamespacedWebSecureStorage(namespace);
}

export function restorePlaygroundClientDurable(
  namespace: string,
  entries: Record<string, string>
): void {
  clearPlaygroundClientDurable(namespace);
  const ls = globalThis.localStorage;
  const ss = globalThis.sessionStorage;
  for (const [rel, value] of Object.entries(entries)) {
    if (SESSION_SCOPED_DURABLE_KEYS.has(rel)) {
      ss?.setItem(`${namespace}.${rel}`, value);
    } else {
      ls?.setItem(`${namespace}.${rel}`, value);
    }
  }
}
