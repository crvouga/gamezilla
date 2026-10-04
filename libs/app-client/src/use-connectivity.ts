/**
 * Reactive connectivity derived from the injected `NetworkStatePort`
 * (`env.network`) and the sync engine status — no direct `navigator.onLine`.
 */

import type { NetworkState } from '@pkgs/device-shared/network-state';
import type { StatusDotStatus } from '@pkgs/ui-client/status-dot';
import { type Accessor, createSignal, onCleanup } from 'solid-js';

import { useNetworkStatePort } from './device-ports-context';
import { resolveConnectivityStatus } from './resolve-connectivity-status';
import { useSyncStatus } from './sync-status-context';

function isOnline(state: NetworkState): boolean {
  // Unknown reachability counts as online (RN parity: `navigator.onLine !== false`).
  return state.isConnected !== false && state.isInternetReachable !== false;
}

/** True unless the network port reports the device offline. */
export function createNetworkOnline(): Accessor<boolean> {
  const network = useNetworkStatePort();
  const [online, setOnline] = createSignal(true);
  const unsubscribe = network.subscribe((state) => setOnline(isOnline(state)));
  onCleanup(unsubscribe);
  return online;
}

export type Connectivity = {
  readonly online: Accessor<boolean>;
  readonly status: Accessor<StatusDotStatus>;
  readonly syncError: Accessor<boolean>;
};

export function createConnectivity(): Connectivity {
  const online = createNetworkOnline();
  const syncStatus = useSyncStatus();
  const syncError = (): boolean => {
    const error = syncStatus().lastError;
    return error !== null && error.length > 0;
  };
  const status = (): StatusDotStatus => {
    const sync = syncStatus();
    return resolveConnectivityStatus({
      browserOnline: online(),
      syncOnline: sync.online,
      syncError: syncError(),
      connection: sync.connection,
      hasSynced: sync.hasSynced,
    });
  };
  return { online, status, syncError };
}
