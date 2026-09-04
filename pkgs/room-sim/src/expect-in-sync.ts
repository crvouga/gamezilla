import { expect } from 'bun:test';
import type { Run } from '@pkgs/sim';

import { inSync } from './scenario/observations';
import { recoverAll } from './scenario/room-actions';
import type { RoomSim } from './scenario/sim';

const CONVERGE_STEP_MS = 25;
const CONVERGE_MAX_MS = 15_000;

/**
 * Heal owed clients / network, wait until domain agreement, then assert.
 * Test helper — not an action.
 */
export async function expectInSync(s: Run<RoomSim>): Promise<void> {
  await s.apply(recoverAll);
  await s.until(inSync, {
    stepMs: CONVERGE_STEP_MS,
    maxMs: CONVERGE_MAX_MS,
  });
  expect(await s.read(inSync)).toBe(true);
}
