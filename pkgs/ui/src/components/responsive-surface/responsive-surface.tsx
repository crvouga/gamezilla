/** @jsxImportSource solid-js */
import { cssPx } from '../../css/css-px';
/**
 * `ResponsiveSurface` -- overlay that uses a bottom sheet on compact layouts
 * and a centered modal on wide ones ({@link useLayoutMode}). Pass
 * `presentation="modal"` to always use the centered modal.
 *
 * Content uses {@link CONTENT_EDGE_PADDING_STEP} horizontal inset and
 * {@link SURFACE_BOTTOM_PADDING_STEP} bottom inset via
 * {@link ContentEdgePaddingProvider}, so nested {@link ScrollView}s sit flush
 * with the surface edges. Surfaces without a fixed `bodyHeight` wrap their
 * chrome in a {@link ScrollView} capped to the viewport so short panels can
 * scroll instead of clipping.
 *
 * The sheet comes from {@link useBottomSheetHost} (web CSS sheet by default).
 */

import { type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { ComponentDataSet } from '../../component-id';
import { OnColorReset, useLayoutMode } from '../../theme';
import type { ModalSize } from '../../theme/modal-size';
import { useBottomSheetHost } from '../bottom-sheet-host';
import {
  CONTENT_EDGE_PADDING_STEP,
  ContentEdgePaddingProvider,
  SURFACE_BOTTOM_PADDING_STEP,
} from '../content-edge-padding';
import { ModalBackdrop } from '../modal/modal-backdrop';
import { ModalContent, useModalContentMaxHeight } from '../modal/modal-content';
import { ModalRoot } from '../modal/modal-root';
import { ScrollView } from '../scroll-view';
import { ResponsiveSurfaceHeader } from './responsive-surface-header';
import {
  type ResponsiveSurfacePresentation,
  shouldUseMobileSheet,
} from './should-use-mobile-sheet';

export type { ResponsiveSurfacePresentation } from './should-use-mobile-sheet';

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
   * should provide their own internal scroll.
   */
  bodyHeight?: number | undefined;
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

const SURFACE_PADDING_SX = {
  px: CONTENT_EDGE_PADDING_STEP,
  pt: CONTENT_EDGE_PADDING_STEP,
  pb: SURFACE_BOTTOM_PADDING_STEP,
} as const;

function SurfaceChrome(props: ResponsiveSurfaceProps): JSX.Element {
  return (
    <ContentEdgePaddingProvider
      step={CONTENT_EDGE_PADDING_STEP}
      bottomStep={SURFACE_BOTTOM_PADDING_STEP}
    >
      <OnColorReset>
        <ResponsiveSurfaceHeader
          title={props.title}
          onClose={props.onClose}
          closable={props.closable}
          closeDataSet={props.closeDataSet}
        />
        <Show when={props.bodyHeight} fallback={props.children}>
          {(bodyHeight) => (
            <div
              class="box overflow-hidden"
              style={{ height: cssPx(bodyHeight()) }}
            >
              {props.children}
            </div>
          )}
        </Show>
      </OnColorReset>
    </ContentEdgePaddingProvider>
  );
}

/**
 * Fixed-height bodies (inspectors) own their own scroll. Otherwise wrap so
 * short viewports can scroll -- the shell only clips via `maxHeight`.
 */
function SurfaceScrollBody(props: {
  scroll: boolean;
  maxHeight: number | undefined;
  children: JSX.Element;
}): JSX.Element {
  return (
    <Show
      when={props.scroll}
      fallback={
        <div class="box" style={SURFACE_PADDING_SX}>
          {props.children}
        </div>
      }
    >
      <ScrollView
        flushEdge={false}
        class="min-h-0 shrink"
        style={
          props.maxHeight !== undefined
            ? { 'max-height': `${props.maxHeight}px` }
            : undefined
        }
        contentStyle={{
          'padding-left': 'var(--ui-space-4)',
          'padding-right': 'var(--ui-space-4)',
          'padding-top': 'var(--ui-space-4)',
          'padding-bottom': 'var(--ui-space-6)',
        }}
      >
        {props.children}
      </ScrollView>
    </Show>
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
          <SurfaceScrollBody
            scroll={props.bodyHeight === undefined}
            maxHeight={maxHeight()}
          >
            <SurfaceChrome {...props} />
          </SurfaceScrollBody>
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
      <SurfaceScrollBody
        scroll={props.bodyHeight === undefined}
        maxHeight={undefined}
      >
        <SurfaceChrome {...props} />
      </SurfaceScrollBody>
    </Dynamic>
  );
}

export function ResponsiveSurface(props: ResponsiveSurfaceProps): JSX.Element {
  const layoutMode = useLayoutMode();
  const host = useBottomSheetHost();
  const useSheet = (): boolean =>
    shouldUseMobileSheet({
      presentation: props.presentation,
      layoutMode: layoutMode(),
      supportsSheetPresentation: host.supportsSheetPresentation,
    });
  return (
    <Show when={useSheet()} fallback={<DesktopModal {...props} />}>
      <MobileSheet {...props} />
    </Show>
  );
}
