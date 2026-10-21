import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { dumpData, loadData } from '@pkgs/sql-client-root-shared-ts/port';
import type { SqlDataDump } from '@pkgs/sql-client-root-shared-ts/types';

/** Live databases preserve table data through the same transactional SQL port. */
export function sqlDataCheckpoint(client: SqlClient) {
  return {
    exportBytes: async () => {
      const data = await client.transaction((tx) => dumpData(tx));
      return new TextEncoder().encode(JSON.stringify(data));
    },
    importBytes: async (bytes: Uint8Array) => {
      const dump = JSON.parse(new TextDecoder().decode(bytes)) as SqlDataDump;
      await client.transaction((tx) => loadData(tx, dump));
    },
  };
}
