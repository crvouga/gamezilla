/**
 * Internal test-only helpers shared by `matchmaking.test.ts`,
 * `app.test.ts`, and `migrate.test.ts`. NOT part of the public API
 * surface — this file is intentionally absent from the package
 * `exports` map.
 *
 * Keeping the helpers in one place lets the per-test-file
 * `beforeAll`/`beforeEach` boilerplate stay one-liner. The boot
 * harness is deliberately tiny (PGlite + Matchmaking) — tests that
 * need richer setup (counting SqlClient, stubbed cron, etc.) keep
 * their own bespoke construction inline.
 *
 * @internal
 */

import { PGlite } from '@electric-sql/pglite';
import { Assert } from '@gamezilla/lib/assert';
import { createAttrNamespace } from '@gamezilla/lib/attribute';
import { expect } from 'bun:test';
import type { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { Matchmaking, type MatchmakingOptions } from './matchmaking';
import { createPgliteSqlClient } from './pglite-adapter';
import type { MatchedStatus, StatusResult } from './types';

/**
 * Test attribute namespace shared by every test file. Reusing the
 * same `mmtest/*` keyword namespace lets fixtures (data, formula
 * wires) cross-pollinate between files without name collisions.
 */
export const testNs = createAttrNamespace('mmtest');

export const RatingAttr = testNs('rating', (v): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error('mmtest/rating must be a finite number');
  }
  return v;
});

export const SkillAttr = testNs('skill', (v): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error('mmtest/skill must be a finite number');
  }
  return v;
});

export const NameAttr = testNs('name', (v): string =>
  typeof v === 'string' ? v : ''
);

export const RegionAttr = testNs('region', (v): string | undefined =>
  typeof v === 'string' ? v : undefined
);

export const KindAttr = testNs('kind', (v): string => {
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error('mmtest/kind must be a non-empty string');
  }
  return v;
});

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Registers a crash handler that converts library `Assert.crash`
 * calls into thrown `Error`s. Call from `beforeAll`. The returned
 * dispose runs in `afterAll`. Keeps the SUT-side asserts loud during
 * tests without making every assertion path branch on
 * `process.env.NODE_ENV === 'test'`.
 */
export function registerTestCrashHandler(): () => void {
  return Assert.registerCrashHandler({
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
}

export type MmHarness = {
  readonly db: PGlite;
  readonly mm: Matchmaking;
};

/**
 * Boots a fresh PGlite + Matchmaking pair. Idiomatic for one-off
 * harnesses inside a test (when the default `beforeEach` harness
 * isn't suitable, e.g. needs `partitionKeys` or a simulated clock).
 *
 * The v3 schema has no SQL-side throttling — tests drive `mm.tick()`
 * explicitly. Callers are responsible for `await harness.db.close()`
 * (the harness deliberately doesn't auto-dispose because some tests
 * exercise leak behaviour).
 */
export async function bootMatchmaking(
  overrides?: Partial<Pick<MatchmakingOptions, 'schema' | 'tuning'>>
): Promise<MmHarness> {
  const db = await PGlite.create();
  const sqlClient = createPgliteSqlClient(db);
  const schema = overrides?.schema ?? {};
  const mm = new Matchmaking({
    storage: { sqlClient },
    schema,
    ...(overrides?.tuning !== undefined ? { tuning: overrides.tuning } : {}),
  });
  await mm.ready();
  return { db, mm };
}

export type AppHarness = MmHarness & {
  readonly app: Hono;
};

/**
 * Boots an MmHarness and mounts the HTTP app behind a stub auth
 * middleware. Used by `app.test.ts` for end-to-end HTTP request
 * assertions. The default stub auth treats any request with the
 * `x-test-user` header as authorised; everything else 401s.
 *
 * Signature mirrors {@link bootMatchmaking} (overrides positional)
 * so the two test files boot harnesses with the same call shape;
 * pass a custom `requireAuth` via the second argument when a test
 * needs to exercise an alternative auth middleware.
 */
export async function bootMatchmakingApp(
  overrides?: Partial<Pick<MatchmakingOptions, 'schema' | 'tuning'>>,
  requireAuth: MiddlewareHandler = defaultStubAuth
): Promise<AppHarness> {
  const harness = await bootMatchmaking(overrides);
  return { ...harness, app: harness.mm.app({ requireAuth }) };
}

/**
 * Default stub auth middleware for `bootMatchmakingApp`. Treats the
 * absence of `x-test-user` as 401; anything with the header passes.
 */
export const defaultStubAuth: MiddlewareHandler = async (c, next) => {
  if (c.req.header('x-test-user') === undefined) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  return await next();
};

export const TEST_AUTH_HEADERS = { 'x-test-user': 'tester' } as const;

/**
 * POST helper for the HTTP harness — JSON body, default auth header,
 * extra headers merged last. Returns the raw `Response` so callers
 * can assert on `status` before parsing.
 */
export async function postJson(
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

/**
 * GET helper for `/status/:participantId` that returns both the raw
 * response (so tests can assert on headers/status) and the parsed
 * `StatusResult` body (so tests can narrow it).
 */
export async function getStatus(
  app: Hono,
  participantId: string
): Promise<{ readonly response: Response; readonly body: StatusResult }> {
  const response = await app.request(`/status/${participantId}`, {
    headers: TEST_AUTH_HEADERS,
  });
  const body = (await response.json()) as StatusResult;
  return { response, body };
}

/**
 * Narrowing helper: asserts the status is `'matched'` and returns the
 * narrowed `MatchedStatus` for further assertions. Compared to a
 * naked cast this gives a useful failure message ("not matched") when
 * the test setup is wrong.
 */
export function expectMatched(status: unknown): MatchedStatus {
  expect(status).not.toBeNull();
  const narrowed = status as MatchedStatus;
  expect(narrowed.status).toBe('matched');
  return narrowed;
}
