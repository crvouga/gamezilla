import {
  createContext,
  createElement,
  type ReactElement,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

import type { DevMenuPort, NetworkState, NetworkStatePort } from './ports';

const NetworkStateContext = createContext<NetworkStatePort | null>(null);
const DevMenuContext = createContext<DevMenuPort | null>(null);

let defaultNetwork: NetworkStatePort | null = null;
let defaultDevMenu: DevMenuPort | null = null;

function getDefaultNetwork(): NetworkStatePort {
  if (defaultNetwork === null) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createExpoNetworkStatePort } =
      require('./expo-network-state-port') as {
        createExpoNetworkStatePort: () => NetworkStatePort;
      };
    defaultNetwork = createExpoNetworkStatePort();
  }
  return defaultNetwork;
}

function getDefaultDevMenu(): DevMenuPort {
  if (defaultDevMenu === null) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createExpoDevMenuPort } = require('./expo-dev-menu-port') as {
      createExpoDevMenuPort: () => DevMenuPort;
    };
    defaultDevMenu = createExpoDevMenuPort();
  }
  return defaultDevMenu;
}

export function DevicePortsProvider({
  children,
  network,
  devMenu,
}: {
  children: ReactNode;
  network?: NetworkStatePort;
  devMenu?: DevMenuPort;
}): ReactElement {
  return createElement(
    NetworkStateContext.Provider,
    { value: network ?? null },
    createElement(DevMenuContext.Provider, { value: devMenu ?? null }, children)
  );
}

export function useNetworkStatePort(): NetworkStatePort {
  return useContext(NetworkStateContext) ?? getDefaultNetwork();
}

export function useDevMenuPort(): DevMenuPort {
  return useContext(DevMenuContext) ?? getDefaultDevMenu();
}

/** React hook mirroring `expo-network`'s `useNetworkState`. */
export function useNetworkState(): NetworkState {
  const port = useNetworkStatePort();
  const [snapshot, setSnapshot] = useState<NetworkState>({
    type: undefined,
    isConnected: undefined,
    isInternetReachable: undefined,
  });

  useEffect(() => {
    let cancelled = false;
    void port.getState().then((state) => {
      if (!cancelled) setSnapshot(state);
    });
    const unsub = port.subscribe((state) => {
      setSnapshot(state);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [port]);

  return snapshot;
}
