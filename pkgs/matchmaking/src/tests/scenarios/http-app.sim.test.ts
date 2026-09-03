import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Run } from '@pkgs/dst';
import { script } from '@pkgs/dst';
import type { FormulaWire } from '../../interface/formula-wire';
import type { StatusResult } from '../../interface/types';
import {
  type HttpSpec,
  httpRequest,
  lastHttp,
  type MatchmakingSurface,
  tick,
  matchmaking,
  matchmakingKnobs,
  MATCHMAKING_PROPERTIES,
} from '../../sim/scenario';
import {
  expectMatched,
  registerTestCrashHandler,
  UUID_REGEX,
} from '../fixtures';

const RatingFormula: FormulaWire = {
  numeric: [{ path: 'mmtest/rating', weight: 1 }],
};

type HttpResult = { readonly status: number; readonly body: unknown };

async function http(
  run: Run<MatchmakingSurface>,
  spec: HttpSpec
): Promise<HttpResult> {
  await run.apply(httpRequest, spec);
  return (await run.observe(lastHttp)) as HttpResult;
}

function postJoin(run: Run<MatchmakingSurface>, body: unknown) {
  return http(run, { path: '/join', method: 'POST', body });
}

function participantIdIn(res: HttpResult): string {
  return (res.body as { participantId: string }).participantId;
}

describe('matchmaking sim: http app', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('rejects requests without the auth header', async () => {
    await using run = await script(matchmaking, {
      seed: 110,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    const res = await http(run, { path: '/status/x', headers: {} });
    expect(res.status).toBe(401);
  });

  test('400 on missing data', async () => {
    await using run = await script(matchmaking, {
      seed: 111,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    const res = await postJoin(run, { formulas: [RatingFormula] });
    expect(res.status).toBe(400);
  });

  test('400 on non-keyword key in data', async () => {
    await using run = await script(matchmaking, {
      seed: 112,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    const res = await postJoin(run, {
      data: { badkey: 1 },
      formulas: [RatingFormula],
    });
    expect(res.status).toBe(400);
  });

  test('400 on empty formulas array', async () => {
    await using run = await script(matchmaking, {
      seed: 113,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    const res = await postJoin(run, {
      data: { 'mmtest/rating': 1000 },
      formulas: [],
    });
    expect(res.status).toBe(400);
  });

  test('400 on negative numeric weight', async () => {
    await using run = await script(matchmaking, {
      seed: 114,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    const res = await postJoin(run, {
      data: { 'mmtest/rating': 1000 },
      formulas: [{ numeric: [{ path: 'mmtest/rating', weight: -1 }] }],
    });
    expect(res.status).toBe(400);
  });

  test('paired participants see the same matchId over HTTP', async () => {
    await using run = await script(matchmaking, {
      seed: 115,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    const a = await postJoin(run, {
      data: { 'mmtest/rating': 1000, 'mmtest/name': 'a' },
      formulas: [RatingFormula],
    });
    expect(a.status).toBe(200);
    const aId = participantIdIn(a);
    const bId = participantIdIn(
      await postJoin(run, {
        data: { 'mmtest/rating': 1020, 'mmtest/name': 'b' },
        formulas: [RatingFormula],
      })
    );
    await run.apply(tick, { opts: { maxPassesPerPartition: 4 } });
    const aStatus = await http(run, { path: `/status/${aId}` });
    expect(aStatus.status).toBe(200);
    const aMatched = expectMatched(aStatus.body as StatusResult);
    expect(aMatched.matchId).toMatch(UUID_REGEX);
    expect(aMatched.peers.map((p) => p.participantId)).toEqual([bId]);
    const bStatus = await http(run, { path: `/status/${bId}` });
    expect(expectMatched(bStatus.body as StatusResult).matchId).toBe(
      aMatched.matchId
    );
  });

  test('leave removes a waiting participant', async () => {
    await using run = await script(matchmaking, {
      seed: 116,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    const participantId = participantIdIn(
      await postJoin(run, {
        data: { 'mmtest/rating': 1000 },
        formulas: [RatingFormula],
      })
    );
    const res = await http(run, {
      path: '/leave',
      method: 'POST',
      body: { participantId },
    });
    expect(res.status).toBe(200);
    expect((res.body as { removed: boolean }).removed).toBe(true);
    expect((await http(run, { path: `/status/${participantId}` })).status).toBe(
      404
    );
  });

  test('update-formulas 404 when unknown; updates when waiting', async () => {
    await using run = await script(matchmaking, {
      seed: 117,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    const missing = await http(run, {
      path: '/update-formulas/00000000-0000-0000-0000-000000000000',
      method: 'POST',
      body: { formulas: [RatingFormula] },
    });
    expect(missing.status).toBe(404);
    const participantId = participantIdIn(
      await postJoin(run, {
        data: { 'mmtest/rating': 1000 },
        formulas: [RatingFormula],
      })
    );
    const upd = await http(run, {
      path: `/update-formulas/${participantId}`,
      method: 'POST',
      body: { formulas: [{ numeric: [{ path: 'mmtest/rating', weight: 2 }] }] },
    });
    expect(upd.status).toBe(200);
    expect((upd.body as { updated: boolean }).updated).toBe(true);
  });

  test('accepts groupSize 3 over HTTP', async () => {
    await using run = await script(matchmaking, {
      seed: 118,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    const res = await postJoin(run, {
      data: { 'mmtest/rating': 1000 },
      formulas: [RatingFormula],
      groupSize: 3,
    });
    expect(res.status).toBe(200);
    expect(participantIdIn(res)).toBeDefined();
  });
});
