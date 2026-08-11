/** Native-free expo-network surface for Jest. */

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

function useNetworkState() {
  return {
    type: NetworkStateType.WIFI,
    isConnected: true,
    isInternetReachable: true,
  };
}

async function getNetworkStateAsync() {
  return useNetworkState();
}

function addNetworkStateListener(_listener) {
  return { remove: () => undefined };
}

module.exports = {
  __esModule: true,
  NetworkStateType,
  useNetworkState,
  getNetworkStateAsync,
  addNetworkStateListener,
};
