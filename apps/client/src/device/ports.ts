/**
 * Device / platform ports for the client composition root.
 * Production wall adapters are the only modules that import platform APIs.
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
  readonly subscribe: (listener: (state: NetworkState) => void) => () => void;
};

export type DevMenuItem = {
  readonly name: string;
  readonly callback: () => void;
  readonly shouldCollapse?: boolean;
};

export type DevMenuPort = {
  readonly registerItems: (items: readonly DevMenuItem[]) => Promise<void>;
};
