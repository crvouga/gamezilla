import { PatchDbImplPostgres } from '@gamezilla/patch-db/impl-postgres/impl-postgres';
import { InMemoryPubSub } from '@gamezilla/shared/pub-sub/impl-in-memory';
import { SqlClientImplPgliteHttp } from '@gamezilla/shared/sql-client/impl-pglite-http';
import { SqlClientImplPlanetScale } from '@gamezilla/shared/sql-client/impl-planetscale';
import type { SqlClient } from '@gamezilla/shared/sql-client/interface';
import { createApiHandler } from './api-handler';

export interface Env {
  DATABASE_URL: string;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Cache-Control, Pragma',
};

const MIGRATE_TIMEOUT_MS = 15_000;

const pubSub = new InMemoryPubSub();
let migrated = false;

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
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response('ok', {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain' },
      });
    }

    try {
      const sqlClient: SqlClient = env.DATABASE_URL.startsWith('http')
        ? new SqlClientImplPgliteHttp(env.DATABASE_URL)
        : new SqlClientImplPlanetScale(env.DATABASE_URL);
      const db = new PatchDbImplPostgres(sqlClient);
      if (!migrated) {
        await withTimeout(db.migrate(), MIGRATE_TIMEOUT_MS, 'db.migrate');
        migrated = true;
      }

      const handle = createApiHandler({ db, pubSub });
      return handle(request);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[api] handler error:', message);

      const isTimeout =
        message.includes('timed out') || message.includes('timeout');
      const status = isTimeout ? 503 : 500;

      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
          ...(isTimeout ? { 'Retry-After': '5' } : {}),
        },
      });
    }
  },
} satisfies ExportedHandler<Env>;
