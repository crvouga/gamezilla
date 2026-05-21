/**
 * `ModalBody` -- text content area for a modal.
 */

import type { PropsWithChildren, ReactNode } from 'react';
import { Box } from '../box';
import { Text } from '../text';

export type ModalBodyProps = PropsWithChildren<{
  message?: ReactNode;
}>;

export function ModalBody({ message, children }: ModalBodyProps) {
  return (
    <Box sx={{ mb: 4 }}>
      {message ? <Text variant="body" label={message} /> : children}
    </Box>
  );
}
