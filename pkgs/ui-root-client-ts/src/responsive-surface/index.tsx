/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { cssPx } from '@pkgs/ui-root-shared-ts/css-px';
import type { ModalSize } from '@pkgs/ui-root-shared-ts/modal-size';
import { type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import {
  CONTENT_EDGE_PADDING_STEP,
  ContentEdgePaddingProvider,
  SURFACE_BOTTOM_PADDING_STEP,
} from '../content-edge-padding/index';
import { useBottomSheetHost } from '../context/index';
import { ModalBackdrop } from '../modal-backdrop/index';
import { ModalContent, useModalContentMaxHeight } from '../modal-content/index';
import { ModalRoot } from '../modal-root/index';
import { OnColorReset } from '../on-color-context/index';
import {
  createPendingOperationScope,
  PendingOperationScopeContext,
  useConfirmNavigation,
} from '../pending-navigation';
import { ResponsiveSurfaceHeader } from '../responsive-surface-header/index';
import { ScrollView } from '../scroll-view/index';
import type { ResponsiveSurfacePresentation } from '../should-use-mobile-sheet';
import { shouldUseMobileSheet } from '../should-use-mobile-sheet';
import { useLayoutMode } from '../use-layout-mode';

export type ResponsiveSurfaceProps = {
  visible: boolean;
  onClose: () => void;
  /**
   * When `true` (default), show the close icon and dismiss on backdrop /
   * Escape. When `false`, the surface stays until the app closes it.
   */
  closable?: boolean | undefined;
  /** Optional title row above `children`; also names the dialog. */
  title?: JSX.Element | undefined;
  /** Centered modal width bucket on wide layouts. Default `medium`. */
  size?: ModalSize | undefined;
  /** Max height of centered modal content in px (wide layouts only). */
  maxHeight?: number | undefined;
  /** Default `'responsive'`. */
  presentation?: ResponsiveSurfacePresentation | undefined;
  /**
   * Fixed pixel height for the body region (everything below the title). Use
   * when the body's content can swap between payloads of varying height so
   * the surface keeps a stable shape. Overflowing children are clipped; they
   * should provide their own internal scroll. Implies `scroll={false}`.
   */
  bodyHeight?: number | undefined;
  /**
   * When `true` (default), the body scrolls under a pinned header. When
   * `false`, the surface is a fixed flex column (overflow clipped); nest a
   * list scroller in `children` instead. Never nest a surface scroll with an
   * inner list scroll.
   */
  scroll?: boolean | undefined;
  /**
   * Stable id for the surface stack. Use for surfaces that remount while
   * overlays stay open so they restore under the overlay instead of stealing
   * the top slot.
   */
  stackId?: string | undefined;
  /** Accessible name fallback when `title` is omitted. */
  label?: string | undefined;
  /** `data-*` identifiers for the header close control. */
  closeDataSet?: ComponentDataSet | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
  children?: JSX.Element | undefined;
};

function SurfaceBody(props: {
  bodyHeight: number | undefined;
  fill: boolean;
  children: JSX.Element;
}): JSX.Element {
  return (
    <Show
      when={props.bodyHeight}
      fallback={
        <Show when={props.fill} fallback={props.children}>
          <div class="box flex-1 min-h-0 shrink overflow-hidden">
            {props.children}
          </div>
        </Show>
      }
    >
      {(bodyHeight) => (
        <div
          class="box overflow-hidden"
          style={{ height: cssPx(bodyHeight()) }}
        >
          {props.children}
        </div>
      )}
    </Show>
  );
}

/** True when the surface owns a body ScrollView (header stays pinned). */
function surfaceScrolls(surface: ResponsiveSurfaceProps): boolean {
  return surface.bodyHeight === undefined && (surface.scroll ?? true);
}

/**
 * Pinned header + scrollable (or fixed) body.
 *
 * When scrolling, the shell is a two-row grid (`auto` / `minmax(0, 1fr)`)
 * capped by `maxHeight` (desktop) or by filling a height-clamped sheet
 * parent (`grow` + `min-h-0`). The body {@link ScrollView} is edge-to-edge
 * so the scrollbar tracks the modal frame; horizontal + bottom padding live
 * on {@link ScrollView} content. The header keeps its own inset so title/close
 * stay aligned with body copy.
 */
function SurfaceChrome(props: {
  surface: ResponsiveSurfaceProps;
  maxHeight: number | undefined;
}): JSX.Element {
  const scroll = (): boolean => surfaceScrolls(props.surface);
  const shellStyle = (): JSX.CSSProperties =>
    props.maxHeight === undefined
      ? {}
      : { 'max-height': cssPx(props.maxHeight) };
  const header = (): JSX.Element => (
    <ResponsiveSurfaceHeader
      title={props.surface.title}
      onClose={props.surface.onClose}
      closable={props.surface.closable}
      closeDataSet={props.surface.closeDataSet}
    />
  );
  return (
    <ContentEdgePaddingProvider
      step={CONTENT_EDGE_PADDING_STEP}
      bottomStep={SURFACE_BOTTOM_PADDING_STEP}
    >
      <OnColorReset>
        <div
          class="box grow shrink min-h-0 overflow-hidden w-full"
          classList={{
            'px-4 pt-4 pb-6': !scroll(),
            // Grid, not `.box` flex: the reliable scrollport host.
            surfaceScrollShell: scroll(),
          }}
          data-component="ResponsiveSurfaceChrome"
          style={shellStyle()}
        >
          <Show
            when={scroll()}
            fallback={
              <>
                {header()}
                <SurfaceBody
                  bodyHeight={props.surface.bodyHeight}
                  fill={
                    props.surface.bodyHeight !== undefined ||
                    props.surface.scroll === false
                  }
                >
                  {props.surface.children}
                </SurfaceBody>
              </>
            }
          >
            <div
              class="box px-4 pt-4"
              data-component="ResponsiveSurfaceHeaderPad"
            >
              {header()}
            </div>
            <ScrollView
              flushEdge={false}
              height="full"
              paddingX="lg"
              paddingBottom="xl"
            >
              {props.surface.children}
            </ScrollView>
          </Show>
        </div>
      </OnColorReset>
    </ContentEdgePaddingProvider>
  );
}

function DesktopModal(props: ResponsiveSurfaceProps): JSX.Element {
  const maxHeight = useModalContentMaxHeight(() => props.maxHeight);
  const closable = (): boolean => props.closable ?? true;
  const requestClose = (): void => {
    if (closable()) props.onClose();
  };
  return (
    <ModalRoot
      visible={props.visible}
      onRequestClose={requestClose}
      stackId={props.stackId}
      label={props.label}
    >
      <ModalBackdrop
        onClick={requestClose}
        dismissOnBackdrop={closable()}
        dataSet={{ component: 'ResponsiveSurface', ...props.dataSet }}
      >
        <ModalContent
          size={props.size ?? 'medium'}
          padded={false}
          maxHeight={props.maxHeight}
        >
          <SurfaceChrome surface={props} maxHeight={maxHeight()} />
        </ModalContent>
      </ModalBackdrop>
    </ModalRoot>
  );
}

function MobileSheet(props: ResponsiveSurfaceProps): JSX.Element {
  const host = useBottomSheetHost();
  const closable = (): boolean => props.closable ?? true;
  const requestClose = (): void => {
    if (closable()) props.onClose();
  };
  return (
    <Dynamic
      component={host.Sheet}
      open={props.visible}
      onClose={requestClose}
      stackId={props.stackId}
      label={props.label}
      dataSet={{ component: 'ResponsiveSurface', ...props.dataSet }}
    >
      {/* Sheet/FocusTrap clamp height; chrome fills and grids the body. */}
      <SurfaceChrome surface={props} maxHeight={undefined} />
    </Dynamic>
  );
}

/**
 * `ResponsiveSurface` -- overlay that uses a bottom sheet on compact layouts
 * and a centered modal on wide ones ({@link useLayoutMode}). Pass
 * `presentation="modal"` to always use the centered modal.
 *
 * Content uses {@link CONTENT_EDGE_PADDING_STEP} horizontal inset and
 * {@link SURFACE_BOTTOM_PADDING_STEP} bottom inset via
 * {@link ContentEdgePaddingProvider}, so nested {@link ScrollView}s sit flush
 * with the surface edges.
 *
 * Compact: a sheet rising from the bottom edge (12px top radius, a 36x4
 * grab handle, safe-area bottom inset). Wide: a centered dialog on the scrim
 * (`surface-elevated`, the sheet radius, one hairline, no shadow). Both open
 * with a 250ms ease-out that reduced motion turns off.
 *
 * Default `scroll` pins the title/close header and scrolls only the body.
 * The chrome shell is a CSS grid (`.surfaceScrollShell`: `auto` header +
 * `minmax(0, 1fr)` body) with a viewport `max-height`, so the body {@link ScrollView} gets a definite
 * height and `overflow: auto` engages. Body edge padding lives on the
 * scrollable content (scrollbar flush to the modal frame); the header keeps
 * its own inset. Pass `scroll={false}` when children own an internal list
 * scroller (combobox / picker). A fixed `bodyHeight` also disables surface
 * scroll.
 *
 * The sheet comes from {@link useBottomSheetHost} (web CSS sheet by default).
 */
export function ResponsiveSurface(props: ResponsiveSurfaceProps): JSX.Element {
  const layoutMode = useLayoutMode();
  const host = useBottomSheetHost();
  const scope = createPendingOperationScope();
  const confirmNavigation = useConfirmNavigation();
  const requestClose = (): void => {
    if (scope.blocked())
      confirmNavigation(props.onClose, scope.pendingOperations());
    else props.onClose();
  };
  const useSheet = (): boolean =>
    shouldUseMobileSheet({
      presentation: props.presentation,
      layoutMode: layoutMode(),
      supportsSheetPresentation: host.supportsSheetPresentation,
    });
  return (
    <PendingOperationScopeContext.Provider value={scope}>
      <Show
        when={useSheet()}
        fallback={<DesktopModal {...props} onClose={requestClose} />}
      >
        <MobileSheet {...props} onClose={requestClose} />
      </Show>
    </PendingOperationScopeContext.Provider>
  );
}
