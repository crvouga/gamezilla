/** @jsxImportSource solid-js */
/**
 * `ModalContent` -- the dialog sheet.
 *
 * Flat: the `surface-elevated` fill, the sheet radius (12) and one hairline
 * that keeps the edge crisp on the scrim in dark mode. No shadow -- the scrim
 * already lifts it. Enters with a 250ms fade and slight scale
 * (`.dialogEnter`), still under reduced motion.
 *
 * Width is controlled only via {@link ModalSize} buckets (see
 * {@link resolveModalLayoutWidth}), clamped to the layout width. The card
 * uses `width: 100%` with `maxWidth` so it shrinks on narrow viewports.
 * Never pass a custom width through `style`.
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import type { ModalSize } from '@pkgs/ui-root-shared/modal-size';
import {
  MODAL_CONTENT_MARGIN_STEP,
  resolveModalLayoutMaxHeight,
  resolveModalLayoutWidth,
} from '@pkgs/ui-root-shared/modal-size';
import { spacing } from '@pkgs/ui-root-shared/scale';
import { type JSX, Show } from 'solid-js';
import { ContentEdgePaddingProvider } from './content-edge-padding';
import { OnColorReset } from './on-color-context';
import { useThemeLayout } from './theme-context';

/** Spacing-scale step for default {@link ModalContent} padding (`p-5` → 20px). */
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
  return (
    <OnColorReset>
      <div
        class="box dialogEnter rounded-sheet w-full self-center overflow-hidden bg-surface-elevated border border-border"
        classList={{ 'p-5': padded() }}
        {...dataAttrs({
          component: 'ModalContent',
          size: props.size ?? 'medium',
          ...props.dataSet,
        })}
        style={{
          'max-width': `${maxWidthPx()}px`,
          'max-height': `${maxHeightPx()}px`,
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
