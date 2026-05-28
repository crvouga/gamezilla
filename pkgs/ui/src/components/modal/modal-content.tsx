/**
 * `ModalContent` -- card-like container for modal body.
 *
 * Always uses the `surfaceOverlay` token (the highest tier in the surface
 * hierarchy) so the modal reads consistently in both schemes: white in
 * light mode, the brightest grey in dark mode. A 1px border keeps the
 * edge crisp on top of the scrim, and a soft elevation 4 shadow lifts the
 * card off the page.
 */

import type { PropsWithChildren } from 'react';
import { useTheme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { Box } from '../box';

export type ModalContentProps = PropsWithChildren<{
  style?: object;
}>;

export function ModalContent({ children, style }: ModalContentProps) {
  const theme = useTheme();
  const lift = theme.elevation(4);
  return (
    <Box
      sx={{
        m: 4,
        p: 5,
        borderRadius: borderRadius.xl,
        maxWidth: 440,
        alignSelf: 'center',
      }}
      style={[
        {
          backgroundColor: theme.colors.surfaceOverlay,
          borderWidth: 1,
          borderColor: theme.colors.border,
          ...(lift.boxShadow ? { boxShadow: lift.boxShadow } : {}),
          ...(lift.elevation !== undefined
            ? { elevation: lift.elevation }
            : {}),
        },
        style,
      ]}
    >
      {children}
    </Box>
  );
}
