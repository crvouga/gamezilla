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

const AlphaKindFormula: FormulaWire = {
  numeric: [{ path: RatingAttr.key, weight: 1 }],
  partition: [{ path: 'mmtest/kind' }],
};

const BetaKindFormula: FormulaWire = {
  numeric: [{ path: RatingAttr.key, weight: 1 }],
  partition: [{ path: 'mmtest/kind' }],
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
  matchmaker: Matchmaker;
};

async function bootHarness(opts?: {
  readonly passOnRequest?: 'auto' | 'never';
}): Promise<Harness> {
  const db = await PGlite.create();
  const sqlClient = createPgliteSqlClient(db);
  await migrate({ sqlClient });
  // PGlite serializes queries; disable the SQL-side throttle so the
  // opportunistic /join+/status pass triggers fire deterministically.
  const matchmaker = new Matchmaker({ sqlClient, minPassIntervalMs: 0 });
  const passOnRequest = opts?.passOnRequest;
  const app =
    passOnRequest === undefined
      ? createMatchmakingApp({ matchmaker, requireAuth: stubAuth })
      : createMatchmakingApp({
          matchmaker,
          requireAuth: stubAuth,
          passOnRequest,
        });
  return { db, app, matchmaker };
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
  participantId: string
): Promise<{ readonly response: Response; readonly body: StatusResult }> {
  const response = await app.request(`/status/${participantId}`, {
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
  test('paired participants see the same matchId and each other as peers', async () => {
    const a = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000, 'mmtest/name': 'a' },
      formulas: [RatingFormula],
    });
    expect(a.status).toBe(200);
    const aBody = (await a.json()) as { participantId: string };

    const b = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1020, 'mmtest/name': 'b' },
      formulas: [RatingFormula],
    });
    expect(b.status).toBe(200);
    const bBody = (await b.json()) as { participantId: string };

    const aStatus = await getStatus(h.app, aBody.participantId);
    expect(aStatus.response.status).toBe(200);
    expect(aStatus.body.status).toBe('matched');
    const aMatched = aStatus.body as MatchedStatus;
    expect(aMatched.matchId).toMatch(UUID_REGEX);
    expect(aMatched.peers.map((p) => p.participantId)).toEqual([
      bBody.participantId,
    ]);

    const bStatus = await getStatus(h.app, bBody.participantId);
    const bMatched = bStatus.body as MatchedStatus;
    expect(bMatched.matchId).toBe(aMatched.matchId);
    expect(bMatched.peers.map((p) => p.participantId)).toEqual([
      aBody.participantId,
    ]);
  });

  test('NameAttr helper is wired', () => {
    expect(NameAttr('alice')).toEqual({ 'mmtest/name': 'alice' });
  });
});

describe('createMatchmakingApp - OR-of-formulas over HTTP', () => {
  test('A=[alpha, beta] + B=[alpha], both on alpha, pair up', async () => {
    const a = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000, 'mmtest/kind': 'alpha' },
      formulas: [AlphaKindFormula, BetaKindFormula],
    });
    expect(a.status).toBe(200);
    const aBody = (await a.json()) as { participantId: string };

    const b = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1010, 'mmtest/kind': 'alpha' },
      formulas: [AlphaKindFormula],
    });
    expect(b.status).toBe(200);
    const bBody = (await b.json()) as { participantId: string };

    const { body } = await getStatus(h.app, aBody.participantId);
    expect(body.status).toBe('matched');
    expect((body as MatchedStatus).peers.map((p) => p.participantId)).toEqual([
      bBody.participantId,
    ]);
  });

  test('different-kind participants with single formulas stay waiting', async () => {
    const a = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000, 'mmtest/kind': 'alpha' },
      formulas: [AlphaKindFormula],
    });
    const aBody = (await a.json()) as { participantId: string };

    await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1010, 'mmtest/kind': 'beta' },
      formulas: [BetaKindFormula],
    });

    const { body } = await getStatus(h.app, aBody.participantId);
    expect(body.status).toBe('waiting');
  });
});

describe('createMatchmakingApp - /leave', () => {
  test('removes a waiting participant', async () => {
    const a = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000 },
      formulas: [RatingFormula],
    });
    const { participantId } = (await a.json()) as { participantId: string };

    const res = await postJson(h.app, '/leave', { participantId });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { removed: boolean };
    expect(body.removed).toBe(true);

    const status = await h.app.request(`/status/${participantId}`, {
      headers: AUTH_HEADERS,
    });
    expect(status.status).toBe(404);
  });

  test('400 on missing participantId', async () => {
    const res = await postJson(h.app, '/leave', {});
    expect(res.status).toBe(400);
  });
});

