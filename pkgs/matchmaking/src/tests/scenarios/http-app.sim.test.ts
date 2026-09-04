import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Script } from '@pkgs/dst';
import type { FormulaWire } from '../../interface/formula-wire';
import type { StatusResult } from '../../interface/types';
import {
  type HttpSpec,
  httpRequest,
  lastHttp,
  type MatchmakingSurface,
  matchmaking,
  tick,
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
  s: Script<MatchmakingSurface>,
  spec: HttpSpec
): Promise<HttpResult> {
  await s.apply(httpRequest, spec);
  return (await s.observe(lastHttp)) as HttpResult;
}

function postJoin(s: Script<MatchmakingSurface>, body: unknown) {
  return http(s, { path: '/join', method: 'POST', body });
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
    await using s = await matchmaking.script({ seed: 110 });
    const res = await http(s, { path: '/status/x', headers: {} });
    expect(res.status).toBe(401);
  });

  test('400 on missing data', async () => {
    await using s = await matchmaking.script({ seed: 111 });
    const res = await postJoin(s, { formulas: [RatingFormula] });
    expect(res.status).toBe(400);
  });

  test('400 on non-keyword key in data', async () => {
    await using s = await matchmaking.script({ seed: 112 });
    const res = await postJoin(s, {
      data: { badkey: 1 },
      formulas: [RatingFormula],
    });
    expect(res.status).toBe(400);
  });

  test('400 on empty formulas array', async () => {
    await using s = await matchmaking.script({ seed: 113 });
    const res = await postJoin(s, {
      data: { 'mmtest/rating': 1000 },
      formulas: [],
    });
    expect(res.status).toBe(400);
  });

  test('400 on negative numeric weight', async () => {
    await using s = await matchmaking.script({ seed: 114 });
    const res = await postJoin(s, {
      data: { 'mmtest/rating': 1000 },
      formulas: [{ numeric: [{ path: 'mmtest/rating', weight: -1 }] }],
    });
    expect(res.status).toBe(400);
  });

  test('paired participants see the same matchId over HTTP', async () => {
    await using s = await matchmaking.script({ seed: 115 });
    const a = await postJoin(s, {
      data: { 'mmtest/rating': 1000, 'mmtest/name': 'a' },
      formulas: [RatingFormula],
    });
    expect(a.status).toBe(200);
    const aId = participantIdIn(a);
    const bId = participantIdIn(
      await postJoin(s, {
        data: { 'mmtest/rating': 1020, 'mmtest/name': 'b' },
        formulas: [RatingFormula],
      })
    );
    await s.apply(tick, { opts: { maxPassesPerPartition: 4 } });
    const aStatus = await http(s, { path: `/status/${aId}` });
    expect(aStatus.status).toBe(200);
    const aMatched = expectMatched(aStatus.body as StatusResult);
    expect(aMatched.matchId).toMatch(UUID_REGEX);
    expect(aMatched.peers.map((p) => p.participantId)).toEqual([bId]);
    const bStatus = await http(s, { path: `/status/${bId}` });
    expect(expectMatched(bStatus.body as StatusResult).matchId).toBe(
      aMatched.matchId
    );
  });

  test('leave removes a waiting participant', async () => {
    await using s = await matchmaking.script({ seed: 116 });
    const participantId = participantIdIn(
      await postJoin(s, {
        data: { 'mmtest/rating': 1000 },
        formulas: [RatingFormula],
      })
    );
    const res = await http(s, {
      path: '/leave',
      method: 'POST',
      body: { participantId },
    });
    expect(res.status).toBe(200);
    expect((res.body as { removed: boolean }).removed).toBe(true);
    expect((await http(s, { path: `/status/${participantId}` })).status).toBe(
      404
    );
  });

  test('update-formulas 404 when unknown; updates when waiting', async () => {
    await using s = await matchmaking.script({ seed: 117 });
    const missing = await http(s, {
      path: '/update-formulas/00000000-0000-0000-0000-000000000000',
      method: 'POST',
      body: { formulas: [RatingFormula] },
    });
    expect(missing.status).toBe(404);
    const participantId = participantIdIn(
      await postJoin(s, {
        data: { 'mmtest/rating': 1000 },
        formulas: [RatingFormula],
      })
    );
    const upd = await http(s, {
      path: `/update-formulas/${participantId}`,
      method: 'POST',
      body: { formulas: [{ numeric: [{ path: 'mmtest/rating', weight: 2 }] }] },
    });
    expect(upd.status).toBe(200);
    expect((upd.body as { updated: boolean }).updated).toBe(true);
  });

  test('accepts groupSize 3 over HTTP', async () => {
    await using s = await matchmaking.script({ seed: 118 });
    const res = await postJoin(s, {
      data: { 'mmtest/rating': 1000 },
      formulas: [RatingFormula],
      groupSize: 3,
    });
    expect(res.status).toBe(200);
    expect(participantIdIn(res)).toBeDefined();
  });
});
