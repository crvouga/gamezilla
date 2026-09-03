import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import type { LeaveResult, StatusResult } from '../../interface/types';
import {
  join,
  lastLeave,
  leave,
  participantIds,
  ready,
  statusById,
  statusOf,
  tick,
  matchmaking,
  matchmakingKnobs,
  MATCHMAKING_PROPERTIES,
} from '../../sim/scenario';
import { NameAttr, RatingAttr, registerTestCrashHandler } from '../fixtures';

const SimpleFormula = { numeric: [{ tag: RatingAttr, weight: 1 }] };
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('matchmaking sim: join / status / leave', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('round-trips participant data through status while waiting', async () => {
    await using run = await script(matchmaking, {
      seed: 1,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    await run.apply(join, {
      ref: 'alice',
      input: {
        data: { ...RatingAttr(1500), ...NameAttr('alice') },
        formulas: [SimpleFormula],
      },
    });
    const ids = await run.observe(participantIds);
    expect(typeof ids['alice']).toBe('string');
    const status = (await run.observe(statusOf, 'alice')) as StatusResult;
    expect(status).not.toBeNull();
    expect(status.status).toBe('waiting');
    expect(status.data as Record<string, unknown>).toEqual({
      'mmtest/rating': 1500,
      'mmtest/name': 'alice',
    });
  });

  test('status returns null for unknown id', async () => {
    await using run = await script(matchmaking, {
      seed: 2,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    expect(await run.observe(statusById, UNKNOWN_ID)).toBeNull();
  });

  test('leave removes the row', async () => {
    await using run = await script(matchmaking, {
      seed: 3,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    await run.apply(join, {
      ref: 'p',
      input: { data: RatingAttr(1000), formulas: [SimpleFormula] },
    });
    await run.apply(leave, { ref: 'p' });
    expect(((await run.observe(lastLeave)) as LeaveResult).removed).toBe(true);
    expect(await run.observe(statusOf, 'p')).toBeNull();
  });

  test('ready() is idempotent', async () => {
    await using run = await script(matchmaking, {
      seed: 4,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    await run.apply(ready, {});
    await run.apply(ready, {});
    await run.apply(join, {
      ref: 'p',
      input: { data: RatingAttr(900), formulas: [SimpleFormula] },
    });
    expect((await run.observe(participantIds))['p']).toBeDefined();
  });

  test('leave on unknown id returns removed:false', async () => {
    await using run = await script(matchmaking, {
      seed: 5,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    await run.apply(leave, { participantId: UNKNOWN_ID });
    expect(((await run.observe(lastLeave)) as LeaveResult).removed).toBe(false);
  });

  test('leave on matched participant returns removed:false', async () => {
    await using run = await script(matchmaking, {
      seed: 6,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    await run.apply(join, {
      ref: 'a',
      input: { data: RatingAttr(1000), formulas: [SimpleFormula] },
    });
    await run.apply(join, {
      ref: 'b',
      input: { data: RatingAttr(1010), formulas: [SimpleFormula] },
    });
    await run.apply(tick, { opts: { maxPassesPerPartition: 1 } });
    await run.apply(leave, { ref: 'a' });
    expect(((await run.observe(lastLeave)) as LeaveResult).removed).toBe(false);
    expect(((await run.observe(statusOf, 'a')) as StatusResult).status).toBe(
      'matched'
    );
  });
});
