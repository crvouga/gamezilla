/**
 * `ModalFooter` -- action column at the bottom of a modal.
 *
 * Renders its children stacked vertically (iOS-style) with each action
 * stretched to the full content width. Pair with {@link ModalButton}'s
 * default `md` size so the tap targets clear the 44pt iOS minimum.
 */

import type { PropsWithChildren } from 'react';
import { Box } from '../box';

export function ModalFooter({ children }: PropsWithChildren) {
  return (
    <Box
      sx={{
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 2,
        mt: 2,
      }}
    >
      {children}
    </Box>
  );
}
