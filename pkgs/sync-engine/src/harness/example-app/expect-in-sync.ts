import { expect } from 'bun:test';
import { defineAction, type Run } from '@pkgs/harness';
import { recoverAll } from '../scenario/regression-actions';
import { inSync } from '../scenario/sync-observations';
import type { SyncHarness } from '../scenario/system';

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
