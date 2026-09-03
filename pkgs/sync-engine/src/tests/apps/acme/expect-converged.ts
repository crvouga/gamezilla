import { expect } from 'bun:test';
import { defineAction, type Run } from '@pkgs/dst';
import { converged, quiet } from '../../../sim/scenario/sync-observations';
import { passTime, revive } from '../../../sim/scenario/sync-pin-actions';
import type { SyncSurface } from '../../../sim/scenario/system';

const QUIET_BUDGET_MS = 2_000;
const QUIET_STEP_MS = 25;

/** Soft settle — advance until quiet or budget; never throws. */
async function softQuiet(run: Run<SyncSurface>): Promise<void> {
  for (let waited = 0; waited < QUIET_BUDGET_MS; waited += QUIET_STEP_MS) {
    if (await run.observe(quiet)) return;
    await run.apply(passTime, QUIET_STEP_MS);
  }
}

/** Module-private drain used by {@link expectConverged} — not a public pin. */
const drainUntilConverged = defineAction({
  name: 'drainUntilConverged',
  *generate() {
    yield {
      weight: 1,
      act: async (s: SyncSurface) => {
        await s.drainUntilConverged();
      },
    };
  },
});

/**
 * Heal owed clients / network, drain until domain agreement, then assert.
 * Test helper — not an action. Pins that must not heal use
 * `untilObserved(run, converged, passTime)` alone.
 */
export async function expectConverged(run: Run<SyncSurface>): Promise<void> {
  await run.apply(revive);
  await run.apply(drainUntilConverged);
  await softQuiet(run);
  expect(await run.observe(converged)).toBe(true);
}
