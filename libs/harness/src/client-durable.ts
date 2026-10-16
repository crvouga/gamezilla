/**
 * Namespaced web durable dumps for product-harness client checkpoints.
 */

import { clearNamespacedAuthClientStorage } from '@pkgs/auth-inhouse-client/bearer-token-storage-web';
import {
  clearNamespacedKvWeb,
  dumpNamespacedKvWeb,
} from '@pkgs/kv-web-client/impl-kv-web-namespaced';
import { clearNamespacedWebSecureStorage } from '@pkgs/secure-storage-web-client/impl-web';

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
export function dumpProductHarnessClientDurable(
  namespace: string
): Record<string, string> {
  return {
    ...dumpNamespacedKvWeb(namespace),
    ...dumpStoragePrefix(globalThis.sessionStorage, namespace),
  };
}

/** Drop all namespaced web durable keys for a product-harness client actor. */
export function clearProductHarnessClientDurable(namespace: string): void {
  clearNamespacedKvWeb(namespace);
  clearNamespacedAuthClientStorage(namespace);
  clearNamespacedWebSecureStorage(namespace);
}

export function restoreProductHarnessClientDurable(
  namespace: string,
  entries: Record<string, string>
): void {
  clearProductHarnessClientDurable(namespace);
  const ls = globalThis.localStorage;
  for (const [rel, value] of Object.entries(entries)) {
    ls.setItem(`${namespace}.${rel}`, value);
  }
}
