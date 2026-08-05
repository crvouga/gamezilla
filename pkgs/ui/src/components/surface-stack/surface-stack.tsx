/**
 * App-root host that stacks modal surfaces by open order.
 *
 * Each open surface registers a React subtree; later opens get a higher
 * z-index so nested confirms always paint above parent sheets — same path
 * on web and native (no RN `Modal`, no `Platform.OS` branching).
 */

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';

import {
  createSurfaceStackStore,
  type SurfaceStackStore,
} from './surface-stack-store';
import { SURFACE_STACK_BASE } from './constants';

export type SurfaceStackApi = {
  register: (id: string, node: ReactNode) => void;
  unregister: (id: string) => void;
  isTop: (id: string) => boolean;
  subscribe: (onStoreChange: () => void) => () => void;
};

const SurfaceStackContext = createContext<SurfaceStackApi | null>(null);
const SurfaceStackStoreContext = createContext<SurfaceStackStore | null>(null);

function SurfaceStackHost({ store }: { store: SurfaceStackStore }) {
  const entries = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot
  );
  return (
    <View pointerEvents="box-none" style={styles.host} collapsable={false}>
      {entries.map((entry) => (
        <View
          key={entry.id}
          pointerEvents="box-none"
          collapsable={false}
          style={[styles.layer, { zIndex: entry.zIndex }]}
        >
          {entry.node}
        </View>
      ))}
    </View>
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

  return (
    <SurfaceStackStoreContext.Provider value={store}>
      <SurfaceStackContext.Provider value={api}>
        <View style={styles.root} collapsable={false}>
          {children}
          <SurfaceStackHost store={store} />
        </View>
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  host: {
    ...StyleSheet.absoluteFillObject,
    // Above app chrome (top bar z≈3); individual layers add BASE+n.
    zIndex: SURFACE_STACK_BASE,
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
});
