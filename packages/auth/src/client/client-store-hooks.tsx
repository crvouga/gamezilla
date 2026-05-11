import { useMemo, useSyncExternalStore } from 'react';

import { useClientStore } from './client-store-context';

export function useLogger(name: string) {
  const store = useClientStore();
  return useMemo(() => store.getLogger().child({ name }), [store, name]);
}

export function useSecureStorage() {
  const store = useClientStore();
  return useMemo(() => store.getSecureStorage(), [store]);
}

export function useKeyValueStorage() {
  const store = useClientStore();
  return useMemo(() => store.getKeyValueStorage(), [store]);
}

export function useSessionToken(): string | null {
  const store = useClientStore();
  return useSyncExternalStore(
    store.subscribe,
    () => store.getSessionToken(),
    () => store.getSessionToken()
  );
}
