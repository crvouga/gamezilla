import { identityFor } from '@libs/permissions-shared-ts/people';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql, { raw, type Sql } from '@pkgs/sql-root-shared-ts/sql';
import type { InvariantViolation } from '@pkgs/sync-engine-harness-ts/invariant-tracker';
import type { QueryRow } from '@pkgs/sync-engine-shared-ts/v2';
import { contentActorId } from './content-identity';
import { exampleContentSnapshot } from './example-app-query';

function canonical(rows: readonly QueryRow[]): string {
  const ordered = rows.map((row) =>
    Object.fromEntries(
      Object.entries(row)
        .filter(([key]) => key !== 'created_at' && key !== 'updated_at')
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    )
  );
  ordered.sort((a, b) =>
    String(a['id']) < String(b['id'])
      ? -1
      : String(a['id']) > String(b['id'])
        ? 1
        : 0
  );
  return JSON.stringify(ordered);
}

/** Every device holds exactly its authorized server view of the games' content. */
export const contentClientsConverged =
  (gameIds: readonly string[]) =>
  async (args: {
    readonly clients: readonly {
      readonly label: string;
      readonly db: SqlClient;
    }[];
    readonly serverDb: SqlClient;
  }): Promise<InvariantViolation | null> => {
    for (const client of args.clients) {
      const expected = await exampleContentSnapshot(
        {
          db: { query: (query) => args.serverDb.query(query as Sql<QueryRow>) },
          env: {
            ...identityFor('guest'),
            actorId: contentActorId(client.label.split(':')[0] ?? ''),
            deviceId: client.label,
            now: () => new Date(0),
          },
        },
        gameIds
      );
      for (const [table, rows] of Object.entries(expected)) {
        const local = await client.db.query(
          sql<QueryRow>`SELECT * FROM ${raw(table)}`
        );
        if (canonical(local) !== canonical(rows))
          return {
            invariant: 'convergence',
            detail: `${client.label}: ${table} differs from its authorized server view`,
          };
      }
    }
    return null;
  };
