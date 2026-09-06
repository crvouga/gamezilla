/**
 * App-root host that stacks modal surfaces by open order.
 *
 * Each open surface registers a React subtree; later opens get a higher
 * z-index so nested confirms always paint above parent sheets — same path
 * on web and native (no RN `Modal`, no `Platform.OS` branching).
 */

import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { Box } from '../box';
import type { PortalHostFrame } from '../portal-host-frame';
import { ZERO_PORTAL_HOST_FRAME } from '../portal-host-frame';
import { usePortalHostFrameMeasure } from '../use-portal-host-frame';
import { SURFACE_STACK_BASE } from './constants';
import {
  createSurfaceStackStore,
  type SurfaceStackStore,
} from './surface-stack-store';

export type SurfaceStackApi = {
  register: (id: string, node: ReactNode) => void;
  unregister: (id: string) => void;
  isTop: (id: string) => boolean;
  subscribe: (onStoreChange: () => void) => () => void;
};

const SurfaceStackContext = createContext<SurfaceStackApi | null>(null);
const SurfaceStackStoreContext = createContext<SurfaceStackStore | null>(null);
const SurfaceStackHostFrameContext = createContext<PortalHostFrame>(
  ZERO_PORTAL_HOST_FRAME
);

function SurfaceStackHost({ store }: { store: SurfaceStackStore }) {
  const entries = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot
  );
  return (
    <Box
      pointerEvents="box-none"
      collapsable={false}
      sx={{ absoluteFill: true, zIndex: SURFACE_STACK_BASE }}
    >
      {entries.map((entry) => (
        <Box
          key={entry.id}
          pointerEvents="box-none"
          collapsable={false}
          sx={{ absoluteFill: true, zIndex: entry.zIndex }}
        >
          {entry.node}
        </Box>
      ))}
    </Box>
  );
}

export type SurfaceStackProviderProps = {
  children: ReactNode;
};

export function SurfaceStackProvider({
  children,
}: SurfaceStackProviderProps): ReactNode {
  const store = useMemo(() => createSurfaceStackStore(), []);
  const api = useMemo(
    (): SurfaceStackApi => ({
      register: store.register,
      unregister: store.unregister,
      isTop: store.isTop,
      subscribe: store.subscribe,
    }),
    [store]
  );
  const { hostRef, frame, onLayout } = usePortalHostFrameMeasure();

  return (
    <SurfaceStackStoreContext.Provider value={store}>
      <SurfaceStackContext.Provider value={api}>
        <SurfaceStackHostFrameContext.Provider value={frame}>
          <Box
            ref={hostRef}
            sx={{
              flex: 1,
              position: 'relative',
              overflow: 'hidden',
            }}
            collapsable={false}
            onLayout={onLayout}
          >
            {children}
            <SurfaceStackHost store={store} />
          </Box>
        </SurfaceStackHostFrameContext.Provider>
      </SurfaceStackContext.Provider>
    </SurfaceStackStoreContext.Provider>
  );
}

export function useSurfaceStack(): SurfaceStackApi {
  const api = useContext(SurfaceStackContext);
  if (api === null) {
    throw new Error(
      'useSurfaceStack: SurfaceStackProvider missing — wrap with AppUiPortals'
    );
  }
  return api;
}

export function useSurfaceStackOptional(): SurfaceStackApi | null {
  return useContext(SurfaceStackContext);
}

/**
 * Window frame of the surface-stack root (`measureInWindow`). Use to convert
 * window-space anchors into host-local coords for absolute paint.
 */
export function useSurfaceStackHostFrame(): PortalHostFrame {
  return useContext(SurfaceStackHostFrameContext);
}

/** True when `id` is the topmost open surface (owns back / escape dismiss). */
export function useIsTopSurface(id: string): boolean {
  const store = useContext(SurfaceStackStoreContext);
  return useSyncExternalStore(
    store?.subscribe ?? subscribeNoop,
    () => (store === null ? false : store.isTop(id)),
    () => false
  );
}

function subscribeNoop(): () => void {
  return () => undefined;
}

/**
 * Registers `node` under a stable id while `visible`. Unregisters on hide /
 * unmount. Node updates re-register in place (no unregister cleanup) so chrome
 * changes do not bump the surface to the top of the stack.
 */
export function useSurfaceStackSlot(
  id: string,
  node: ReactNode,
  visible: boolean
): { isTop: boolean } {
  const api = useSurfaceStackOptional();
  if (visible && api === null) {
    throw new Error(
      'useSurfaceStackSlot: SurfaceStackProvider missing — wrap with AppUiPortals'
    );
  }
  useLayoutEffect(() => {
    if (api === null) return;
    if (!visible) {
      api.unregister(id);
      return;
    }
    api.register(id, node);
  }, [api, id, node, visible]);

  useLayoutEffect(() => {
    return () => {
      api?.unregister(id);
    };
  }, [api, id]);

  const isTop = useIsTopSurface(id);
  return { isTop: visible && isTop };
}
