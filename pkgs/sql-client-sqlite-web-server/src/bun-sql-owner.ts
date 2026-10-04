import { unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-server/impl-bun-sqlite';
import type { SqlOwner } from '@pkgs/sql-client-sqlite-web-shared/sql-owner';

let bunSqlOwnerSeq = 0;

/**
 * File-backed Bun SQLite {@link SqlOwner} for matrix / DST backends.
 * Uses a unique temp path per instance so parallel tests do not collide.
 */
export function createBunSqlOwner(args: {
  readonly dbName: string;
  readonly path?: string;
}): SqlOwner {
  const path =
    args.path ??
    join(
      tmpdir(),
      `sql-owner-${args.dbName}-${process.pid}-${++bunSqlOwnerSeq}.db`
    );
  let client: SqlClientImplBunSqlite | null = null;

  return {
    open: async () => {
      if (client !== null) {
        try {
          await client.disconnect();
        } catch {
          // ignore
        }
      }
      client = SqlClientImplBunSqlite.open(path);
      await client.connect();
      return client;
    },
    close: async () => {
      if (client === null) return;
      try {
        await client.disconnect();
      } catch {
        // ignore
      }
      client = null;
    },
    // In-process: nothing outlives the page.
    release: () => undefined,
    resetStore: async () => {
      if (client !== null) {
        try {
          await client.disconnect();
        } catch {
          // ignore
        }
        client = null;
      }
      try {
        unlinkSync(path);
      } catch {
        // missing is fine
      }
      for (const suffix of ['-wal', '-shm', '-journal'] as const) {
        try {
          unlinkSync(`${path}${suffix}`);
        } catch {
          // ignore
        }
      }
    },
  };
}

export function isBunSqlClient(client: SqlClient): boolean {
  return client instanceof SqlClientImplBunSqlite;
}
