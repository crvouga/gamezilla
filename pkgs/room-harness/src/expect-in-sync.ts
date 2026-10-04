import { expect } from 'bun:test';
import type { Run } from '@pkgs/harness-shared/run-types';
import type { RoomHarness } from './harness';
import { inSync } from './observations';
import { recoverAll } from './room-actions';

const CONVERGE_STEP_MS = 25;
const CONVERGE_MAX_MS = 15_000;

/**
 * Heal owed clients / network, wait until domain agreement, then assert.
 * Test helper — not an action.
 */
export async function expectInSync(s: Run<RoomHarness>): Promise<void> {
  await s.apply(recoverAll);
  await s.until(inSync, {
    stepMs: CONVERGE_STEP_MS,
    maxMs: CONVERGE_MAX_MS,
  });
  expect(await s.read(inSync)).toBe(true);
}