describe('createMatchmakingApp - /status/:participantId', () => {
  test('404 for unknown id', async () => {
    const res = await h.app.request(
      '/status/00000000-0000-0000-0000-000000000000',
      { headers: AUTH_HEADERS }
    );
    expect(res.status).toBe(404);
  });
});

describe('createMatchmakingApp - partition-aware /join + /status', () => {
  // Drives the full HTTP flow with a partitioned schema and disables the
  // opportunistic pass — explicit matchmaker.runMatchPass(sig) calls keep
  // PGlite-driven timing deterministic and verify that the HTTP layer
  // stores partition_signature consistently with the JS-side
  // partitionSignatureFor computation.
  test('only matches participants that share the partition key', async () => {
    const isolated = await PGlite.create();
    const sqlClient = createPgliteSqlClient(isolated);
    await migrate({ sqlClient, schema: { partitionKeys: ['mmtest/kind'] } });
    const matchmaker = new Matchmaker({
      sqlClient,
      minPassIntervalMs: 0,
      partitionKeys: ['mmtest/kind'],
    });
    const app = createMatchmakingApp({
      matchmaker,
      requireAuth: stubAuth,
      passOnRequest: 'never',
    });
    try {
      const beta1 = await postJson(app, '/join', {
        data: { 'mmtest/rating': 1000, 'mmtest/kind': 'beta' },
        formulas: [BetaKindFormula],
      });
      const beta1Body = (await beta1.json()) as { participantId: string };

      const alphaFirst = await postJson(app, '/join', {
        data: { 'mmtest/rating': 1000, 'mmtest/kind': 'alpha' },
        formulas: [AlphaKindFormula],
      });
      const alphaFirstBody = (await alphaFirst.json()) as {
        participantId: string;
      };
      const alphaSecond = await postJson(app, '/join', {
        data: { 'mmtest/rating': 1010, 'mmtest/kind': 'alpha' },
        formulas: [AlphaKindFormula],
      });
      const alphaSecondBody = (await alphaSecond.json()) as {
        participantId: string;
      };

      // Run a pass against the alpha partition only. Beta waiters live in
      // a different shard and the partition-scoped snapshot CTE filters
      // them out before pairing.
      const alphaSig = matchmaker.partitionSignatureFor({
        'mmtest/kind': 'alpha',
      });
      const result = await matchmaker.runMatchPass(alphaSig);
      expect(result.matches).toBe(1);

      const alphaStatus = await getStatus(app, alphaFirstBody.participantId);
      expect(alphaStatus.body.status).toBe('matched');
      expect(
        (alphaStatus.body as MatchedStatus).peers.map((p) => p.participantId)
      ).toEqual([alphaSecondBody.participantId]);
      const betaStatus = await getStatus(app, beta1Body.participantId);
      expect(betaStatus.body.status).toBe('waiting');
    } finally {
      await isolated.close();
    }
  });
});

describe('createMatchmakingApp - passOnRequest=never', () => {
  test('/join does not trigger an opportunistic pass; status stays waiting until host runs one', async () => {
    const isolated = await PGlite.create();
    const sqlClient = createPgliteSqlClient(isolated);
    await migrate({ sqlClient });
    const matchmaker = new Matchmaker({ sqlClient, minPassIntervalMs: 0 });
    const app = createMatchmakingApp({
      matchmaker,
      requireAuth: stubAuth,
      passOnRequest: 'never',
    });
    try {
      const aRes = await app.request('/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS },
        body: JSON.stringify({
          data: { 'mmtest/rating': 1000 },
          formulas: [RatingFormula],
        }),
      });
      const aBody = (await aRes.json()) as { participantId: string };
      const bRes = await app.request('/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS },
        body: JSON.stringify({
          data: { 'mmtest/rating': 1020 },
          formulas: [RatingFormula],
        }),
      });
      await bRes.json();

      const stillWaiting = await app.request(`/status/${aBody.participantId}`, {
        headers: AUTH_HEADERS,
      });
      const stillBody = (await stillWaiting.json()) as StatusResult;
      expect(stillBody.status).toBe('waiting');

      // Host explicitly runs a pass — now the match lands.
      await matchmaker.runMatchPass('');
      const after = await app.request(`/status/${aBody.participantId}`, {
        headers: AUTH_HEADERS,
      });
      const afterBody = (await after.json()) as StatusResult;
      expect(afterBody.status).toBe('matched');
    } finally {
      await isolated.close();
    }
  });
});
