// @io-wall-ok — Expo Network wall adapter (composition root only).
import * as ExpoNetwork from 'expo-network';

import type { NetworkState, NetworkStatePort, NetworkStateType } from './ports';

function mapType(raw: string | undefined): NetworkStateType | undefined {
  if (raw === undefined) return undefined;
  const allowed: readonly NetworkStateType[] = [
    'NONE',
    'UNKNOWN',
    'CELLULAR',
    'WIFI',
    'BLUETOOTH',
    'ETHERNET',
    'WIMAX',
    'VPN',
    'OTHER',
  ];
  return (allowed as readonly string[]).includes(raw)
    ? (raw as NetworkStateType)
    : 'OTHER';
}

function mapState(raw: {
  type?: string | undefined;
  isConnected?: boolean | undefined;
  isInternetReachable?: boolean | null | undefined;
}): NetworkState {
  return {
    type: mapType(raw.type),
    isConnected: raw.isConnected,
    isInternetReachable: raw.isInternetReachable,
  };
}

/** Production {@link NetworkStatePort} backed by `expo-network`. */
export function createExpoNetworkStatePort(): NetworkStatePort {
  return {
    async getState() {
      const state = await ExpoNetwork.getNetworkStateAsync();
      return mapState(state);
    },
    subscribe(listener) {
      const sub = ExpoNetwork.addNetworkStateListener((event) => {
        listener(mapState(event));
      });
      return () => {
        sub.remove();
      };
    },
  };
}
