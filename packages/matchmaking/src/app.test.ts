import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { MiddlewareHandler } from 'hono';
import { createMatchmakingApp } from './app';
import { Matchmaker } from './matchmaker';
import { migrate } from './migrate';
import { createPgliteSqlClient } from './pglite-adapter';
import type { MatchedPlayer, StatusResult } from './types';

const stubAuth: MiddlewareHandler = async (c, next) => {
  if (c.req.header('x-test-user') === undefined) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  return await next();
};

type Harness = {
  db: PGlite;
  app: ReturnType<typeof createMatchmakingApp>;
  seen: MatchedPlayer[][];
};

async function bootHarness(): Promise<Harness> {
  const db = await PGlite.create();
  const sqlClient = createPgliteSqlClient(db);
  await migrate({ sqlClient });
  const seen: MatchedPlayer[][] = [];
  const matchmaker = new Matchmaker({
    sqlClient,
    onMatch: (group) => {
      seen.push([...group]);
    },
  });
  const app = createMatchmakingApp({ matchmaker, requireAuth: stubAuth });
  return { db, app, seen };
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

describe('createMatchmakingApp - auth', () => {
  test('rejects requests without the auth header', async () => {
    const res = await h.app.request('/status/x', { method: 'GET' });
    expect(res.status).toBe(401);
  });
});

describe('createMatchmakingApp - /join', () => {
  test('400 on missing rating', async () => {
    const res = await postJson(h.app, '/join', { data: {} });
    expect(res.status).toBe(400);
  });

  test('400 on non-object data', async () => {
    const res = await postJson(h.app, '/join', { rating: 1000, data: 'oops' });
    expect(res.status).toBe(400);
  });

  test('returns a player id and triggers an immediate match pass', async () => {
    const a = await postJson(h.app, '/join', {
      rating: 1000,
      data: { name: 'a' },
    });
    expect(a.status).toBe(200);
    const aBody = (await a.json()) as { playerId: string };
    expect(typeof aBody.playerId).toBe('string');

    const b = await postJson(h.app, '/join', {
      rating: 1020,
      data: { name: 'b' },
    });
    expect(b.status).toBe(200);
    const bBody = (await b.json()) as { playerId: string };

    expect(h.seen.length).toBe(1);
    expect(h.seen[0]!.map((p) => p.playerId).sort()).toEqual(
      [aBody.playerId, bBody.playerId].sort()
    );

    const status = await h.app.request(`/status/${aBody.playerId}`, {
      headers: AUTH_HEADERS,
    });
    expect(status.status).toBe(200);
    const statusBody = (await status.json()) as StatusResult;
    expect(statusBody.status).toBe('matched');
  });
});

describe('createMatchmakingApp - /leave', () => {
  test('removes a waiting player', async () => {
    const a = await postJson(h.app, '/join', { rating: 1000, data: {} });
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
