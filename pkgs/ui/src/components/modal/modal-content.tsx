/** @jsxImportSource solid-js */
/**
 * `ModalContent` -- card-like container for modal body.
 *
 * Always uses the `surfaceOverlay` token (the highest tier in the surface
 * hierarchy) so the modal reads consistently in both schemes. A 1px border
 * keeps the edge crisp on top of the scrim.
 *
 * Width is controlled only via {@link ModalSize} buckets (see
 * {@link resolveModalLayoutWidth}), clamped to the layout width. The card
 * uses `width: 100%` with `maxWidth` so it shrinks on narrow viewports.
 * Never pass a custom width through `style`.
 */

import { type JSX, Show } from 'solid-js';
import { type ComponentDataSet, dataAttrs } from '../../component-id';
import { OnColorReset, useThemeLayout } from '../../theme';
import {
  MODAL_CONTENT_MARGIN_STEP,
  type ModalSize,
  resolveModalLayoutMaxHeight,
  resolveModalLayoutWidth,
} from '../../theme/modal-size';
import { spacing } from '../../theme/scale';
import { ContentEdgePaddingProvider } from '../content-edge-padding';

/** Spacing-scale step for default {@link ModalContent} padding (`p: 5` → 20px). */
export const MODAL_CONTENT_PADDING_STEP = 5;

export type ModalContentProps = {
  /** Default `medium`. Clamped to the layout width; cannot be overridden via style. */
  size?: ModalSize | undefined;
  /** Optional max height in px (e.g. tall inspector modals). */
  maxHeight?: number | undefined;
  /**
   * When `false`, omit the default inset so a parent can own content padding
   * (e.g. {@link ResponsiveSurface} flush-scroll shells). Default `true`.
   */
  padded?: boolean | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
  children?: JSX.Element | undefined;
};

/** Viewport-capped max height for centered modal content. */
export function useModalContentMaxHeight(
  maxHeight: () => number | undefined
): () => number {
  const layout = useThemeLayout();
  const marginPx = spacing[MODAL_CONTENT_MARGIN_STEP];
  return () => {
    const viewportMax = resolveModalLayoutMaxHeight(
      layout.layout().height,
      marginPx
    );
    const wanted = maxHeight();
    return wanted === undefined ? viewportMax : Math.min(wanted, viewportMax);
  };
}

export function ModalContent(props: ModalContentProps): JSX.Element {
  const layout = useThemeLayout();
  const marginPx = spacing[MODAL_CONTENT_MARGIN_STEP];
  const padded = (): boolean => props.padded ?? true;
  const maxWidthPx = (): number =>
    resolveModalLayoutWidth(
      props.size ?? 'medium',
      layout.layout().width,
      marginPx
    );
  const maxHeightPx = useModalContentMaxHeight(() => props.maxHeight);
  const padPx = spacing[MODAL_CONTENT_PADDING_STEP];
  return (
    <OnColorReset>
      <div
        class="box rounded-[20px] w-full self-center overflow-hidden bg-surface-overlay border border-border"
        {...dataAttrs({
          component: 'ModalContent',
          size: props.size ?? 'medium',
          ...props.dataSet,
        })}
        style={{
          ...(padded() ? { padding: `${padPx}px` } : {}),
          'max-width': `${maxWidthPx()}px`,
          'max-height': `${maxHeightPx()}px`,
          'box-shadow': '0 12px 40px var(--ui-color-shadow-color)',
        }}
      >
        <Show when={padded()} fallback={props.children}>
          <ContentEdgePaddingProvider
            step={MODAL_CONTENT_PADDING_STEP}
            bottomStep={MODAL_CONTENT_PADDING_STEP}
          >
            {props.children}
          </ContentEdgePaddingProvider>
        </Show>
      </div>
    </OnColorReset>
  );
}
