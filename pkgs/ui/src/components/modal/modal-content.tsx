/**
 * `ModalContent` -- card-like container for modal body.
 *
 * Pulls the scheme-aware elevation from `theme.elevation(4)` so the modal
 * surface reads correctly in dark mode (lifted via `surfaceElevated` +
 * stronger shadow alpha) and in light mode (clean white-on-scrim).
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
  const bg = lift.backgroundColor ?? theme.colors.surfaceElevated;
  return (
    <Box
      sx={{
        m: 4,
        p: 4,
        borderRadius: borderRadius.lg,
        maxWidth: 400,
        alignSelf: 'center',
      }}
      style={[
        {
          backgroundColor: bg,
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
