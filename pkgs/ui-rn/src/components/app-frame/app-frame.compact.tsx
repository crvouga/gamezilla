/**
 * Compact AppFrame: full-bleed passthrough. Header is ignored so mobile /
 * tablet chrome (bottom tabs + ScreenBase TopBar) is unchanged.
 */

import type { ReactNode } from 'react';
import { componentDataSet } from '../../component-id';
import { Box } from '../box';
import type { AppFrameProps } from './app-frame-types';

export function AppFrameCompact({ children }: AppFrameProps): ReactNode {
  return (
    <Box
      sx={{ flex: 1, minHeight: 0 }}
      {...componentDataSet('AppFrame', undefined)}
    >
      {children}
    </Box>
  );
}
