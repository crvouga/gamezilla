/**
 * Main-thread proxy: SqlClient + Pool over a PGlite worker thread.
 * Used on Node (Jest) so WASM dynamic import runs with
 * `--experimental-vm-modules` without poisoning the Jest VM.
 */

import type { SqlClient } from '@pkgs/sql-client/interface';
import type { Pool } from './pg-types';
import {
  createPgliteWorkerPool,
  createPgliteWorkerSqlClient,
} from './pglite-worker-adapters';
import { openPgliteWorkerTransport } from './pglite-worker-transport';

export type PgliteWorkerBundle = {
  readonly sqlClient: SqlClient;
  readonly pool: Pool;
  disconnect(): Promise<void>;
  exportBytes(): Promise<Uint8Array>;
  replaceFromBytes(bytes: Uint8Array): Promise<void>;
};

export async function openPgliteWorkerSqlClient(args?: {
  readonly seedBytes?: Uint8Array;
}): Promise<PgliteWorkerBundle> {
  const transport = await openPgliteWorkerTransport({
    ...(args?.seedBytes !== undefined
      ? { seedB64: Buffer.from(args.seedBytes).toString('base64') }
      : {}),
  });
  const sqlClient = createPgliteWorkerSqlClient(transport.call);
  const pool = createPgliteWorkerPool(transport.call, transport.disconnect);

  return {
    sqlClient,
    pool,
    disconnect: () => transport.disconnect(),
    exportBytes: async () => {
      const result = (await transport.call('dump')) as { dumpB64: string };
      return new Uint8Array(Buffer.from(result.dumpB64, 'base64'));
    },
    replaceFromBytes: async (bytes) => {
      await transport.call('replace', {
        dumpB64: Buffer.from(bytes).toString('base64'),
      });
    },
  };
}
