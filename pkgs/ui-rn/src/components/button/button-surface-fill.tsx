/**
 * Absolute-fill flat color behind button / FAB content.
 * Nuclear overhaul: no LinearGradient.
 */

import type { ReactNode } from 'react';
import { Box } from '../box';

export type ButtonSurfaceFillProps = {
  top: string;
  /** Ignored — flat fill uses `top` only. */
  bottom: string;
  borderRadius: number;
};

export function ButtonSurfaceFill({
  top,
  borderRadius,
}: ButtonSurfaceFillProps): ReactNode {
  return (
    <Box
      pointerEvents="none"
      sx={{ absoluteFill: true, borderRadius, backgroundColor: top }}
    />
  );
}
