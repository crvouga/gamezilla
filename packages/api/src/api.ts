import { PatchDbImplSqlite } from '@gamezilla/patch-db/impl-sqlite/impl-sqlite';
import { InMemoryPubSub } from '@gamezilla/shared/pub-sub/impl-in-memory';
import { SqlClientImplD1 } from '@gamezilla/shared/sql-client/impl-d1';
import { createApiHandler } from './api-handler';

export interface Env {
  DB: D1Database;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const pubSub = new InMemoryPubSub();
let migrated = false;

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
      const sqlClient = new SqlClientImplD1(env.DB);
      const db = new PatchDbImplSqlite(sqlClient);
      if (!migrated) {
        await db.migrate();
        migrated = true;
      }

      const handle = createApiHandler({ db, pubSub });
      return handle(request);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[api] handler error:', message);
      return new Response(
        JSON.stringify({ error: message }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }
  },
} satisfies ExportedHandler<Env>;
