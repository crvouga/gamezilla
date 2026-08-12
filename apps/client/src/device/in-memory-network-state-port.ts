import type { NetworkState, NetworkStatePort } from './ports';

export type InMemoryNetworkStatePort = NetworkStatePort & {
  readonly setState: (next: NetworkState) => void;
  readonly emit: (next: NetworkState) => void;
};

const DEFAULT_STATE: NetworkState = {
  type: 'WIFI',
  isConnected: true,
  isInternetReachable: true,
};

/** Sim / test {@link NetworkStatePort} with force-state knobs. */
export function createInMemoryNetworkStatePort(
  initial: NetworkState = DEFAULT_STATE
): InMemoryNetworkStatePort {
  let state = initial;
  const listeners = new Set<(s: NetworkState) => void>();

  function publish(next: NetworkState): void {
    state = next;
    for (const listener of [...listeners]) {
      listener(state);
    }
  }

  return {
    async getState() {
      return state;
    },
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
      publish(next);
    },
  };
}

export function networkStateWifi(): NetworkState {
  return {
    type: 'WIFI',
    isConnected: true,
    isInternetReachable: true,
  };
}

export function networkStateNone(): NetworkState {
  return {
    type: 'NONE',
    isConnected: false,
    isInternetReachable: false,
  };
}
