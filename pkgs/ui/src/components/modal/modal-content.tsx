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
 * {@link resolveModalLayoutWidth}), clamped to the viewport.
 */

import type { PropsWithChildren } from 'react';
import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import {
  MODAL_CONTENT_MARGIN_STEP,
  type ModalSize,
  resolveModalLayoutWidth,
} from '../../theme/modal-size';
import { borderRadius, spacing } from '../../theme/scale';
import { Box } from '../box';
import { ContentEdgePaddingProvider } from '../content-edge-padding';

/** Spacing-scale step for default {@link ModalContent} padding (`p: 5` → 20px). */
const MODAL_CONTENT_PADDING_STEP = 5;

export type ModalContentProps = PropsWithChildren<{
  /** Default `medium`. Clamped to the viewport; cannot be overridden via style. */
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
  const widthPx = resolveModalLayoutWidth(size, theme.layout.width, marginPx);
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
        m: MODAL_CONTENT_MARGIN_STEP,
        ...(padded ? { p: MODAL_CONTENT_PADDING_STEP } : {}),
        borderRadius: borderRadius.xl,
        width: widthPx,
        alignSelf: 'center',
        backgroundColor: 'surfaceOverlay',
        borderWidth: 1,
        borderColor: 'border',
        elevation: 4,
        ...(maxHeight === undefined ? {} : { maxHeight }),
      }}
    >
      {body}
    </Box>
  );
}
