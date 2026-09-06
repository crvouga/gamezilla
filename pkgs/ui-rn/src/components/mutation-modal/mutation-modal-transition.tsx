/**
 * `MutationStateTransition` -- swaps mutation phases instantly.
 * Nuclear overhaul: no height/opacity Reanimated timing.
 */

import type { ReactNode } from 'react';
import { Box } from '../box';

export function MutationStateTransition({
  children,
}: {
  stateKey: string;
  /** When false (surface closed), content unmounts with the parent. */
  active: boolean;
  children: ReactNode;
}): ReactNode {
  return <Box>{children}</Box>;
}
