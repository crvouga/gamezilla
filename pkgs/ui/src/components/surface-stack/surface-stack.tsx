/** @jsxImportSource solid-js */
/**
 * App-root host for stacked surfaces (modals, sheets). `<SurfaceStackSlot>`
 * teleports a surface into the host with a z-index derived from open order so
 * later surfaces always paint above earlier ones; `isTop` drives backdrop /
 * Escape ownership.
 */

import { createSubscriptionSignal } from '@pkgs/solid-context/subscription-signal';
import {
  type Accessor,
  createContext,
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  Show,
  useContext,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import {
  createHostFrame,
  type PortalHostFrame,
  ZERO_PORTAL_HOST_FRAME,
} from '../portal-host-frame';
import { SURFACE_STACK_BASE } from './constants';
import {
  createSurfaceStackStore,
  type SurfaceStackSnapshot,
  type SurfaceStackStore,
} from './surface-stack-store';

export type SurfaceStackApi = {
  readonly store: SurfaceStackStore;
  readonly snapshot: Accessor<SurfaceStackSnapshot>;
  readonly host: Accessor<HTMLElement | undefined>;
  readonly frame: Accessor<PortalHostFrame>;
};

const SurfaceStackContext = createContext<SurfaceStackApi | null>(null);

export type SurfaceStackProviderProps = {
  children: JSX.Element;
};

export function SurfaceStackProvider(
  props: SurfaceStackProviderProps
): JSX.Element {
  const store = createSurfaceStackStore();
  const [root, setRoot] = createSignal<HTMLElement>();
  const [host, setHost] = createSignal<HTMLElement>();
  const api: SurfaceStackApi = {
    store,
    snapshot: createSubscriptionSignal(store),
    host,
    frame: createHostFrame(root),
  };
  return (
    <SurfaceStackContext.Provider value={api}>
      <div
        class="box flex-1 relative overflow-hidden"
        data-component="SurfaceStackRoot"
        ref={setRoot}
      >
        {props.children}
        <div
          class="box absolute inset-0"
          classList={{ boxNone: true }}
          data-component="SurfaceStackHost"
          style={{ 'z-index': SURFACE_STACK_BASE }}
          ref={setHost}
        />
      </div>
    </SurfaceStackContext.Provider>
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

export function useSurfaceStackHostFrame(): Accessor<PortalHostFrame> {
  return (
    useContext(SurfaceStackContext)?.frame ?? (() => ZERO_PORTAL_HOST_FRAME)
  );
}

/** Static string or accessor (surface ids are usually fixed per component). */
export type SurfaceId = string | Accessor<string>;

function readId(id: SurfaceId): string {
  return typeof id === 'string' ? id : id();
}

export function useIsTopSurface(id: SurfaceId): Accessor<boolean> {
  const api = useContext(SurfaceStackContext);
  if (api === null) return () => false;
  return () => {
    const entries = api.snapshot();
    return entries[entries.length - 1]?.id === readId(id);
  };
}

export type SurfaceStackSlotState = {
  readonly isTop: Accessor<boolean>;
  readonly zIndex: Accessor<number>;
};

/**
 * Registers `id` while `visible()`; unregisters on hide / dispose. Throws when
 * a visible slot has no provider (surfaces must never silently render inline).
 */
export function useSurfaceStackSlot(
  id: SurfaceId,
  visible: Accessor<boolean>
): SurfaceStackSlotState {
  const api = useSurfaceStackOptional();
  createEffect(() => {
    if (!visible()) return;
    if (api === null) {
      throw new Error(
        'useSurfaceStackSlot: SurfaceStackProvider missing — wrap with AppUiPortals'
      );
    }
    const current = readId(id);
    api.store.register(current);
    onCleanup(() => api.store.unregister(current));
  });
  const isTop = useIsTopSurface(id);
  return {
    isTop: () => visible() && isTop(),
    zIndex: () => {
      if (api === null) return SURFACE_STACK_BASE;
      const entry = api.snapshot().find((e) => e.id === readId(id));
      return entry?.zIndex ?? SURFACE_STACK_BASE;
    },
  };
}

export type SurfaceStackSlotProps = {
  id: string;
  visible: boolean;
  children: JSX.Element;
};

/** Portal `children` into the stack host as an absolute-fill layer. */
export function SurfaceStackSlot(props: SurfaceStackSlotProps): JSX.Element {
  const api = useSurfaceStack();
  const slot = useSurfaceStackSlot(
    () => props.id,
    () => props.visible
  );
  return (
    <Show when={props.visible && api.host()}>
      {(host) => (
        <Portal mount={host()}>
          <div
            class="box absolute inset-0"
            classList={{ boxNone: true }}
            data-component="SurfaceStackLayer"
            data-surface={props.id}
            style={{ 'z-index': slot.zIndex() }}
          >
            {props.children}
          </div>
        </Portal>
      )}
    </Show>
  );
}
