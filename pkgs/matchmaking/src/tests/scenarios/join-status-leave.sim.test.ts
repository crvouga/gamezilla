import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { LeaveResult, StatusResult } from '../../interface/types';
import {
  join,
  lastLeave,
  leave,
  matchmaking,
  participantIds,
  ready,
  statusById,
  statusOf,
  tick,
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
    await using s = await matchmaking.script({ seed: 1 });
    await s.apply(join, {
      ref: 'alice',
      input: {
        data: { ...RatingAttr(1500), ...NameAttr('alice') },
        formulas: [SimpleFormula],
      },
    });
    const ids = await s.observe(participantIds);
    expect(typeof ids['alice']).toBe('string');
    const status = (await s.observe(statusOf, 'alice')) as StatusResult;
    expect(status).not.toBeNull();
    expect(status.status).toBe('waiting');
    expect(status.data as Record<string, unknown>).toEqual({
      'mmtest/rating': 1500,
      'mmtest/name': 'alice',
    });
  });

  test('status returns null for unknown id', async () => {
    await using s = await matchmaking.script({ seed: 2 });
    expect(await s.observe(statusById, UNKNOWN_ID)).toBeNull();
  });

  test('leave removes the row', async () => {
    await using s = await matchmaking.script({ seed: 3 });
    await s.apply(join, {
      ref: 'p',
      input: { data: RatingAttr(1000), formulas: [SimpleFormula] },
    });
    await s.apply(leave, { ref: 'p' });
    expect(((await s.observe(lastLeave)) as LeaveResult).removed).toBe(true);
    expect(await s.observe(statusOf, 'p')).toBeNull();
  });

  test('ready() is idempotent', async () => {
    await using s = await matchmaking.script({ seed: 4 });
    await s.apply(ready, {});
    await s.apply(ready, {});
    await s.apply(join, {
      ref: 'p',
      input: { data: RatingAttr(900), formulas: [SimpleFormula] },
    });
    expect((await s.observe(participantIds))['p']).toBeDefined();
  });

  test('leave on unknown id returns removed:false', async () => {
    await using s = await matchmaking.script({ seed: 5 });
    await s.apply(leave, { participantId: UNKNOWN_ID });
    expect(((await s.observe(lastLeave)) as LeaveResult).removed).toBe(false);
  });

  test('leave on matched participant returns removed:false', async () => {
    await using s = await matchmaking.script({ seed: 6 });
    await s.apply(join, {
      ref: 'a',
      input: { data: RatingAttr(1000), formulas: [SimpleFormula] },
    });
    await s.apply(join, {
      ref: 'b',
      input: { data: RatingAttr(1010), formulas: [SimpleFormula] },
    });
    await s.apply(tick, { opts: { maxPassesPerPartition: 1 } });
    await s.apply(leave, { ref: 'a' });
    expect(((await s.observe(lastLeave)) as LeaveResult).removed).toBe(false);
    expect(((await s.observe(statusOf, 'a')) as StatusResult).status).toBe(
      'matched'
    );
  });
});
