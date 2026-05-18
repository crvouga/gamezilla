import { PGlite } from '@electric-sql/pglite';
import { Assert } from '@gamezilla/lib/assert';
import { createAttrNamespace } from '@gamezilla/lib/attribute';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import type { Hono, MiddlewareHandler } from 'hono';
import { Matchmaking, type MatchmakingOptions } from './matchmaking';
import { createPgliteSqlClient } from './pglite-adapter';
import type { SqlClient } from './sql-client';
import type { FormulaWire } from './wire';
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

let disposeTestCrashHandler: () => void;
beforeAll(() => {
  disposeTestCrashHandler = Assert.registerCrashHandler({
    priority: 0,
    match: () => true,
    crash(message, context) {
      throw new Error(
        context === undefined
          ? message
          : `${message} ${JSON.stringify(context)}`
      );
    },
  });
});
afterAll(() => {
  disposeTestCrashHandler();
});

type Harness = {
  db: PGlite;
  mm: Matchmaking;
  app: Hono;
};

// The HTTP app is now pure SELECT/INSERT only — no opportunistic kicks
// at all. Every test drives passes via `h.mm.tick()` explicitly. This
// is the design point that lets the request envelope scale to chess.com
// at near-linear cost in isolate count.
async function bootHarness(
  overrides?: Partial<Pick<MatchmakingOptions, 'schema' | 'tuning'>>
): Promise<Harness> {
  const db = await PGlite.create();
  const sqlClient = createPgliteSqlClient(db);
  const schema = overrides?.schema ?? {};
  const mm = new Matchmaking({
    storage: { sqlClient },
    schema,
    ...(overrides?.tuning !== undefined ? { tuning: overrides.tuning } : {}),
  });
  await mm.ready();
  return {
    db,
    mm,
    app: mm.app({ requireAuth: stubAuth }),
  };
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
  app: Hono,
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
  app: Hono,
  participantId: string
): Promise<{ readonly response: Response; readonly body: StatusResult }> {
  const response = await app.request(`/status/${participantId}`, {
    headers: AUTH_HEADERS,
  });
  const body = (await response.json()) as StatusResult;
  return { response, body };
}

describe('Matchmaking.app - auth', () => {
  test('rejects requests without the auth header', async () => {
    const res = await h.app.request('/status/x', { method: 'GET' });
    expect(res.status).toBe(401);
  });
});

describe('Matchmaking.app - /join validation', () => {
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

describe('Matchmaking.app - /join + /status flow', () => {
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

    // Opportunistic passes happen via /join+/status. Drive an explicit
    // tick to remove the test's dependency on waitUntil timing.
    await h.mm.tick({ maxPassesPerPartition: 4 });

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

describe('Matchmaking.app - OR-of-formulas over HTTP', () => {
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

    await h.mm.tick({ maxPassesPerPartition: 1 });

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

    await h.mm.tick({ maxPassesPerPartition: 4 });

    const { body } = await getStatus(h.app, aBody.participantId);
    expect(body.status).toBe('waiting');
  });
});

describe('Matchmaking.app - /leave', () => {
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

describe('Matchmaking.app - /status/:participantId', () => {
  test('404 for unknown id', async () => {
    const res = await h.app.request(
      '/status/00000000-0000-0000-0000-000000000000',
      { headers: AUTH_HEADERS }
    );
    expect(res.status).toBe(404);
  });
});

describe('Matchmaking.app - SQL roundtrip count (chess.com-scale regression)', () => {
  // The whole point of v3 is that /join is one SQL roundtrip (a CTE
  // doing INSERT + UPSERT) and /status is at most two (waiting/matched
  // UNION + optional peer fetch). If anyone reintroduces opportunistic
  // pass/sweep calls per-request these numbers explode and this test
  // fails loudly.
  test('/join issues exactly one SQL roundtrip; /status (waiting) issues exactly one', async () => {
    const db = await PGlite.create();
    let count = 0;
    const base = createPgliteSqlClient(db);
    const counting: SqlClient = {
      async query(sql, params) {
        count += 1;
        return await base.query(sql, params);
      },
      tx(fn) {
        return base.tx((inner) =>
          fn({
            async query(sql, params) {
              count += 1;
              return await inner.query(sql, params);
            },
            tx() {
              throw new Error('nested tx not used');
            },
          })
        );
      },
    };
    const mm = new Matchmaking({
      storage: { sqlClient: counting },
      schema: {},
    });
    await mm.ready();
    const app = mm.app({ requireAuth: stubAuth });
    try {
      count = 0;
      const join = await postJson(app, '/join', {
        data: { 'mmtest/rating': 1000 },
        formulas: [RatingFormula],
      });
      expect(join.status).toBe(200);
      const { participantId } = (await join.json()) as {
        participantId: string;
      };
      expect(count).toBe(1);

      count = 0;
      const status = await app.request(`/status/${participantId}`, {
        headers: AUTH_HEADERS,
      });
      expect(status.status).toBe(200);
      expect(count).toBe(1);
    } finally {
      await db.close();
    }
  });

  test('/status response carries Cache-Control: private, max-age=1', async () => {
    const a = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000 },
      formulas: [RatingFormula],
    });
    const { participantId } = (await a.json()) as { participantId: string };
    const res = await h.app.request(`/status/${participantId}`, {
      headers: AUTH_HEADERS,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, max-age=1');
  });
});

describe('Matchmaking.app - partitioned schema', () => {
  test('only matches participants that share the partition key', async () => {
    const partitioned = await bootHarness({
      schema: { partitionKeys: ['mmtest/kind'] },
    });
    try {
      const beta1 = await postJson(partitioned.app, '/join', {
        data: { 'mmtest/rating': 1000, 'mmtest/kind': 'beta' },
        formulas: [BetaKindFormula],
      });
      const beta1Body = (await beta1.json()) as { participantId: string };

      const alphaFirst = await postJson(partitioned.app, '/join', {
        data: { 'mmtest/rating': 1000, 'mmtest/kind': 'alpha' },
        formulas: [AlphaKindFormula],
      });
      const alphaFirstBody = (await alphaFirst.json()) as {
        participantId: string;
      };
      const alphaSecond = await postJson(partitioned.app, '/join', {
        data: { 'mmtest/rating': 1010, 'mmtest/kind': 'alpha' },
        formulas: [AlphaKindFormula],
      });
      const alphaSecondBody = (await alphaSecond.json()) as {
        participantId: string;
      };

      // tick fans out across active partitions. Only the alpha pair is
      // matchable (the beta participant is alone in its partition), so
      // the aggregate match count still pins to exactly 1.
      const res = await partitioned.mm.tick({ maxPassesPerPartition: 1 });
      expect(res.matches).toBe(1);

      const alphaStatus = await getStatus(
        partitioned.app,
        alphaFirstBody.participantId
      );
      expect(alphaStatus.body.status).toBe('matched');
      expect(
        (alphaStatus.body as MatchedStatus).peers.map((p) => p.participantId)
      ).toEqual([alphaSecondBody.participantId]);
      const betaStatus = await getStatus(
        partitioned.app,
        beta1Body.participantId
      );
      expect(betaStatus.body.status).toBe('waiting');
    } finally {
      await partitioned.db.close();
    }
  });
});
