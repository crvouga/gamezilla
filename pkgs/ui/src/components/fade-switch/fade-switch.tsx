/**
 * `FadeSwitch` -- instant swap when `stateKey` changes.
 * Nuclear overhaul: no Reanimated fade on any platform.
 */

import type { ReactNode } from 'react';

import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';

const ROOT_SX = { flex: 1, minHeight: 0 } as const;

export type FadeSwitchProps = {
  stateKey: string;
  children: ReactNode;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function FadeSwitch({ children, dataSet }: FadeSwitchProps): ReactNode {
  return (
    <Box sx={ROOT_SX} dataSet={{ component: 'FadeSwitch', ...dataSet }}>
      {children}
    </Box>
  );
}
