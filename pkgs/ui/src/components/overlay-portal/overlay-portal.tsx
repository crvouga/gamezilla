/**
 * Lightweight overlay portal that renders content above the entire app
 * (above surface-stack modals, bottom sheets, banners, etc.).
 *
 * Use it when a node needs to follow a pointer/cursor across stacking contexts
 * (e.g. drag previews, picker tooltips, top-of-app spinners).
 *
 * Pattern mirrors {@link DismissibleBannerPortalProvider}: a single host view
 * is mounted at the app root and consumers register/unregister React subtrees
 * by id via `useOverlayPortal()`.
 *
 * Mount **outside** {@link SurfaceStackProvider} (see `AppUiPortals`): surface
 * chrome renders in the stack host, sibling of provider `children`, so it only
 * keeps this context when Overlay wraps Surface.
 */

import {
  createContext,
  Fragment,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import {
  Platform,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

type PortalEntry = readonly [string, ReactNode];
type PortalSnapshot = ReadonlyArray<PortalEntry>;

type PortalStore = {
  subscribe: (onStoreChange: () => void) => () => void;
  getSnapshot: () => PortalSnapshot;
  register: (id: string, node: ReactNode) => void;
  unregister: (id: string) => void;
};

const EMPTY_SNAPSHOT: PortalSnapshot = Object.freeze([]);

function createOverlayPortalStore(): PortalStore {
  let snapshot: PortalSnapshot = EMPTY_SNAPSHOT;
  const map = new Map<string, ReactNode>();
  const listeners = new Set<() => void>();

  const recompute = (): void => {
    snapshot = Object.freeze([...map.entries()]);
    listeners.forEach((l) => {
      l();
    });
  };

  return {
    subscribe: (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },
    getSnapshot: () => snapshot,
    register: (id, node) => {
      const existing = map.get(id);
      if (existing === node) return;
      map.set(id, node);
      recompute();
    },
    unregister: (id) => {
      if (map.delete(id)) {
        recompute();
      }
    },
  };
}

export type OverlayPortalApi = {
  register: (id: string, node: ReactNode) => void;
  unregister: (id: string) => void;
};

const OverlayPortalContext = createContext<OverlayPortalApi | null>(null);

/**
 * Sits above {@link DismissibleBannerPortalProvider} (which uses `999_999`)
 * so drag previews float above banners as well.
 */
const OVERLAY_PORTAL_HOST_STYLE: StyleProp<ViewStyle> =
  Platform.OS === 'web'
    ? [
        StyleSheet.absoluteFill,
        { zIndex: 1_000_000 },
        {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
        } as unknown as ViewStyle,
      ]
    : [StyleSheet.absoluteFill, { zIndex: 1_000_000 }];

function OverlayPortalHost({ store }: { store: PortalStore }) {
  const entries = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot
  );
  return (
    <View
      pointerEvents="box-none"
      style={OVERLAY_PORTAL_HOST_STYLE}
      collapsable={false}
    >
      {entries.map(([key, value]) => (
        <Fragment key={key}>{value}</Fragment>
      ))}
    </View>
  );
}

export type OverlayPortalProviderProps = {
  children: ReactNode;
};

export function OverlayPortalProvider({
  children,
}: OverlayPortalProviderProps) {
  const store = useMemo(() => createOverlayPortalStore(), []);
  const api = useMemo(
    (): OverlayPortalApi => ({
      register: store.register,
      unregister: store.unregister,
    }),
    [store]
  );

  return (
    <OverlayPortalContext.Provider value={api}>
      <View style={{ flex: 1 }} collapsable={false}>
        {children}
        <OverlayPortalHost store={store} />
      </View>
    </OverlayPortalContext.Provider>
  );
}

export function useOverlayPortal(): OverlayPortalApi | null {
  return useContext(OverlayPortalContext);
}

/**
 * Convenience hook: registers `node` under a stable id and unregisters on
 * unmount. Pass `null` for `node` to keep the slot reserved without rendering.
 */
export function useOverlayPortalSlot(
  id: string,
  node: ReactNode,
  enabled: boolean = true
): void {
  const portal = useOverlayPortal();
  useLayoutEffect(() => {
    if (portal === null) return;
    if (!enabled) {
      portal.unregister(id);
      return;
    }
    portal.register(id, node);
    return () => {
      portal.unregister(id);
    };
  }, [portal, id, node, enabled]);
}
