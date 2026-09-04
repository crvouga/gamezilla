import type { SimSystemSnapshot } from '@pkgs/sim-console/shared/sim-system-snapshot';

import { capturedSnapshot } from '../scenario/observations';
import { captureSnapshot } from '../scenario/probes';
import type { OpenSimHandle } from './open-sim';

export async function captureOpenSimSnapshot(
  run: OpenSimHandle,
  clientIds: readonly string[]
): Promise<SimSystemSnapshot> {
  await s.apply(captureSnapshot, [...clientIds]);
  const snapshot = await s.observe(capturedSnapshot);
  if (snapshot === null) {
    throw new Error('captureOpenSimSnapshot: no snapshot recorded');
  }
  return snapshot as unknown as SimSystemSnapshot;
}
