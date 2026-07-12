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
import { useTheme } from '../../theme';
import {
  MODAL_CONTENT_MARGIN_STEP,
  resolveModalLayoutWidth,
  type ModalSize,
} from '../../theme/modal-size';
import { borderRadius, spacing } from '../../theme/scale';
import { Box } from '../box';

export type ModalContentProps = PropsWithChildren<{
  /** Default `medium`. Clamped to the viewport; cannot be overridden via style. */
  size?: ModalSize;
  /** Optional max height in px (e.g. tall inspector modals). */
  maxHeight?: number;
}>;

export function ModalContent({
  children,
  size = 'medium',
  maxHeight,
}: ModalContentProps) {
  const theme = useTheme();
  const lift = theme.elevation(4);
  const marginPx = spacing[MODAL_CONTENT_MARGIN_STEP];
  const widthPx = resolveModalLayoutWidth(size, theme.layout.width, marginPx);

  return (
    <Box
      sx={{
        m: MODAL_CONTENT_MARGIN_STEP,
        p: 5,
        borderRadius: borderRadius.xl,
        width: widthPx,
        alignSelf: 'center',
      }}
      style={{
        backgroundColor: theme.colors.surfaceOverlay,
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...(maxHeight === undefined ? {} : { maxHeight }),
        ...(lift.boxShadow ? { boxShadow: lift.boxShadow } : {}),
        ...(lift.elevation !== undefined ? { elevation: lift.elevation } : {}),
      }}
    >
      {children}
    </Box>
  );
}
