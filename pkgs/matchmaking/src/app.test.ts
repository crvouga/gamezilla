import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import type { Sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { createPgliteSqlClient } from '@pkgs/sql-client/postgres/impl-pglite';
import { Matchmaking } from './matchmaking';
import {
  type AppHarness,
  bootMatchmakingApp,
  defaultStubAuth,
  getStatus,
  NameAttr,
  postJson,
  RatingAttr,
  registerTestCrashHandler,
  TEST_AUTH_HEADERS,
  UUID_REGEX,
} from './test-harness';
import type { MatchedStatus } from './types';
import type { FormulaWire } from './wire';

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

let disposeTestCrashHandler: () => void;
beforeAll(() => {
  disposeTestCrashHandler = registerTestCrashHandler();
});
afterAll(() => {
  disposeTestCrashHandler();
});

let h: AppHarness;
beforeEach(async () => {
  h = await bootMatchmakingApp();
});
afterEach(async () => {
  await h.db.close();
});

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
      headers: TEST_AUTH_HEADERS,
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
      { headers: TEST_AUTH_HEADERS }
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
  test('/join issues exactly one SQL roundtrip; /status (waiting) issues exactly one (steady state)', async () => {
    const db = await PGlite.create();
    let count = 0;
    const base = createPgliteSqlClient(db);
    const counting: SqlClient = {
      ...base,
      async query<T extends Record<string, unknown>>(
        query: Sql<T>
      ): Promise<T[]> {
        count += 1;
        return await base.query(query);
      },
      transaction(fn) {
        return base.transaction((inner) =>
          fn({
            ...inner,
            async query<T extends Record<string, unknown>>(
              query: Sql<T>
            ): Promise<T[]> {
              count += 1;
              return await inner.query(query);
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
    const app = mm.app({ requireAuth: defaultStubAuth });
    try {
      // First call runs the lazy schema-fingerprint probe (one extra
      // SELECT, cached for the lifetime of the process). Burn that
      // one-shot here so the steady-state counts below assert the
      // chess.com-scale 1-SQL-per-request guarantee.
      const warmup = await postJson(app, '/join', {
        data: { 'mmtest/rating': 999 },
        formulas: [RatingFormula],
      });
      expect(warmup.status).toBe(200);

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
        headers: TEST_AUTH_HEADERS,
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
      headers: TEST_AUTH_HEADERS,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, max-age=1');
  });
});

// ---------------------------------------------------------------------
// Phase 2 — production hardening test gaps for the HTTP boundary
// ---------------------------------------------------------------------

describe('Matchmaking.app - 500 sanitisation', () => {
  // Force a SQL failure deep inside `/join` and assert the client
  // sees `{ error: 'internal' }` — not the raw error message (which
  // could leak SQL fragments, bind values, etc.).
  test('500 returns { error: "internal" }', async () => {
    const db = await PGlite.create();
    const base = createPgliteSqlClient(db);
    let failOnInsert = false;
    const flaky: SqlClient = {
      ...base,
      async query<T extends Record<string, unknown>>(
        query: Sql<T>
      ): Promise<T[]> {
        if (
          failOnInsert &&
          query.sql.includes('INSERT INTO matchmaking_waiting')
        ) {
          throw new Error('secret-database-internal-detail-do-not-leak');
        }
        return await base.query(query);
      },
    };
    const mm = new Matchmaking({
      storage: { sqlClient: flaky },
      schema: {},
    });
    await mm.ready();
    const app = mm.app({ requireAuth: defaultStubAuth });
    try {
      failOnInsert = true;
      const res = await postJson(app, '/join', {
        data: { 'mmtest/rating': 1000 },
        formulas: [RatingFormula],
      });
      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('internal');
      expect(body.error).not.toContain('secret-database-internal-detail');
    } finally {
      await db.close();
    }
  });
});

describe('Matchmaking.app - payload limits', () => {
  function bigString(bytes: number): string {
    return 'a'.repeat(bytes);
  }

  test('64-key data is accepted (boundary)', async () => {
    const data: Record<string, unknown> = {};
    for (let i = 0; i < 64; i += 1) {
      data[`mmtest/k${String(i)}`] = i;
    }
    data['mmtest/rating'] = 1000;
    // 65 keys total now — back off one for the exact-64-keys boundary.
    delete data['mmtest/k63'];
    const res = await postJson(h.app, '/join', {
      data,
      formulas: [RatingFormula],
    });
    expect(res.status).toBe(200);
  });

  test('65-key data is rejected (over by one)', async () => {
    const data: Record<string, unknown> = {};
    for (let i = 0; i < 64; i += 1) {
      data[`mmtest/k${String(i)}`] = i;
    }
    data['mmtest/rating'] = 1000;
    const res = await postJson(h.app, '/join', {
      data,
      formulas: [RatingFormula],
    });
    expect(res.status).toBe(400);
  });

  test('1024-byte string value is accepted (boundary)', async () => {
    const res = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000, 'mmtest/name': bigString(1024) },
      formulas: [RatingFormula],
    });
    expect(res.status).toBe(200);
  });

  test('1025-byte string value is rejected', async () => {
    const res = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000, 'mmtest/name': bigString(1025) },
      formulas: [RatingFormula],
    });
    expect(res.status).toBe(400);
  });

  test('8-formula array is accepted (boundary)', async () => {
    const formulas = Array.from({ length: 8 }, () => RatingFormula);
    const res = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000 },
      formulas,
    });
    expect(res.status).toBe(200);
  });

  test('9-formula array is rejected', async () => {
    const formulas = Array.from({ length: 9 }, () => RatingFormula);
    const res = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000 },
      formulas,
    });
    expect(res.status).toBe(400);
  });

  test('per-formula term cap (32) is enforced', async () => {
    const tooManyTerms = {
      numeric: Array.from({ length: 33 }, (_, i) => ({
        path: `mmtest/n${String(i)}`,
        weight: 1,
      })),
    };
    const res = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000 },
      formulas: [tooManyTerms],
    });
    expect(res.status).toBe(400);
  });

  test('long formula path (>1024 bytes) is rejected', async () => {
    const res = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000 },
      formulas: [{ numeric: [{ path: bigString(1100), weight: 1 }] }],
    });
    expect(res.status).toBe(400);
  });
});

