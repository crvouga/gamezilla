import type { SimSystemSnapshot } from '@pkgs/sim-console/shared/sim-system-snapshot';

import { capturedSnapshot, captureSnapshot } from '../../sim';
import type { OpenSim } from './open-sim';

export async function captureOpenSimSnapshot(
  s: OpenSim,
  clientIds: readonly string[]
): Promise<SimSystemSnapshot> {
  await s.apply(captureSnapshot, [...clientIds]);
  const snapshot = await s.read(capturedSnapshot);
  if (snapshot === null) {
    throw new Error('captureOpenSimSnapshot: no snapshot recorded');
  }
  return snapshot;
}
