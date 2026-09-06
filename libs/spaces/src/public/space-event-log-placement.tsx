/**
 * Wide active-space body may host an optional side rail for game chrome.
 * The event log lives in the space header; games inject extras into the rail
 * via {@link SpaceSideRailExtras}.
 */

import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';

type SideRailBridge = {
  set: (node: ReactNode) => void;
  subscribe: (onStoreChange: () => void) => () => void;
  getVersion: () => number;
  getNode: () => ReactNode;
};

function createSideRailBridge(): SideRailBridge {
  let node: ReactNode = null;
  let version = 0;
  const listeners = new Set<() => void>();
  return {
    set(next) {
      node = next;
      version += 1;
      for (const listener of listeners) listener();
    },
    subscribe(onStoreChange) {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },
    getVersion() {
      return version;
    },
    getNode() {
      return node;
    },
  };
}

type SpaceSideRailValue = {
  readonly extras: ReactNode;
  readonly setExtras: (node: ReactNode) => void;
};

const SpaceSideRailContext = createContext<SpaceSideRailValue | null>(null);

export type SpaceSideRailProviderProps = {
  readonly children: ReactNode;
};

export function SpaceSideRailProvider({
  children,
}: SpaceSideRailProviderProps): ReactNode {
  const [extras, setExtras] = useState<ReactNode>(null);
  const value = useMemo(
    (): SpaceSideRailValue => ({ extras, setExtras }),
    [extras]
  );
  return (
    <SpaceSideRailContext.Provider value={value}>
      {children}
    </SpaceSideRailContext.Provider>
  );
}

export function useSpaceSideRailExtras(): ReactNode {
  return useContext(SpaceSideRailContext)?.extras ?? null;
}

function SpaceSideRailExtrasHost({
  bridge,
}: {
  bridge: SideRailBridge;
}): ReactNode {
  useSyncExternalStore(bridge.subscribe, bridge.getVersion, bridge.getVersion);
  return bridge.getNode();
}

/**
 * Publish nodes into the wide side rail. Cleared on unmount. No-op outside
 * {@link SpaceSideRailProvider} / compact layouts.
 */
export function SpaceSideRailExtras({
  children,
}: {
  readonly children: ReactNode;
}): null {
  const ctx = useContext(SpaceSideRailContext);
  const bridge = useMemo(() => createSideRailBridge(), []);

  useLayoutEffect(() => {
    if (ctx === null) return;
    ctx.setExtras(<SpaceSideRailExtrasHost bridge={bridge} />);
    return () => ctx.setExtras(null);
  }, [ctx, bridge]);

  useLayoutEffect(() => {
    bridge.set(children);
  });

  return null;
}
