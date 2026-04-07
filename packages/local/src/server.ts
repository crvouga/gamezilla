/**
 * Local dev server: PGlite with API served directly via Bun.
 * No Docker, no wrangler, no miniflare — runs entirely in-process.
 *
 * - PGlite runs in-process
 * - PGLiteSocketServer exposes a Postgres wire protocol on a local TCP port
 * - Bun's native SQL driver connects via TCP (no WebSocket overhead)
 * - The API handler is served on port 8787 (same as wrangler dev)
 * - A neon-compat WS proxy is kept on port 5432 for other clients
 */

import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { createApiHandler } from '@gamezilla/api/api-handler';
import { PatchDbImplPostgres } from '@gamezilla/patch-db/impl-postgres/impl-postgres';
import { assert } from '@gamezilla/shared/assert';
import { InMemoryPubSub } from '@gamezilla/shared/pub-sub/impl-in-memory';
import { SqlClientImplBunPostgres } from '@gamezilla/shared/sql-client/impl-bun-postgres';
import { connect, type Socket } from 'net';

const WS_PORT = parseInt(process.env['PORT'] ?? '5432', 10);
assert.nonNegativeInteger(WS_PORT, 'PORT must be a non-negative integer');
const API_PORT = parseInt(process.env['API_PORT'] ?? '8787', 10);
assert.nonNegativeInteger(API_PORT, 'API_PORT must be a non-negative integer');
const PG_INTERNAL_PORT = 15432;
assert.nonNegativeInteger(
  PG_INTERNAL_PORT,
  'PG_INTERNAL_PORT must be a non-negative integer'
);
const HOST = '127.0.0.1';
assert.string(HOST, 'HOST must be a string');
const DATA_DIR = process.env['GAMEZILLA_DATA_DIR'];

interface WsData {
  tcp: Socket | null;
}

async function main() {
  const db = await PGlite.create(DATA_DIR);

  const pgServer = new PGLiteSocketServer({
    db,
    port: PG_INTERNAL_PORT,
    host: HOST,
  });
  await pgServer.start();

  // Connect to PGlite via Bun's native Postgres driver (TCP, no WebSocket)
  const sqlClient = new SqlClientImplBunPostgres(
    `postgres://localhost:${PG_INTERNAL_PORT}/postgres`
  );
  await sqlClient.connect();

  const patchDb = new PatchDbImplPostgres(sqlClient);
  await patchDb.migrate();

  const pubSub = new InMemoryPubSub();
  const handle = createApiHandler({ db: patchDb, pubSub });

  // API server on port 8787
  Bun.serve({
    port: API_PORT,
    hostname: HOST,
    idleTimeout: 255,
    fetch: handle,
  });

  console.log(`[local] API server on http://${HOST}:${API_PORT}`);

  // Neon-compat WS proxy on port 5432 (for other clients that need it)
  Bun.serve<WsData>({
    port: WS_PORT,
    hostname: HOST,
    fetch(req, server) {
      if (server.upgrade(req, { data: { tcp: null } })) return;
      return new Response('pglite ws proxy', { status: 200 });
    },
    websocket: {
      open(ws) {
        const tcp = connect(PG_INTERNAL_PORT, HOST);
        ws.data.tcp = tcp;
        tcp.on('data', (chunk: Buffer) => ws.sendBinary(new Uint8Array(chunk)));
        tcp.on('close', () => ws.close());
        tcp.on('error', () => ws.close());
      },
      message(ws, message) {
        ws.data.tcp?.write(
          typeof message === 'string' ? Buffer.from(message) : message
        );
      },
      close(ws) {
        ws.data.tcp?.destroy();
        ws.data.tcp = null;
      },
    },
  });

  console.log(`[local] neon-compat WS proxy on ws://${HOST}:${WS_PORT}`);
  console.log(`[local] pglite data: ${DATA_DIR ?? 'in-memory'}`);

  const shutdown = async () => {
    console.log('\n[local] shutting down...');
    await sqlClient.disconnect();
    await pgServer.stop();
    await db.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void main();
