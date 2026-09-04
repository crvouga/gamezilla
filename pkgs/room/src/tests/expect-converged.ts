import { expect } from 'bun:test';
import type { Script } from '@pkgs/dst';

import { converged } from '../sim/scenario/observations';
import { revive } from '../sim/scenario/room-actions';
import type { RoomSurface } from '../sim/scenario/surface';

const CONVERGE_STEP_MS = 25;
const CONVERGE_MAX_MS = 15_000;

/**
 * Heal owed clients / network, wait until domain agreement, then assert.
 * Test helper — not an action.
 */
export async function expectConverged(s: Script<RoomSurface>): Promise<void> {
  await s.apply(revive);
  await s.until(converged, {
    stepMs: CONVERGE_STEP_MS,
    maxMs: CONVERGE_MAX_MS,
  });
  expect(await s.observe(converged)).toBe(true);
}
