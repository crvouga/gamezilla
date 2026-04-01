/**
 * `ModalFooter` -- action row at the bottom of a modal.
 */

import type { PropsWithChildren } from 'react';
import { Box } from '../box';

export function ModalFooter({ children }: PropsWithChildren) {
  return (
    <Box sx={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 2 }}>
      {children}
    </Box>
  );
}
