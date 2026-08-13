import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Hono } from 'hono';
import type { FormulaWire } from '../../interface/formula-wire';
import type { StatusResult } from '../../interface/types';
import { openMatchmakingSimWorld } from '../../sim/world';
import {
  defaultStubAuth,
  expectMatched,
  registerTestCrashHandler,
  TEST_AUTH_HEADERS,
  UUID_REGEX,
} from '../fixtures';

const RatingFormula: FormulaWire = {
  numeric: [{ path: 'mmtest/rating', weight: 1 }],
};

async function postJson(
  app: Hono,
  path: string,
  body: unknown
): Promise<Response> {
  return await app.request(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...TEST_AUTH_HEADERS,
    },
    body: JSON.stringify(body),
  });
}

async function getStatus(
  app: Hono,
  participantId: string
): Promise<{ readonly response: Response; readonly body: StatusResult }> {
  const response = await app.request(`/status/${participantId}`, {
    headers: TEST_AUTH_HEADERS,
  });
  const body = (await response.json()) as StatusResult;
  return { response, body };
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
    await using world = await openMatchmakingSimWorld({ seed: 110 });
    const app = world.mm.app({ requireAuth: defaultStubAuth });
    const res = await app.request('/status/x', { method: 'GET' });
    expect(res.status).toBe(401);
  });

  test('400 on missing data', async () => {
    await using world = await openMatchmakingSimWorld({ seed: 111 });
    const app = world.mm.app({ requireAuth: defaultStubAuth });
    const res = await postJson(app, '/join', { formulas: [RatingFormula] });
    expect(res.status).toBe(400);
  });

  test('400 on non-keyword key in data', async () => {
    await using world = await openMatchmakingSimWorld({ seed: 112 });
    const app = world.mm.app({ requireAuth: defaultStubAuth });
    const res = await postJson(app, '/join', {
      data: { badkey: 1 },
      formulas: [RatingFormula],
    });
    expect(res.status).toBe(400);
  });

  test('400 on empty formulas array', async () => {
    await using world = await openMatchmakingSimWorld({ seed: 113 });
    const app = world.mm.app({ requireAuth: defaultStubAuth });
    const res = await postJson(app, '/join', {
      data: { 'mmtest/rating': 1000 },
      formulas: [],
    });
    expect(res.status).toBe(400);
  });

  test('400 on negative numeric weight', async () => {
    await using world = await openMatchmakingSimWorld({ seed: 114 });
    const app = world.mm.app({ requireAuth: defaultStubAuth });
    const res = await postJson(app, '/join', {
      data: { 'mmtest/rating': 1000 },
      formulas: [{ numeric: [{ path: 'mmtest/rating', weight: -1 }] }],
    });
    expect(res.status).toBe(400);
  });

  test('paired participants see the same matchId over HTTP', async () => {
    await using world = await openMatchmakingSimWorld({ seed: 115 });
    const app = world.mm.app({ requireAuth: defaultStubAuth });
    const a = await postJson(app, '/join', {
      data: { 'mmtest/rating': 1000, 'mmtest/name': 'a' },
      formulas: [RatingFormula],
    });
    expect(a.status).toBe(200);
    const aBody = (await a.json()) as { participantId: string };
    const b = await postJson(app, '/join', {
      data: { 'mmtest/rating': 1020, 'mmtest/name': 'b' },
      formulas: [RatingFormula],
    });
    const bBody = (await b.json()) as { participantId: string };
    await world.tick({ maxPassesPerPartition: 4 });
    const aStatus = await getStatus(app, aBody.participantId);
    expect(aStatus.response.status).toBe(200);
    const aMatched = expectMatched(aStatus.body);
    expect(aMatched.matchId).toMatch(UUID_REGEX);
    expect(aMatched.peers.map((p) => p.participantId)).toEqual([
      bBody.participantId,
    ]);
    const bMatched = expectMatched(
      (await getStatus(app, bBody.participantId)).body
    );
    expect(bMatched.matchId).toBe(aMatched.matchId);
  });

  test('leave removes a waiting participant', async () => {
    await using world = await openMatchmakingSimWorld({ seed: 116 });
    const app = world.mm.app({ requireAuth: defaultStubAuth });
    const a = await postJson(app, '/join', {
      data: { 'mmtest/rating': 1000 },
      formulas: [RatingFormula],
    });
    const { participantId } = (await a.json()) as { participantId: string };
    const res = await postJson(app, '/leave', { participantId });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { removed: boolean }).removed).toBe(true);
    expect((await getStatus(app, participantId)).response.status).toBe(404);
  });

  test('update-formulas 404 when unknown; updates when waiting', async () => {
    await using world = await openMatchmakingSimWorld({ seed: 117 });
    const app = world.mm.app({ requireAuth: defaultStubAuth });
    const missing = await postJson(
      app,
      '/update-formulas/00000000-0000-0000-0000-000000000000',
      { formulas: [RatingFormula] }
    );
    expect(missing.status).toBe(404);
    const a = await postJson(app, '/join', {
      data: { 'mmtest/rating': 1000 },
      formulas: [RatingFormula],
    });
    const { participantId } = (await a.json()) as { participantId: string };
    const upd = await postJson(app, `/update-formulas/${participantId}`, {
      formulas: [{ numeric: [{ path: 'mmtest/rating', weight: 2 }] }],
    });
    expect(upd.status).toBe(200);
    expect(((await upd.json()) as { updated: boolean }).updated).toBe(true);
  });

  test('accepts groupSize 3 over HTTP', async () => {
    await using world = await openMatchmakingSimWorld({ seed: 118 });
    const app = world.mm.app({ requireAuth: defaultStubAuth });
    const res = await postJson(app, '/join', {
      data: { 'mmtest/rating': 1000 },
      formulas: [RatingFormula],
      groupSize: 3,
    });
    expect(res.status).toBe(200);
    expect(
      ((await res.json()) as { participantId: string }).participantId
    ).toBeDefined();
  });
});
