import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { openMatchmakingWorld } from '../../sim/system';
import { NameAttr, RatingAttr, registerTestCrashHandler } from '../fixtures';

const SimpleFormula = { numeric: [{ tag: RatingAttr, weight: 1 }] };

describe('matchmaking sim: join / status / leave', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('round-trips participant data through status while waiting', async () => {
    await using host = await openMatchmakingWorld({ seed: 1 });
    const world = host.facade;
    const joined = await world.join({
      data: { ...RatingAttr(1500), ...NameAttr('alice') },
      formulas: [SimpleFormula],
    });
    expect(typeof joined.participantId).toBe('string');
    const status = await joined.status();
    expect(status).not.toBeNull();
    expect(status?.status).toBe('waiting');
    expect(status?.data as Record<string, unknown>).toEqual({
      'mmtest/rating': 1500,
      'mmtest/name': 'alice',
    });
  });

  test('status returns null for unknown id', async () => {
    await using host = await openMatchmakingWorld({ seed: 2 });
    const world = host.facade;
    expect(
      await world.mm.status('00000000-0000-0000-0000-000000000000')
    ).toBeNull();
  });

  test('leave removes the row', async () => {
    await using host = await openMatchmakingWorld({ seed: 3 });
    const world = host.facade;
    const p = await world.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
    });
    expect((await p.leave()).removed).toBe(true);
    expect(await p.status()).toBeNull();
  });

  test('ready() is idempotent', async () => {
    await using host = await openMatchmakingWorld({ seed: 4 });
    const world = host.facade;
    await world.mm.ready();
    await world.mm.ready();
    const joined = await world.join({
      data: RatingAttr(900),
      formulas: [SimpleFormula],
    });
    expect(joined.participantId).toBeDefined();
  });

  test('leave on unknown id returns removed:false', async () => {
    await using host = await openMatchmakingWorld({ seed: 5 });
    const world = host.facade;
    expect(
      (await world.mm.leave('00000000-0000-0000-0000-000000000000')).removed
    ).toBe(false);
  });

  test('leave on matched participant returns removed:false', async () => {
    await using host = await openMatchmakingWorld({ seed: 6 });
    const world = host.facade;
    const a = await world.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
    });
    await world.join({ data: RatingAttr(1010), formulas: [SimpleFormula] });
    await world.tick({ maxPassesPerPartition: 1 });
    expect((await a.leave()).removed).toBe(false);
    expect((await a.status())?.status).toBe('matched');
  });
});
