/**
 * Colored ring around a child (typically an avatar) identifying a participant.
 */

import { Box, type ComponentDataSet, componentDataSet } from '@pkgs/ui';
import type { ReactNode } from 'react';

export type ParticipantColorRingProps = {
  color: string;
  children: ReactNode;
  /** Outer diameter of the ring box. Defaults to matching child + pad. */
  size?: number;
  borderWidth?: number;
  dataSet?: ComponentDataSet;
};

export function ParticipantColorRing({
  color,
  children,
  size,
  borderWidth = 2,
  dataSet,
}: ParticipantColorRingProps) {
  return (
    <Box
      {...componentDataSet('ParticipantColorRing', dataSet)}
      sx={{
        ...(size !== undefined
          ? { width: size, height: size, borderRadius: size / 2 }
          : {}),
        borderWidth,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {children}
    </Box>
  );
}
