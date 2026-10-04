import type { HarnessSystemSnapshot } from '@pkgs/harness-console-shared/system-snapshot';

import { capturedSnapshot } from './observations';
import type { OpenHarness } from './open-harness';
import { captureSnapshot } from './probes';

export async function captureOpenHarnessSnapshot(
  s: OpenHarness,
  clientIds: readonly string[]
): Promise<HarnessSystemSnapshot> {
  await s.apply(captureSnapshot, [...clientIds]);
  const snapshot = await s.read(capturedSnapshot);
  if (snapshot === null) {
    throw new Error('captureOpenHarnessSnapshot: no snapshot recorded');
  }
  return snapshot;
}
