import { PatchDbImplSqlite } from '@/@shared/patch-db/impl-sqlite/impl-sqlite';
import {
  PATCHES_DB_BASE_URL,
  PatchDbHttpSyncServerAdapter,
  PatchDbImplSyncHost,
} from '@/@shared/patch-db/transport';
import { InMemoryPubSub } from '@/@shared/pub-sub/impl-in-memory';
import { SqlClientImplBunSqlite } from '@/@shared/sql-client/impl-bun-sqlite';
import { assert } from './@shared/assert';
import { NodeCrashHandler } from './@shared/assert/crash/crash-handler/crash-handler-node';
import { PatchDbImplInstrumentedSyncHost } from './sync-server-instrumentation';

assert.registerCrashHandler(new NodeCrashHandler());

const PORT = parseInt(process.env['PORT'] ?? '5001');
assert.integer(PORT, 'PORT must be an integer');

const sqlClient = SqlClientImplBunSqlite.open(':memory:');
await sqlClient.connect();

const patchDb = new PatchDbImplSqlite(sqlClient);
await patchDb.migrate();

const pubSub = new InMemoryPubSub();
const syncHostInner = new PatchDbImplSyncHost(patchDb, pubSub);
const syncHost = new PatchDbImplInstrumentedSyncHost(
  syncHostInner,
  patchDb,
  pubSub
);
const patchDbTransport = new PatchDbHttpSyncServerAdapter(syncHost);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    headers.set(k, v);
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

const server = Bun.serve({
  port: Number(PORT),
  error(error) {
    console.error('[sync-server] Unhandled error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      }
    );
  },
  fetch(
    req: Request,
    bunServer: { timeout: (req: Request, seconds: number) => void }
  ) {
    const url = new URL(req.url);
    console.log(req.method, url.pathname);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === '/health') {
      return withCors(
        new Response('ok', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        })
      );
    }

    if (url.pathname.startsWith(PATCHES_DB_BASE_URL)) {
      bunServer.timeout(req, 0);
      return patchDbTransport
        .handleRequest(req)
        .then(withCors)
        .catch((err: unknown) => {
          console.error('[sync-server] patchDbHandler failed:', err);
          const message = err instanceof Error ? err.message : String(err);
          return withCors(
            new Response(JSON.stringify({ error: message }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            })
          );
        });
    }

    return withCors(
      new Response('Not Found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      })
    );
  },
});

console.log(`Sync server running at http://localhost:${server.port}`);
