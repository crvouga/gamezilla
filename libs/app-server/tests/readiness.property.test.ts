import { describe, expect, test } from 'bun:test';
import type { ApiHonoEnv } from '@libs/auth-shared/api-hono-env';
import { createHealthApp, READINESS_CHECK_TIMEOUT_MS } from '@libs/app-server/health-route';
import type { ReadinessBody } from '@libs/app-server/health-route';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import { Hono } from 'hono';

/** How the database behaves for one readiness probe. */
type DbCase =
  | { readonly kind: 'ok'; readonly delayMs: number }
  | { readonly kind: 'no-row' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'hang' };

const dbCase: fc.Arbitrary<DbCase> = fc.oneof(
  fc.record({
    kind: fc.constant('ok' as const),
    delayMs: fc.integer({ min: 0, max: READINESS_CHECK_TIMEOUT_MS - 1 }),
  }),
  fc.constant({ kind: 'no-row' as const }),
  fc.record({
    kind: fc.constant('error' as const),
    message: fc.string({ minLength: 1, maxLength: 40 }),
  }),
  fc.constant({ kind: 'hang' as const })
);

const STEP_MS = 100;
/** Enough virtual steps to pass the deadline plus one. */
const MAX_STEPS = READINESS_CHECK_TIMEOUT_MS / STEP_MS + 2;

async function probe(db: DbCase): Promise<{
  readonly res: Response;
  readonly body: ReadinessBody;
}> {
  const { clock, timers } = createHarnessClock({ startMs: 1_767_225_600_000 });
  const sqlClient = {
    query: () => {
      if (db.kind === 'hang') return new Promise<never>(() => undefined);
      if (db.kind === 'error') return Promise.reject(new Error(db.message));
      const rows = db.kind === 'no-row' ? [] : [{ ok: 1 }];
      const delayMs = db.kind === 'ok' ? db.delayMs : 0;
      return new Promise((resolve) => {
        timers.setTimeout(() => resolve(rows), delayMs);
      });
    },
  } as unknown as SqlClient;
  const app = new Hono<ApiHonoEnv>()
    .use('*', async (c, next) => {
      c.set('sqlClient', sqlClient);
      await next();
    })
    .route('/', createHealthApp({ clock, timers }));

  let settled: Response | null = null;
  const pending = Promise.resolve(app.request('/health/ready')).then((res) => {
    settled = res;
    return res;
  });
  // Let the handler register its timers, then step virtual time until done.
  for (let step = 0; step < MAX_STEPS && settled === null; step += 1) {
    for (let tick = 0; tick < 20; tick += 1) await Promise.resolve();
    if (settled === null) clock.advance(STEP_MS);
  }
  const res = await pending;
  return { res, body: (await res.clone().json()) as ReadinessBody };
}

describe('GET /health/ready', () => {
  test('ready iff Postgres answers SELECT 1 before the deadline', async () => {
    await assertProperty(
      'readiness verdict',
      fc.asyncProperty(dbCase, async (db) => {
        const { res, body } = await probe(db);
        const check = body.checks['postgres:responseTime']?.[0];
        const healthy = db.kind === 'ok';

        expect(res.status).toBe(healthy ? 200 : 503);
        expect(res.headers.get('content-type')).toBe('application/health+json');
        expect(res.headers.get('cache-control')).toBe('no-store');
        expect(body.status).toBe(healthy ? 'pass' : 'fail');
        expect(check?.status).toBe(body.status);
        expect(check?.observedUnit).toBe('ms');
        if (db.kind === 'ok') {
          expect(check?.observedValue).toBeGreaterThanOrEqual(db.delayMs);
          expect(check?.output).toBeUndefined();
        } else {
          expect(check?.output ?? '').not.toBe('');
        }
        if (db.kind === 'hang') {
          expect(check?.observedValue).toBeGreaterThanOrEqual(
            READINESS_CHECK_TIMEOUT_MS
          );
        }
      })
    );
  });

  // Decided wire shape: liveness never touches a dependency.
  test('liveness answers without a database', async () => {
    const { clock, timers } = createHarnessClock();
    const app = new Hono<ApiHonoEnv>().route(
      '/',
      createHealthApp({ clock, timers })
    );
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});
