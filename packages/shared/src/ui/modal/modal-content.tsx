/**
 * `ModalContent` -- card-like container for modal body.
 */

import type { PropsWithChildren } from 'react';
import { Box } from '../box';

export type ModalContentProps = PropsWithChildren<{
  style?: object;
}>;

export function ModalContent({ children, style }: ModalContentProps) {
  return (
    <Box
      sx={{
        m: 4,
        p: 4,
        borderRadius: 12,
        maxWidth: 400,
        alignSelf: 'center',
        background: 'paper',
      }}
      style={[
        {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 8,
        },
        style,
      ]}
    >
      {children}
    </Box>
  );
}
