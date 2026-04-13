import { PatchDbImplPostgres } from '@gamezilla/patch-db/impl-postgres/impl-postgres';
import { createLogger } from '@gamezilla/shared/logger';
import { InMemoryPubSub } from '@gamezilla/shared/pub-sub/impl-in-memory';
import { SqlClientImplPgliteHttp } from '@gamezilla/shared/sql-client/impl-pglite-http';
import { SqlClientImplPlanetScalePostgres } from '@gamezilla/shared/sql-client/impl-planetscale-postgres';
import { createApiApp } from './create-api-app';
import type { Env } from './env';

const log = createLogger({ name: 'api' });

const MIGRATE_TIMEOUT_MS = 15_000;

const pubSub = new InMemoryPubSub();
let migrated = false;
let db: PatchDbImplPostgres | null = null;

function getDb(env: Env): PatchDbImplPostgres {
  if (!db) {
    const sqlClient = env.DATABASE_URL.startsWith('http')
      ? new SqlClientImplPgliteHttp(env.DATABASE_URL)
      : new SqlClientImplPlanetScalePostgres(env.DATABASE_URL);
    db = new PatchDbImplPostgres(sqlClient);
  }
  return db;
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label}: timed out after ${ms}ms`)),
      ms
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    try {
      const currentDb = getDb(env);
      if (!migrated) {
        await withTimeout(
          currentDb.migrate(),
          MIGRATE_TIMEOUT_MS,
          'db.migrate'
        );
        migrated = true;
      }

      const app = createApiApp({
        db: currentDb,
        pubSub,
        ...(env.GOOGLE_CLIENT_ID !== undefined && env.GOOGLE_CLIENT_ID !== ''
          ? { googleClientId: env.GOOGLE_CLIENT_ID }
          : {}),
      });
      return app.fetch(request, env);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error('handler error', { error: message });

      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers':
            'Content-Type, Cache-Control, Pragma, Authorization',
        },
      });
    }
  },
} satisfies ExportedHandler<Env>;
