import { expect } from 'bun:test';
import { defineAction } from '@pkgs/harness-shared/define-action';
import type { Run } from '@pkgs/harness-shared/run-types';
import { recoverAll } from './regression-actions';
import type { SyncHarness } from './scenario-system';
import { inSync } from './sync-observations';

/**
 * Module-private kit drain — not a public pin / explore action. Sync needs
 * wake + scheduler drain + peer-marker reconcile (kit.drainUntilInSync);
 * `s.until(inSync)` alone cannot nudge uploads under perpetual heartbeats.
 */
const drainKit = defineAction({
  name: 'drainKit',
  act: async (s: SyncHarness) => {
    await s.runtime.kit.drainUntilInSync();
  },
});

/**
 * Heal owed clients / network, drain until domain agreement, then assert.
 * Test helper — not part of the explore catalog.
 */
export async function expectInSync(s: Run<SyncHarness>): Promise<void> {
  await s.apply(recoverAll);
  await s.apply(drainKit);
  expect(await s.read(inSync)).toBe(true);
}
