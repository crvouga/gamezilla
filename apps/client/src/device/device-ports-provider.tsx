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

export function DevicePortsProvider({
  children,
  network,
  devMenu,
}: {
  children: ReactNode;
  network: NetworkStatePort;
  devMenu: DevMenuPort;
}): ReactElement {
  return createElement(
    NetworkStateContext.Provider,
    { value: network },
    createElement(DevMenuContext.Provider, { value: devMenu }, children)
  );
}

export function useNetworkStatePort(): NetworkStatePort {
  const port = useContext(NetworkStateContext);
  if (port === null) {
    throw new Error(
      'useNetworkStatePort: DevicePortsProvider missing — wrap with createClient / AppShellProvider'
    );
  }
  return port;
}

export function useDevMenuPort(): DevMenuPort {
  const port = useContext(DevMenuContext);
  if (port === null) {
    throw new Error(
      'useDevMenuPort: DevicePortsProvider missing — wrap with createClient / AppShellProvider'
    );
  }
  return port;
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
