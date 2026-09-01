import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { openMatchmakingWorld, requireMmWorld } from '../../sim/system';
import {
  expectMatched,
  NameAttr,
  RatingAttr,
  registerTestCrashHandler,
  UUID_REGEX,
} from '../fixtures';

const SimpleFormula = { numeric: [{ tag: RatingAttr, weight: 1 }] };

describe('matchmaking sim: pairing / peers', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('paired participants see the same matchId and each other as peers', async () => {
    await using host = await openMatchmakingWorld({ seed: 20 });
    const world = requireMmWorld(host.state);
    const a = await world.join({
      data: { ...RatingAttr(1000), ...NameAttr('a') },
      formulas: [SimpleFormula],
    });
    const b = await world.join({
      data: { ...RatingAttr(1020), ...NameAttr('b') },
      formulas: [SimpleFormula],
    });
    expect((await world.tick({ maxPassesPerPartition: 4 })).matches).toBe(1);
    const aStatus = expectMatched(await a.status());
    const bStatus = expectMatched(await b.status());
    expect(aStatus.matchId).toMatch(UUID_REGEX);
    expect(aStatus.matchId).toBe(bStatus.matchId);
    expect(aStatus.peers.map((p) => p.participantId)).toEqual([
      b.participantId,
    ]);
    expect(bStatus.peers.map((p) => p.participantId)).toEqual([
      a.participantId,
    ]);
  });

  test('three participants — only the closest pair matches', async () => {
    await using host = await openMatchmakingWorld({ seed: 21 });
    const world = requireMmWorld(host.state);
    const a = await world.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
    });
    const b = await world.join({
      data: RatingAttr(1020),
      formulas: [SimpleFormula],
    });
    const c = await world.join({
      data: RatingAttr(2000),
      formulas: [SimpleFormula],
    });
    await world.tick({ maxPassesPerPartition: 4 });
    expect((await a.status())?.status).toBe('matched');
    expect((await b.status())?.status).toBe('matched');
    expect((await c.status())?.status).toBe('waiting');
  });
});
