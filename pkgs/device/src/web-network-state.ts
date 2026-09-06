/**
 * Browser {@link NetworkStatePort} over an injected event target so it is
 * testable without a DOM. {@link ./wall-web-device.ts} binds the real
 * `window` / `navigator`.
 */

import type {
  NetworkState,
  NetworkStatePort,
  NetworkStateType,
} from './network-state';

/** Subset of `navigator` (+ Network Information API when present). */
export type WebNavigatorLike = {
  readonly onLine?: boolean;
  readonly connection?: { readonly type?: string } | undefined;
};

/** Subset of `window` used for `online` / `offline` events. */
export type WebEventTargetLike = {
  addEventListener(type: 'online' | 'offline', listener: () => void): void;
  removeEventListener(type: 'online' | 'offline', listener: () => void): void;
};

const CONNECTION_TYPES: Readonly<Record<string, NetworkStateType>> = {
  none: 'NONE',
  unknown: 'UNKNOWN',
  cellular: 'CELLULAR',
  wifi: 'WIFI',
  bluetooth: 'BLUETOOTH',
  ethernet: 'ETHERNET',
  wimax: 'WIMAX',
  other: 'OTHER',
};

export function readWebNetworkState(nav: WebNavigatorLike): NetworkState {
  const online = nav.onLine !== false;
  const rawType = nav.connection?.type;
  const type: NetworkStateType | undefined = !online
    ? 'NONE'
    : rawType === undefined
      ? 'UNKNOWN'
      : (CONNECTION_TYPES[rawType] ?? 'OTHER');
  return {
    type,
    isConnected: online,
    // Browsers only expose link state; reachability is unknown while online.
    isInternetReachable: online ? null : false,
  };
}

export function createWebNetworkStatePort(target: {
  readonly navigator: WebNavigatorLike;
  readonly events: WebEventTargetLike;
}): NetworkStatePort {
  const listeners = new Set<(s: NetworkState) => void>();
  let attached = false;
  const notify = (): void => {
    const state = readWebNetworkState(target.navigator);
    for (const listener of [...listeners]) listener(state);
  };
  const attach = (): void => {
    if (attached) return;
    attached = true;
    target.events.addEventListener('online', notify);
    target.events.addEventListener('offline', notify);
  };
  const detach = (): void => {
    if (!attached || listeners.size > 0) return;
    attached = false;
    target.events.removeEventListener('online', notify);
    target.events.removeEventListener('offline', notify);
  };
  return {
    getState: () => Promise.resolve(readWebNetworkState(target.navigator)),
    subscribe(listener) {
      listeners.add(listener);
      attach();
      listener(readWebNetworkState(target.navigator));
      return () => {
        listeners.delete(listener);
        detach();
      };
    },
  };
}
