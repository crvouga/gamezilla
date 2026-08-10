// @io-wall-ok
/**
 * Root layout for UI explorer component examples.
 *
 * Owns shared section spacing (`gap: 4`) and omits edge padding — ScreenBase /
 * ExplorerDetail already inset the body. Pass `sx` to override gap or add
 * layout extras (`minHeight`, `flex`, …).
 */

import { ClockProvider, wallClock, wallTimers } from '@pkgs/clock';
import type { ReactNode } from 'react';

import { type ComponentDataSet, componentDataSet } from '../../component-id';
import type { SxProps } from '../../theme';
import { Box } from '../box/box';

export type ExampleRootProps = {
  children: ReactNode;
  /** Merged over the default `{ gap: 4 }`. */
  sx?: SxProps;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function ExampleRoot({
  children,
  sx,
  dataSet,
}: ExampleRootProps): ReactNode {
  return (
    <ClockProvider clock={wallClock} timers={wallTimers}>
      <Box sx={{ gap: 4, ...sx }} {...componentDataSet('ExampleRoot', dataSet)}>
        {children}
      </Box>
    </ClockProvider>
  );
}
