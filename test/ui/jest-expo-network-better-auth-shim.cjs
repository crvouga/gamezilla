/**
 * Jest shim for Better Auth's dynamic `import('expo-network')` (ExpoOnlineManager).
 * Product code uses {@link NetworkStatePort} and does not import `expo-network`.
 * This file only exists so the third-party online manager gets a subscription
 * with `.remove()` under Jest (native Expo Network is unavailable).
 */

const NetworkStateType = {
  NONE: 'NONE',
  UNKNOWN: 'UNKNOWN',
  CELLULAR: 'CELLULAR',
  WIFI: 'WIFI',
  BLUETOOTH: 'BLUETOOTH',
  ETHERNET: 'ETHERNET',
  WIMAX: 'WIMAX',
  VPN: 'VPN',
  OTHER: 'OTHER',
};

const state = {
  type: NetworkStateType.WIFI,
  isConnected: true,
  isInternetReachable: true,
};

const listeners = new Set();

function useNetworkState() {
  return state;
}

async function getNetworkStateAsync() {
  return state;
}

function addNetworkStateListener(listener) {
  listeners.add(listener);
  listener(state);
  return {
    remove() {
      listeners.delete(listener);
    },
  };
}

module.exports = {
  __esModule: true,
  NetworkStateType,
  useNetworkState,
  getNetworkStateAsync,
  addNetworkStateListener,
};
