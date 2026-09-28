/**
 * Port contract for a participant id nobody ever joined with: status finds
 * nothing, and leaving or updating formulas reports that nothing changed.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type {
  LeaveResult,
  UpdateFormulasResult,
} from '@pkgs/matchmaking/interface';
import {
  lastLeave,
  lastUpdate,
  leave,
  matchmaking,
  ratingWithin,
  registerTestCrashHandler,
  statusById,
  updateFormulas,
} from '@pkgs/matchmaking-harness';

/** A participant id nobody ever joined with. */
const NOBODY = '00000000-0000-0000-0000-000000000000';

describe('a participant id nobody joined with', () => {
  let dispose: () => void;
  beforeAll(() => {
    dispose = registerTestCrashHandler();
  });
  afterAll(() => {
    dispose();
  });

  test('status finds nothing', async () => {
    await using s = await matchmaking.run({ seed: 'unknown-status' });
    expect(await s.read(statusById, NOBODY)).toBeNull();
  });

  test('leaving removes nothing', async () => {
    await using s = await matchmaking.run({ seed: 'unknown-leave' });
    await s.apply(leave, { participantId: NOBODY });
    expect(((await s.read(lastLeave)) as LeaveResult).removed).toBe(false);
  });

  test('updating formulas updates nothing', async () => {
    await using s = await matchmaking.run({ seed: 'unknown-update' });
    await s.apply(updateFormulas, {
      participantId: NOBODY,
      formulas: [ratingWithin(200)],
    });
    expect(((await s.read(lastUpdate)) as UpdateFormulasResult).updated).toBe(
      false
    );
  });
});
