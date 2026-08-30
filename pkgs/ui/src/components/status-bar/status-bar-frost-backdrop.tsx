/**
 * Frosted backdrop for the status overlay.
 * Nuclear overhaul: solid tint only — no expo-blur / backdrop-filter.
 */

import type { ReactNode } from 'react';

import type { ColorScheme } from '../../theme';
import { Box } from '../box';

const GLASS_TINT = {
  light: 'hsla(0, 0%, 100%, 0.92)',
  dark: 'hsla(240, 5%, 13%, 0.92)',
} as const;

export type StatusBarFrostBackdropProps = {
  colorScheme: ColorScheme;
};

export function StatusBarFrostBackdrop({
  colorScheme,
}: StatusBarFrostBackdropProps): ReactNode {
  return (
    <Box
      pointerEvents="none"
      sx={{
        absoluteFill: true,
        backgroundColor: GLASS_TINT[colorScheme],
      }}
    />
  );
}
