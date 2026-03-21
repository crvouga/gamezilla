/**
 * In-memory PGlite instance for tests. Uses socket mode so standard Postgres
 * clients can connect. No Docker required.
 *
 * @see https://pglite.dev/docs/pglite-socket
 */

import { assert } from '../assert';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

let server: PGLiteSocketServer | null = null;
let db: PGlite | null = null;
let connectionUrl: string | null = null;

export type PGliteTestInstance = {
  connectionUrl: string;
  wipe: () => Promise<void>;
  stop: () => Promise<void>;
};

const WIPE_SQL = `
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
`.trim();

async function wipeDatabase(url: string): Promise<void> {
  const { SQL } = await import('bun');
  const client = new SQL(url);
  try {
    await client.unsafe(WIPE_SQL).simple();
  } finally {
    client.close();
  }
}

/**
 * Returns an in-memory PGlite instance with socket server. Starts on first call,
 * reuses on subsequent calls. Use wipe() before each test for a clean slate.
 *
 * @param port - Port for the socket server (default: 25433)
 */
export async function getPGliteTestInstance(
  port = 25433
): Promise<PGliteTestInstance> {
  if (!server) {
    connectionUrl = `postgres://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable`;
    db = await PGlite.create();
    server = new PGLiteSocketServer({
      db,
      port,
      host: '127.0.0.1',
    });
    await server.start();
  }

  const url = connectionUrl;
  assert(url !== null && url !== undefined, 'connectionUrl must be set after server start');
  return {
    connectionUrl: url,
    wipe: () => wipeDatabase(url),
    stop: async () => {
      if (server) {
        await server.stop();
        server = null;
      }
      if (db) {
        await db.close();
        db = null;
      }
      connectionUrl = null;
    },
  };
}

/**
 * Stops the PGlite socket server and clears the singleton.
 */
export async function stopPGliteTestInstance(): Promise<void> {
  if (server) {
    await server.stop();
    server = null;
  }
  if (db) {
    await db.close();
    db = null;
  }
  connectionUrl = null;
}
