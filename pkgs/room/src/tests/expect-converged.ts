import { expect } from 'bun:test';
import type { Run } from '@pkgs/dst';

import { converged } from '../sim/scenario/observations';
import { revive } from '../sim/scenario/room-actions';
import type { RoomSurface } from '../sim/scenario/surface';

const CONVERGE_STEP_MS = 25;
const CONVERGE_MAX_MS = 15_000;

/**
 * Heal owed clients / network, wait until domain agreement, then assert.
 * Test helper — not an action.
 */
export async function expectConverged(run: Run<RoomSurface>): Promise<void> {
  await run.apply(revive);
  await run.until(converged, {
    stepMs: CONVERGE_STEP_MS,
    maxMs: CONVERGE_MAX_MS,
  });
  expect(await run.observe(converged)).toBe(true);
}
