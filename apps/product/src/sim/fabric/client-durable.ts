/**
 * Namespaced web durable dumps for product-simulator client checkpoints.
 */

import { clearNamespacedAuthClientStorage } from '@pkgs/auth/client';
import {
  clearNamespacedKvWeb,
  dumpNamespacedKvWeb,
} from '@pkgs/kv-web/impl-kv-web-namespaced';
import { clearNamespacedWebSecureStorage } from '@pkgs/secure-storage-web';

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
    if (!key?.startsWith(prefix)) continue;
    const value = storage.getItem(key);
    if (value !== null) out[key.slice(prefix.length)] = value;
  }
  return out;
}

/** Auth + secure + kv under `namespace.` (localStorage + sessionStorage). */
export function dumpProductSimulatorClientDurable(
  namespace: string
): Record<string, string> {
  return {
    ...dumpNamespacedKvWeb(namespace),
    ...dumpStoragePrefix(globalThis.sessionStorage, namespace),
  };
}

/** Drop all namespaced web durable keys for a product-simulator client actor. */
export function clearProductSimulatorClientDurable(namespace: string): void {
  clearNamespacedKvWeb(namespace);
  clearNamespacedAuthClientStorage(namespace);
  clearNamespacedWebSecureStorage(namespace);
}

export function restoreProductSimulatorClientDurable(
  namespace: string,
  entries: Record<string, string>
): void {
  clearProductSimulatorClientDurable(namespace);
  const ls = globalThis.localStorage;
  const ss = globalThis.sessionStorage;
  for (const [rel, value] of Object.entries(entries)) {
    if (SESSION_SCOPED_DURABLE_KEYS.has(rel)) {
      ss.setItem(`${namespace}.${rel}`, value);
    } else {
      ls.setItem(`${namespace}.${rel}`, value);
    }
  }
}
