import { expect } from 'bun:test';
import { defineAction, type Script } from '@pkgs/dst';
import { converged } from '../../../sim/scenario/sync-observations';
import { revive } from '../../../sim/scenario/sync-pin-actions';
import type { SyncSurface } from '../../../sim/scenario/system';

/**
 * Module-private kit drain — not a public pin / explore action. Sync needs
 * wake + scheduler drain + peer-marker reconcile (kit.drainUntilConverged);
 * `s.until(converged)` alone cannot nudge uploads under perpetual heartbeats.
 */
const drainKit = defineAction({
  name: 'drainKit',
  act: async (s: SyncSurface) => {
    await s.runtime.kit.drainUntilConverged();
  },
});

/**
 * Heal owed clients / network, drain until domain agreement, then assert.
 * Test helper — not part of the explore catalog.
 */
export async function expectConverged(s: Script<SyncSurface>): Promise<void> {
  await s.apply(revive);
  await s.apply(drainKit);
  expect(await s.observe(converged)).toBe(true);
}
