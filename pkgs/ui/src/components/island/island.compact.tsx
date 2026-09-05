/**
 * Compact Island: children only — no card chrome so mobile compositions stay
 * pixel-identical when wrapped for desktop canvas layouts.
 */

import type { ReactNode } from 'react';
import { componentDataSet } from '../../component-id';
import { Box } from '../box';
import type { IslandProps } from './island-types';

export function IslandCompact({
  children,
  sx,
  dataSet,
}: IslandProps): ReactNode {
  return (
    <Box sx={sx} {...componentDataSet('Island', dataSet)}>
      {children}
    </Box>
  );
}
