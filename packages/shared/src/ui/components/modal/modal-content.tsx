/**
 * `ModalContent` -- card-like container for modal body.
 */

import type { PropsWithChildren } from 'react';
import { borderRadius } from '../../theme/scale';
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
        borderRadius: borderRadius.lg,
        maxWidth: 400,
        alignSelf: 'center',
        background: 'paper',
      }}
      style={[
        {
          boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)',
          elevation: 8,
        },
        style,
      ]}
    >
      {children}
    </Box>
  );
}
