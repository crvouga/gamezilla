/**
 * `ModalContent` -- card-like container for modal body.
 *
 * Always uses the `surfaceOverlay` token (the highest tier in the surface
 * hierarchy) so the modal reads consistently in both schemes: white in
 * light mode, the brightest grey in dark mode. A 1px border keeps the
 * edge crisp on top of the scrim, and a soft elevation 4 shadow lifts the
 * card off the page.
 *
 * Width is controlled only via {@link ModalSize} buckets (see
 * {@link resolveModalLayoutWidth}), clamped to the layout width. The card
 * uses `width: 100%` with `maxWidth` so it shrinks on narrow viewports.
 */

import type { PropsWithChildren } from 'react';
import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import {
  MODAL_CONTENT_MARGIN_STEP,
  type ModalSize,
  resolveModalLayoutMaxHeight,
  resolveModalLayoutWidth,
} from '../../theme/modal-size';
import { borderRadius, spacing } from '../../theme/scale';
import { Box } from '../box';
import { ContentEdgePaddingProvider } from '../content-edge-padding';

/** Spacing-scale step for default {@link ModalContent} padding (`p: 5` → 20px). */
const MODAL_CONTENT_PADDING_STEP = 5;

export type ModalContentProps = PropsWithChildren<{
  /** Default `medium`. Clamped to the layout width; cannot be overridden via style. */
  size?: ModalSize;
  /** Optional max height in px (e.g. tall inspector modals). */
  maxHeight?: number;
  /**
   * When `false`, omit the default inset so a parent can own content padding
   * (e.g. {@link ResponsiveSurface} flush-scroll shells). Default `true`.
   */
  padded?: boolean;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
}>;

export function ModalContent({
  children,
  size = 'medium',
  maxHeight,
  padded = true,
  dataSet,
}: ModalContentProps) {
  const theme = useTheme();
  const marginPx = spacing[MODAL_CONTENT_MARGIN_STEP];
  const maxWidthPx = resolveModalLayoutWidth(
    size,
    theme.layout.width,
    marginPx
  );
  const viewportMaxHeight = resolveModalLayoutMaxHeight(
    theme.layout.height,
    marginPx
  );
  const resolvedMaxHeight =
    maxHeight === undefined
      ? viewportMaxHeight
      : Math.min(maxHeight, viewportMaxHeight);
  const body = padded ? (
    <ContentEdgePaddingProvider
      step={MODAL_CONTENT_PADDING_STEP}
      bottomStep={MODAL_CONTENT_PADDING_STEP}
    >
      {children}
    </ContentEdgePaddingProvider>
  ) : (
    children
  );

  return (
    <Box
      {...componentDataSet('ModalContent', dataSet)}
      sx={{
        ...(padded ? { p: MODAL_CONTENT_PADDING_STEP } : {}),
        borderRadius: borderRadius.xl,
        width: '100%',
        maxWidth: maxWidthPx,
        alignSelf: 'center',
        maxHeight: resolvedMaxHeight,
        overflow: 'hidden',
        backgroundColor: 'surfaceOverlay',
        borderWidth: 1,
        borderColor: 'border',
        elevation: 4,
      }}
    >
      {body}
    </Box>
  );
}
