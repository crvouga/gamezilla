/** @jsxImportSource solid-js */
/** Solid contexts for the device ports carried on `ClientEnv`. */

import type { DevMenuPort } from '@apps/client/device/ports';
import type { NetworkStatePort } from '@pkgs/device/network-state';
import { defineContext } from '@pkgs/solid-context/define-context';
import { type JSX, untrack } from 'solid-js';

const NetworkStateContext = defineContext<NetworkStatePort>('NetworkState');
const DevMenuContext = defineContext<DevMenuPort>('DevMenu');

export function DevicePortsProvider(props: {
  readonly network: NetworkStatePort;
  readonly devMenu: DevMenuPort;
  readonly children: JSX.Element;
}): JSX.Element {
  // Composition-root configuration: read once, not tracked.
  const network = untrack(() => props.network);
  const devMenu = untrack(() => props.devMenu);
  return (
    <NetworkStateContext.Provider value={network}>
      <DevMenuContext.Provider value={devMenu}>
        {props.children}
      </DevMenuContext.Provider>
    </NetworkStateContext.Provider>
  );
}

export function useNetworkStatePort(): NetworkStatePort {
  return NetworkStateContext.use();
}

export function useDevMenuPort(): DevMenuPort {
  return DevMenuContext.use();
}
