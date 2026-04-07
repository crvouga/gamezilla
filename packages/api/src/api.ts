import { PatchDbImplPostgres } from '@gamezilla/patch-db/impl-postgres/impl-postgres';
import { InMemoryPubSub } from '@gamezilla/shared/pub-sub/impl-in-memory';
import { SqlClientImplPlanetScale } from '@gamezilla/shared/sql-client/impl-planetscale';
import { createApiHandler } from './api-handler';

export interface Env {
  DATABASE_URL: string;
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

    let sqlClient: SqlClientImplPlanetScale;
    try {
      sqlClient = new SqlClientImplPlanetScale(env.DATABASE_URL);
      await sqlClient.connect();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[api] DB connect failed:', message);
      return new Response(
        JSON.stringify({ error: 'DB connect failed', detail: message }),
        { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    try {
      const db = new PatchDbImplPostgres(sqlClient);
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
