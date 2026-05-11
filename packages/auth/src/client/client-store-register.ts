import type { ClientStore } from './client-store-context';

let registered: ClientStore | null = null;

/** Registered by the Expo app data-plane provider for non-React call sites. */
export function registerClientStore(store: ClientStore | null): void {
  registered = store;
}

export function getRegisteredClientStore(): ClientStore {
  if (registered === null) {
    throw new Error(
      'Client data plane not mounted — registerClientStore was not called (missing ClientDataPlaneProvider?)'
    );
  }
  return registered;
}
