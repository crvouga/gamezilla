/**
 * Local dev server: PGlite backed by a neon-compatible WebSocket proxy.
 * No Docker required — runs entirely in-process.
 *
 * The @neondatabase/serverless driver connects via WebSocket. This server
 * accepts those WebSocket connections and bridges them over TCP to an
 * in-process PGlite socket server.
 *
 * PORT (default 5432) — the WebSocket proxy port exposed to wrangler dev.
 */

import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { connect, type Socket } from 'net';

const PORT = parseInt(process.env['PORT'] ?? '5432', 10);
const PG_INTERNAL_PORT = 15432;
const HOST = '127.0.0.1';
const DATA_DIR = process.env['DATA_DIR'];

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

  Bun.serve<WsData>({
    port: PORT,
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
          typeof message === 'string' ? Buffer.from(message) : message,
        );
      },
      close(ws) {
        ws.data.tcp?.destroy();
        ws.data.tcp = null;
      },
    },
  });

  console.log(`[pglite] neon-compat WS proxy on ws://${HOST}:${PORT}`);
  console.log(`[pglite] data: ${DATA_DIR ?? 'in-memory'}`);

  const shutdown = async () => {
    console.log('\n[pglite] shutting down...');
    await pgServer.stop();
    await db.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void main();
