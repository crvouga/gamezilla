/**
 * Absolute-fill vertical gradient behind button / FAB content.
 */

import type { ReactNode } from 'react';
import { GradientBox } from '../gradient-box';

export type ButtonSurfaceFillProps = {
  top: string;
  bottom: string;
  borderRadius: number;
};

export function ButtonSurfaceFill({
  top,
  bottom,
  borderRadius,
}: ButtonSurfaceFillProps): ReactNode {
  return (
    <GradientBox
      colors={[top, bottom]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      pointerEvents="none"
      sx={{ absoluteFill: true, borderRadius }}
    />
  );
}
