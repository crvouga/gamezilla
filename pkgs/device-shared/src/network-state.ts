/**
 * Network reachability port. The browser adapter
 * ({@link ./web-network-state.ts}) derives it from `navigator.onLine` +
 * `online` / `offline` events; harnesses use {@link createInMemoryNetworkStatePort}.
 */

export type NetworkStateType =
  | 'NONE'
  | 'UNKNOWN'
  | 'CELLULAR'
  | 'WIFI'
  | 'BLUETOOTH'
  | 'ETHERNET'
  | 'WIMAX'
  | 'VPN'
  | 'OTHER';

export const NetworkStateType = {
  NONE: 'NONE',
  UNKNOWN: 'UNKNOWN',
  CELLULAR: 'CELLULAR',
  WIFI: 'WIFI',
  BLUETOOTH: 'BLUETOOTH',
  ETHERNET: 'ETHERNET',
  WIMAX: 'WIMAX',
  VPN: 'VPN',
  OTHER: 'OTHER',
} as const satisfies Record<NetworkStateType, NetworkStateType>;

export type NetworkState = {
  readonly type: NetworkStateType | undefined;
  readonly isConnected: boolean | undefined;
  readonly isInternetReachable: boolean | null | undefined;
};

export type NetworkStatePort = {
  readonly getState: () => Promise<NetworkState>;
  /** Listener is invoked immediately with the current state, then on change. */
  readonly subscribe: (listener: (state: NetworkState) => void) => () => void;
};

export function networkStateWifi(): NetworkState {
  return { type: 'WIFI', isConnected: true, isInternetReachable: true };
}

export function networkStateNone(): NetworkState {
  return { type: 'NONE', isConnected: false, isInternetReachable: false };
}

export type InMemoryNetworkStatePort = NetworkStatePort & {
  /** Update without notifying (next `getState` sees it). */
  readonly setState: (next: NetworkState) => void;
  /** Update and notify subscribers. */
  readonly emit: (next: NetworkState) => void;
};

/** Harness / test {@link NetworkStatePort} with force-state knobs. */
export function createInMemoryNetworkStatePort(
  initial: NetworkState = networkStateWifi()
): InMemoryNetworkStatePort {
  let state = initial;
  const listeners = new Set<(s: NetworkState) => void>();
  return {
    getState: () => Promise.resolve(state),
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => {
        listeners.delete(listener);
      };
    },
    setState(next) {
      state = next;
    },
    emit(next) {
      state = next;
      for (const listener of [...listeners]) listener(state);
    },
  };
}
