import { PGlite } from '@electric-sql/pglite';
import { createAttrNamespace } from '@gamezilla/lib/attribute';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { MiddlewareHandler } from 'hono';
import { createMatchmakingApp } from './app';
import { Matchmaker, type FormulaWire } from './matchmaker';
import { migrate } from './migrate';
import { createPgliteSqlClient } from './pglite-adapter';
import type { MatchedStatus, StatusResult } from './types';

const testNs = createAttrNamespace('mmtest');
const RatingAttr = testNs('rating', (v): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error('mmtest/rating must be a finite number');
  }
  return v;
});
const NameAttr = testNs('name', (v): string =>
  typeof v === 'string' ? v : ''
);

const RatingFormula: FormulaWire = {
  numeric: [{ path: RatingAttr.key, weight: 1 }],
};

const ChessFormula: FormulaWire = {
  numeric: [{ path: RatingAttr.key, weight: 1 }],
  partition: [{ path: 'mmtest/game' }],
};

const BattleshipFormula: FormulaWire = {
  numeric: [{ path: RatingAttr.key, weight: 1 }],
  partition: [{ path: 'mmtest/game' }],
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const stubAuth: MiddlewareHandler = async (c, next) => {
  if (c.req.header('x-test-user') === undefined) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  return await next();
};

type Harness = {
  db: PGlite;
  app: ReturnType<typeof createMatchmakingApp>;
};

async function bootHarness(): Promise<Harness> {
  const db = await PGlite.create();
  const sqlClient = createPgliteSqlClient(db);
  await migrate({ sqlClient });
  const matchmaker = new Matchmaker({ sqlClient });
  const app = createMatchmakingApp({ matchmaker, requireAuth: stubAuth });
  return { db, app };
}

const AUTH_HEADERS = { 'x-test-user': 'tester' };

let h: Harness;

beforeEach(async () => {
  h = await bootHarness();
});

afterEach(async () => {
  await h.db.close();
});

async function postJson(
  app: Harness['app'],
  path: string,
  body: unknown,
  extra?: Record<string, string>
): Promise<Response> {
  return await app.request(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...AUTH_HEADERS,
      ...(extra ?? {}),
    },
    body: JSON.stringify(body),
  });
}

async function getStatus(
  app: Harness['app'],
  playerId: string
): Promise<{ readonly response: Response; readonly body: StatusResult }> {
  const response = await app.request(`/status/${playerId}`, {
    headers: AUTH_HEADERS,
  });
  const body = (await response.json()) as StatusResult;
  return { response, body };
}

describe('createMatchmakingApp - auth', () => {
  test('rejects requests without the auth header', async () => {
    const res = await h.app.request('/status/x', { method: 'GET' });
    expect(res.status).toBe(401);
  });
});

describe('createMatchmakingApp - /join validation', () => {
  test('400 on missing data', async () => {
    const res = await postJson(h.app, '/join', { formulas: [RatingFormula] });
    expect(res.status).toBe(400);
  });

  test('400 on non-object data', async () => {
    const res = await postJson(h.app, '/join', {
      data: 'oops',
      formulas: [RatingFormula],
    });
    expect(res.status).toBe(400);
  });

  test('400 on non-keyword key in data', async () => {
    const res = await postJson(h.app, '/join', {
      data: { badkey: 1 },
      formulas: [RatingFormula],
    });
    expect(res.status).toBe(400);
  });

  test('400 on missing formulas', async () => {
    const res = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000 },
    });
    expect(res.status).toBe(400);
  });

  test('400 on empty formulas array', async () => {
    const res = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000 },
      formulas: [],
    });
    expect(res.status).toBe(400);
  });

  test('400 on formula with no terms', async () => {
    const res = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000 },
      formulas: [{ numeric: [] }],
    });
    expect(res.status).toBe(400);
  });

  test('400 on negative numeric weight', async () => {
    const res = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000 },
      formulas: [{ numeric: [{ path: 'mmtest/rating', weight: -1 }] }],
    });
    expect(res.status).toBe(400);
  });
});

describe('createMatchmakingApp - /join + /status flow', () => {
  test('paired players see the same matchId and each other as opponents', async () => {
    const a = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000, 'mmtest/name': 'a' },
      formulas: [RatingFormula],
    });
    expect(a.status).toBe(200);
    const aBody = (await a.json()) as { playerId: string };

    const b = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1020, 'mmtest/name': 'b' },
      formulas: [RatingFormula],
    });
    expect(b.status).toBe(200);
    const bBody = (await b.json()) as { playerId: string };

    const aStatus = await getStatus(h.app, aBody.playerId);
    expect(aStatus.response.status).toBe(200);
    expect(aStatus.body.status).toBe('matched');
    const aMatched = aStatus.body as MatchedStatus;
    expect(aMatched.matchId).toMatch(UUID_REGEX);
    expect(aMatched.opponents.map((p) => p.playerId)).toEqual([bBody.playerId]);

    const bStatus = await getStatus(h.app, bBody.playerId);
    const bMatched = bStatus.body as MatchedStatus;
    expect(bMatched.matchId).toBe(aMatched.matchId);
    expect(bMatched.opponents.map((p) => p.playerId)).toEqual([aBody.playerId]);
  });

  test('NameAttr helper is wired', () => {
    expect(NameAttr('alice')).toEqual({ 'mmtest/name': 'alice' });
  });
});

describe('createMatchmakingApp - OR-of-formulas over HTTP', () => {
  test('A=[chess, battleship] + B=[chess], both playing chess, pair up', async () => {
    const a = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000, 'mmtest/game': 'chess' },
      formulas: [ChessFormula, BattleshipFormula],
    });
    expect(a.status).toBe(200);
    const aBody = (await a.json()) as { playerId: string };

    const b = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1010, 'mmtest/game': 'chess' },
      formulas: [ChessFormula],
    });
    expect(b.status).toBe(200);
    const bBody = (await b.json()) as { playerId: string };

    const { body } = await getStatus(h.app, aBody.playerId);
    expect(body.status).toBe('matched');
    expect((body as MatchedStatus).opponents.map((p) => p.playerId)).toEqual([
      bBody.playerId,
    ]);
  });

  test('different-game players with single formulas stay waiting', async () => {
    const a = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000, 'mmtest/game': 'chess' },
      formulas: [ChessFormula],
    });
    const aBody = (await a.json()) as { playerId: string };

    await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1010, 'mmtest/game': 'battleship' },
      formulas: [BattleshipFormula],
    });

    const { body } = await getStatus(h.app, aBody.playerId);
    expect(body.status).toBe('waiting');
  });
});

describe('createMatchmakingApp - /leave', () => {
  test('removes a waiting player', async () => {
    const a = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000 },
      formulas: [RatingFormula],
    });
    const { playerId } = (await a.json()) as { playerId: string };

    const res = await postJson(h.app, '/leave', { playerId });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { removed: boolean };
    expect(body.removed).toBe(true);

    const status = await h.app.request(`/status/${playerId}`, {
      headers: AUTH_HEADERS,
    });
    expect(status.status).toBe(404);
  });

  test('400 on missing playerId', async () => {
    const res = await postJson(h.app, '/leave', {});
    expect(res.status).toBe(400);
  });
});

describe('createMatchmakingApp - /status/:playerId', () => {
  test('404 for unknown id', async () => {
    const res = await h.app.request(
      '/status/00000000-0000-0000-0000-000000000000',
      { headers: AUTH_HEADERS }
    );
    expect(res.status).toBe(404);
  });
});