describe('Matchmaking.app - empty partitionKeys collapse', () => {
  test('all joiners share one shard when partitionKeys is empty', async () => {
    const explicit = await bootMatchmakingApp({
      schema: { partitionKeys: [] },
    });
    try {
      const a = await postJson(explicit.app, '/join', {
        data: { 'mmtest/rating': 1000 },
        formulas: [RatingFormula],
      });
      const aBody = (await a.json()) as { participantId: string };
      const b = await postJson(explicit.app, '/join', {
        data: { 'mmtest/rating': 1010 },
        formulas: [RatingFormula],
      });
      const bBody = (await b.json()) as { participantId: string };
      const drained = await explicit.mm.tick({ maxPassesPerPartition: 4 });
      expect(drained.partitions).toBe(1);
      expect(drained.matches).toBe(1);
      const aStatus = await getStatus(explicit.app, aBody.participantId);
      expect(aStatus.body.status).toBe('matched');
      expect((aStatus.body as MatchedStatus).peers[0]?.participantId).toBe(
        bBody.participantId
      );
    } finally {
      await explicit.db.close();
    }
  });
});

describe('Matchmaking.app - auth header shapes', () => {
  test('rejects requests with a malformed authorization header value', async () => {
    // Stub auth treats absence of `x-test-user` as 401. Send something
    // that looks like a header (Bearer-shaped string) but lacks our
    // stub's expected token.
    const res = await h.app.request('/status/x', {
      headers: { Authorization: 'Bearer not-a-real-token' },
    });
    expect(res.status).toBe(401);
  });
});

