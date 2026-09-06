/**
 * Compact IslandGrid: vertical stack with the same gap as ScreenBase body.
 */

import type { ReactNode } from 'react';
import { componentDataSet } from '../../component-id';
import { Box } from '../box';
import type { IslandGridProps } from './island-grid-types';

/** Matches ScreenBase body `BODY_GAP_STEP`. */
const COMPACT_GAP_STEP = 3;

export function IslandGridCompact({
  children,
  dataSet,
}: IslandGridProps): ReactNode {
  return (
    <Box
      sx={{ gap: COMPACT_GAP_STEP }}
      {...componentDataSet('IslandGrid', dataSet)}
    >
      {children}
    </Box>
  );
}
