/**
 * HTTP app contract against any {@link Matchmaking} factory.
 */

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import type { Hono } from 'hono';
import type { FormulaWire } from '../interface/formula-wire';
import type { StatusResult } from '../interface/types';
import {
  type BootOverrides,
  defaultStubAuth,
  expectMatched,
  type MatchmakingFactory,
  registerTestCrashHandler,
  TEST_AUTH_HEADERS,
  UUID_REGEX,
} from './fixtures';

const RatingFormula: FormulaWire = {
  numeric: [{ path: 'mmtest/rating', weight: 1 }],
};

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
      ...TEST_AUTH_HEADERS,
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
    headers: TEST_AUTH_HEADERS,
  });
  const body = (await response.json()) as StatusResult;
  return { response, body };
}

export function runMatchmakingAppContractTests(
  factory: MatchmakingFactory
): void {
  let disposeTestCrashHandler: () => void;
  beforeAll(() => {
    disposeTestCrashHandler = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeTestCrashHandler();
  });

  async function bootApp(overrides?: BootOverrides) {
    const mm = await Promise.resolve(factory(overrides));
    return { mm, app: mm.app({ requireAuth: defaultStubAuth }) };
  }

  let h: Awaited<ReturnType<typeof bootApp>>;
  beforeEach(async () => {
    h = await bootApp();
  });

  describe('Matchmaking.app - auth', () => {
    test('rejects requests without the auth header', async () => {
      const res = await h.app.request('/status/x', { method: 'GET' });
      expect(res.status).toBe(401);
    });
  });

  describe('Matchmaking.app - /join validation', () => {
    test('400 on missing data', async () => {
      const res = await postJson(h.app, '/join', {
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

    test('400 on empty formulas array', async () => {
      const res = await postJson(h.app, '/join', {
        data: { 'mmtest/rating': 1000 },
        formulas: [],
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
      const bBody = (await b.json()) as { participantId: string };
      await h.mm.tick({ maxPassesPerPartition: 4 });
      const aStatus = await getStatus(h.app, aBody.participantId);
      expect(aStatus.response.status).toBe(200);
      const aMatched = expectMatched(aStatus.body);
      expect(aMatched.matchId).toMatch(UUID_REGEX);
      expect(aMatched.peers.map((p) => p.participantId)).toEqual([
        bBody.participantId,
      ]);
      const bMatched = expectMatched(
        (await getStatus(h.app, bBody.participantId)).body
      );
      expect(bMatched.matchId).toBe(aMatched.matchId);
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
      expect(((await res.json()) as { removed: boolean }).removed).toBe(true);
      expect((await getStatus(h.app, participantId)).response.status).toBe(404);
    });
  });

  describe('Matchmaking.app - update-formulas', () => {
    test('404 when participant is unknown', async () => {
      const res = await postJson(
        h.app,
        '/update-formulas/00000000-0000-0000-0000-000000000000',
        { formulas: [RatingFormula] }
      );
      expect(res.status).toBe(404);
    });

    test('updates formulas for a waiting participant', async () => {
      const a = await postJson(h.app, '/join', {
        data: { 'mmtest/rating': 1000 },
        formulas: [RatingFormula],
      });
      const { participantId } = (await a.json()) as { participantId: string };
      const upd = await postJson(h.app, `/update-formulas/${participantId}`, {
        formulas: [
          {
            numeric: [{ path: 'mmtest/rating', weight: 2 }],
          },
        ],
      });
      expect(upd.status).toBe(200);
      expect(((await upd.json()) as { updated: boolean }).updated).toBe(true);
      expect(
        ((await getStatus(h.app, participantId)).body as StatusResult).status
      ).toBe('waiting');
    });
  });

  describe('Matchmaking.app - groupSize', () => {
    test('accepts groupSize 3 over HTTP', async () => {
      const res = await postJson(h.app, '/join', {
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
}
