/**
 * `TypingDots` -- static chat "..." indicator.
 * Nuclear overhaul: no staggered opacity loops.
 */

import type { ReactNode } from 'react';
import { Box } from '../box';

const DOT_SIZE = 6;
const DOT_GAP = 4;
const DEFAULT_HEIGHT = 26;

export type TypingDotsProps = {
  /** Dot fill color. */
  readonly color: string;
  /** Container height in px. Defaults to a single body-text line (26). */
  readonly height?: number;
};

export function TypingDots({
  color,
  height = DEFAULT_HEIGHT,
}: TypingDotsProps): ReactNode {
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: DOT_GAP / 4,
        height,
      }}
    >
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            width: DOT_SIZE,
            height: DOT_SIZE,
            borderRadius: DOT_SIZE / 2,
            backgroundColor: color,
            opacity: 0.55,
          }}
        />
      ))}
    </Box>
  );
}
