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

import { expect } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { Assert } from '@pkgs/assert';
import { createAttrNamespace } from '@pkgs/attribute';
import { createPgliteSqlClient } from '@pkgs/sql-client/postgres/impl-pglite';
import type { Hono, MiddlewareHandler } from 'hono';
import { Matchmaking, type MatchmakingOptions } from './matchmaking';
import type { MatchedStatus, StatusResult } from './types';

/**
 * Test attribute namespace shared by every test file. Reusing the
 * same `mmtest/*` keyword namespace lets fixtures (data, formula
 * wires) cross-pollinate between files without name collisions.
 */
export const testNs = createAttrNamespace('mmtest');

export const RatingAttr = testNs.number('rating', (v): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error('mmtest/rating must be a finite number');
  }
  return v;
});

export const SkillAttr = testNs.number('skill', (v): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error('mmtest/skill must be a finite number');
  }
  return v;
});

export const NameAttr = testNs.text('name', (v): string =>
  typeof v === 'string' ? v : ''
);

export const RegionAttr = testNs.textOrNull('region', (v): string | null =>
  typeof v === 'string' ? v : null
);

export const KindAttr = testNs.text('kind', (v): string => {
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error('mmtest/kind must be a non-empty string');
  }
  return v;
});

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PGlite `joined_at` defaults to `now()` on INSERT. Back-to-back joins in
 * the same event-loop turn (common on busy Linux CI runners) can share the
 * same timestamp and make FIFO-order assertions nondeterministic.
 */
export async function pauseForJoinedAtOrdering(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 50);
  });
}

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
          : `${String(message)} ${JSON.stringify(context)}`
      );
    },
  });
}

export type MmHarness = {
  readonly db: PGlite;
  readonly mm: Matchmaking;
};

type BootOverrides = Partial<Pick<MatchmakingOptions, 'schema' | 'tuning'>>;

/**
 * Migrated once, then {@link PGlite.clone}'d per default-schema boot.
 * Fresh `PGlite.create()` + `migrate()` is ~1–3s; clones are tens of ms.
 * Without this, `bun check` looks hung for several minutes on
 * `@pkgs/matchmaking#test` (140× cold boots, Turbo grouped logs silent).
 */
let defaultTemplatePromise: Promise<PGlite> | null = null;

async function defaultMigratedTemplate(): Promise<PGlite> {
  if (defaultTemplatePromise === null) {
    defaultTemplatePromise = (async () => {
      const db = await PGlite.create();
      const mm = new Matchmaking({
        storage: { sqlClient: createPgliteSqlClient(db) },
        schema: {},
      });
      await mm.ready();
      return db;
    })();
  }
  return defaultTemplatePromise;
}

/**
 * Default empty schema (+ client-only `tuning.now`) can clone the
 * template. Schema / migrate-baked tuning still need a cold boot.
 */
function canCloneDefaultTemplate(overrides?: BootOverrides): boolean {
  if (overrides === undefined) return true;
  const schema = overrides.schema;
  if (schema !== undefined && Object.keys(schema).length > 0) return false;
  const tuning = overrides.tuning;
  if (tuning === undefined) return true;
  return (
    tuning.maxPairsPerPass === undefined &&
    tuning.maxWaitSeconds === undefined &&
    tuning.matchedRetentionSeconds === undefined
  );
}

async function openBootDb(overrides?: BootOverrides): Promise<PGlite> {
  if (canCloneDefaultTemplate(overrides)) {
    // Upstream types `clone()` as PGliteInterface; runtime is a PGlite.
    const cloned = await (await defaultMigratedTemplate()).clone();
    return cloned as PGlite;
  }
  return PGlite.create();
}

/**
 * Boots a PGlite + Matchmaking pair. Default-schema boots clone a
 * migrated template; custom schema / migrate-baked tuning still cold-boot.
 *
 * The v3 schema has no SQL-side throttling — tests drive `mm.tick()`
 * explicitly. Callers are responsible for `await harness.db.close()`
 * (the harness deliberately doesn't auto-dispose because some tests
 * exercise leak behaviour).
 */
export async function bootMatchmaking(
  overrides?: BootOverrides
): Promise<MmHarness> {
  const db = await openBootDb(overrides);
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
