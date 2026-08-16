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
import type { SxProps } from '../../theme';
import { Box } from '../box';
import type { PortalHostFrame } from '../portal-host-frame';
import { ZERO_PORTAL_HOST_FRAME } from '../portal-host-frame';
import { usePortalHostFrameMeasure } from '../use-portal-host-frame';

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
const OverlayPortalHostFrameContext = createContext<PortalHostFrame>(
  ZERO_PORTAL_HOST_FRAME
);

/**
 * Sits above {@link DismissibleBannerPortalProvider} (which uses `999_999`)
 * so drag previews float above banners as well.
 * Absolute (not viewport-fixed) so hosts clip inside nested roots (playground panels).
 */
const OVERLAY_PORTAL_HOST_SX: SxProps = {
  absoluteFill: true,
  zIndex: 1_000_000,
};

function OverlayPortalHost({ store }: { store: PortalStore }) {
  const entries = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot
  );
  return (
    <Box
      pointerEvents="box-none"
      sx={OVERLAY_PORTAL_HOST_SX}
      collapsable={false}
    >
      {entries.map(([key, value]) => (
        <Fragment key={key}>{value}</Fragment>
      ))}
    </Box>
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
  const { hostRef, frame, onLayout } = usePortalHostFrameMeasure();

  return (
    <OverlayPortalContext.Provider value={api}>
      <OverlayPortalHostFrameContext.Provider value={frame}>
        <Box
          ref={hostRef}
          sx={{ flex: 1 }}
          collapsable={false}
          onLayout={onLayout}
        >
          {children}
          <OverlayPortalHost store={store} />
        </Box>
      </OverlayPortalHostFrameContext.Provider>
    </OverlayPortalContext.Provider>
  );
}

export function useOverlayPortal(): OverlayPortalApi | null {
  return useContext(OverlayPortalContext);
}

/**
 * Window frame of the overlay portal root (`measureInWindow`). Use to convert
 * window-space anchors into host-local coords for absolute paint.
 */
export function useOverlayPortalHostFrame(): PortalHostFrame {
  return useContext(OverlayPortalHostFrameContext);
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
