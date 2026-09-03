import { expect } from 'bun:test';
import { defineSurface, type Run } from '@pkgs/dst';
import { converged } from '../../../sim/scenario/sync-observations';
import { revive } from '../../../sim/scenario/sync-pin-actions';
import type { SyncSurface } from '../../../sim/scenario/system';

const { defineAction } = defineSurface<SyncSurface>();

/**
 * Module-private kit drain — not a public pin / explore action. Sync needs
 * wake + scheduler drain + peer-marker reconcile (kit.drainUntilConverged);
 * `run.until(converged)` alone cannot nudge uploads under perpetual heartbeats.
 */
const drainKit = defineAction({
  name: 'drainKit',
  act: async (s) => {
    await s.runtime.kit.drainUntilConverged();
  },
});

/**
 * Heal owed clients / network, drain until domain agreement, then assert.
 * Test helper — not part of the explore catalog.
 */
export async function expectConverged(run: Run<SyncSurface>): Promise<void> {
  await run.apply(revive);
  await run.apply(drainKit);
  expect(await run.observe(converged)).toBe(true);
}
