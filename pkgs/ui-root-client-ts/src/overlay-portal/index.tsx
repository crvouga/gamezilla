/** @jsxImportSource solid-js */

import { layer } from '@pkgs/ui-root-shared-ts/layers';
import {
  type Accessor,
  createContext,
  createSignal,
  type JSX,
  Show,
  useContext,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import type { PortalHostFrame } from '../portal-host-frame';
import { createHostFrame, ZERO_PORTAL_HOST_FRAME } from '../portal-host-frame';

export type OverlayPortalApi = {
  /** Host layer element; `undefined` until the provider has mounted. */
  readonly host: Accessor<HTMLElement | undefined>;
  /** Window frame of the provider root (for window → host-local math). */
  readonly frame: Accessor<PortalHostFrame>;
};

const OverlayPortalContext = createContext<OverlayPortalApi | null>(null);

/**
 * Absolute fill above app chrome (not viewport-fixed) so hosts clip inside
 * nested roots (product-harness panels). Banners are in-flow layout slots, not
 * stacked above this host.
 */
export const OVERLAY_PORTAL_Z_INDEX = layer.overlay;

export type OverlayPortalProviderProps = {
  children: JSX.Element;
};

/**
 * Overlay portal that renders content above the entire app (above
 * surface-stack modals, bottom sheets, banners, etc.).
 *
 * Use it when a node needs to follow a pointer across stacking contexts (drag
 * previews, picker tooltips, top-of-app spinners). A single host layer is
 * mounted at the provider; `<OverlayPortal>` teleports its children into it.
 *
 * Mount **outside** `SurfaceStackProvider` so surface chrome (rendered in the
 * stack host) still resolves this context.
 */
export function OverlayPortalProvider(
  props: OverlayPortalProviderProps
): JSX.Element {
  const [root, setRoot] = createSignal<HTMLElement>();
  const [host, setHost] = createSignal<HTMLElement>();
  const api: OverlayPortalApi = { host, frame: createHostFrame(root) };
  return (
    <OverlayPortalContext.Provider value={api}>
      <div
        class="box flex-1 min-w-0 w-full max-w-full relative"
        data-component="OverlayPortalRoot"
        style={{ overflow: 'clip' }}
        ref={setRoot}
      >
        {props.children}
        <div
          class="box absolute inset-0"
          classList={{ boxNone: true }}
          data-component="OverlayPortalHost"
          style={{ 'z-index': OVERLAY_PORTAL_Z_INDEX }}
          ref={setHost}
        />
      </div>
    </OverlayPortalContext.Provider>
  );
}

export function useOverlayPortal(): OverlayPortalApi | null {
  return useContext(OverlayPortalContext);
}

export function useOverlayPortalHostFrame(): Accessor<PortalHostFrame> {
  return (
    useContext(OverlayPortalContext)?.frame ?? (() => ZERO_PORTAL_HOST_FRAME)
  );
}

export type OverlayPortalProps = {
  /** Render nothing when `false`. Default `true`. */
  when?: boolean | undefined;
  children: JSX.Element;
};

/**
 * Teleports `children` into the overlay host. Renders inline (no portal) when
 * no provider is mounted so standalone usage still works.
 */
export function OverlayPortal(props: OverlayPortalProps): JSX.Element {
  const api = useOverlayPortal();
  return (
    <Show when={props.when ?? true}>
      <Show when={api?.host()} fallback={props.children}>
        {(host) => <Portal mount={host()}>{props.children}</Portal>}
      </Show>
    </Show>
  );
}