describe('Matchmaking.app - priority + metadata + updateFormulas (HTTP)', () => {
  test('400 on priority below -1000', async () => {
    const res = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000 },
      formulas: [RatingFormula],
      priority: -1001,
    });
    expect(res.status).toBe(400);
  });

  test('400 on priority above 1000', async () => {
    const res = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000 },
      formulas: [RatingFormula],
      priority: 1001,
    });
    expect(res.status).toBe(400);
  });

  test('400 on non-object metadata', async () => {
    const res = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000 },
      formulas: [RatingFormula],
      metadata: 'not-an-object',
    });
    expect(res.status).toBe(400);
  });

  test('400 on metadata over 1024 bytes', async () => {
    const res = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000 },
      formulas: [RatingFormula],
      metadata: { blob: 'x'.repeat(2048) },
    });
    expect(res.status).toBe(400);
  });

  test('metadata round-trips through /join + /status', async () => {
    const a = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000 },
      formulas: [RatingFormula],
      metadata: { tag: 'A', score: 7 },
    });
    const aBody = (await a.json()) as { participantId: string };
    const status = await getStatus(h.app, aBody.participantId);
    expect(status.body.status).toBe('waiting');
    expect(status.body.metadata).toEqual({ tag: 'A', score: 7 });
  });

  test('POST /update-formulas/:id 200 on waiting participant', async () => {
    const a = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000 },
      formulas: [RatingFormula],
    });
    const aBody = (await a.json()) as { participantId: string };
    const upd = await postJson(
      h.app,
      `/update-formulas/${aBody.participantId}`,
      { formulas: [RatingFormula] }
    );
    expect(upd.status).toBe(200);
    expect(await upd.json()).toEqual({ updated: true });
  });

  test('POST /update-formulas/:id 404 on unknown id', async () => {
    const upd = await postJson(
      h.app,
      '/update-formulas/00000000-0000-0000-0000-000000000000',
      { formulas: [RatingFormula] }
    );
    expect(upd.status).toBe(404);
  });

  test('POST /update-formulas/:id 404 once participant is matched', async () => {
    const a = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000 },
      formulas: [RatingFormula],
    });
    const aBody = (await a.json()) as { participantId: string };
    await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1010 },
      formulas: [RatingFormula],
    });
    await h.mm.tick({ maxPassesPerPartition: 1 });
    const upd = await postJson(
      h.app,
      `/update-formulas/${aBody.participantId}`,
      { formulas: [RatingFormula] }
    );
    expect(upd.status).toBe(404);
  });

  test('POST /update-formulas/:id 400 on invalid body (empty formulas)', async () => {
    const a = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000 },
      formulas: [RatingFormula],
    });
    const aBody = (await a.json()) as { participantId: string };
    const upd = await postJson(
      h.app,
      `/update-formulas/${aBody.participantId}`,
      { formulas: [] }
    );
    expect(upd.status).toBe(400);
  });
});

describe('Matchmaking.app - groupSize (HTTP surface)', () => {
  test('400 on groupSize: 1 (below minimum)', async () => {
    const res = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000 },
      formulas: [RatingFormula],
      groupSize: 1,
    });
    expect(res.status).toBe(400);
  });

  test('400 on groupSize: 17 (above maximum)', async () => {
    const res = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000 },
      formulas: [RatingFormula],
      groupSize: 17,
    });
    expect(res.status).toBe(400);
  });

  test('400 on non-integer groupSize', async () => {
    const res = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000 },
      formulas: [RatingFormula],
      groupSize: 2.5,
    });
    expect(res.status).toBe(400);
  });

  test('400 on string groupSize', async () => {
    const res = await postJson(h.app, '/join', {
      data: { 'mmtest/rating': 1000 },
      formulas: [RatingFormula],
      groupSize: '2',
    });
    expect(res.status).toBe(400);
  });

  test('groupSize: 3 over HTTP - three participants pair into one match with two peers each', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const r = await postJson(h.app, '/join', {
        data: { 'mmtest/rating': 1000 + i * 5 },
        formulas: [RatingFormula],
        groupSize: 3,
      });
      const body = (await r.json()) as { participantId: string };
      ids.push(body.participantId);
    }
    const tick = await h.mm.tick({ maxPassesPerPartition: 1 });
    expect(tick.matches).toBe(1);
    const id0 = ids[0];
    expect(id0).toBeDefined();
    const s0 = await getStatus(h.app, id0 as string);
    expect(s0.body.status).toBe('matched');
    expect((s0.body as MatchedStatus).peers).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------
// Original tests resume below
// ---------------------------------------------------------------------

describe('Matchmaking.app - partitioned schema', () => {
  test('only matches participants that share the partition key', async () => {
    const partitioned = await bootMatchmakingApp({
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
