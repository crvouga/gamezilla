/**
 * The only sanctioned way to open a Postgres connection in this codebase.
 *
 * Every factory pins the session to a {@link PostgresDbScope}, so unqualified
 * SQL always resolves to the application schema (`public` by default). Direct
 * `new Pool()` / `new Client()` outside `@pkgs/sql-client` is banned by CI
 * (Biome plugin `no-direct-pg-imports.grit` via `bun run lint`), which makes pointing at a
 * different schema impossible without going through here.
 */

import { SqlClientImplPg } from '@pkgs/sql-client-postgres-shared-ts/impl-pg';
import { SqlClientImplPgClient } from '@pkgs/sql-client-postgres-shared-ts/impl-pg-client';
import type { PgExecutor } from '@pkgs/sql-client-postgres-shared-ts/impl-pg-shared';
import { pgRawQueryWithSearchPathPin } from '@pkgs/sql-client-postgres-shared-ts/impl-pg-shared';
import type {
  Client,
  Pool,
  PoolClient,
} from '@pkgs/sql-client-postgres-shared-ts/pg-types';
import { sanitizePostgresUrlForNodePg } from '@pkgs/sql-client-postgres-shared-ts/sanitize-url-for-node-pg';
import {
  pinAndVerifyPgSessionSchema,
  postgresRejectsStartupSearchPathOption,
  setPgSessionSchema,
  withPostgresSearchPathOption,
} from '@pkgs/sql-client-postgres-shared-ts/session-schema';
import type { PostgresSqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { PostgresDbScope } from '@pkgs/sql-client-root-shared-ts/postgres-db-scope';
import { quotePgIdent } from '@pkgs/sql-client-root-shared-ts/postgres-db-scope';
import { Client as PgClient, Pool as PgPool } from 'pg';
import { type ObservePgOpen, openSession } from './open-session';
import { createPgClientSession } from './pg-client-session';

/** Extra `pg.Client` knobs that standalone tools occasionally need. */
export type PgClientOptions = {
  readonly connectionTimeoutMillis?: number;
  readonly keepAlive?: boolean;
  readonly keepAliveInitialDelayMillis?: number;
  readonly application_name?: string;
};

/** True when `connectionString` targets loopback Postgres (embedded dev cluster). */
export function isLoopbackPostgresUrl(connectionString: string): boolean {
  try {
    const url = new URL(connectionString);
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
      return false;
    }
    return (
      url.hostname === '127.0.0.1' ||
      url.hostname === 'localhost' ||
      url.hostname === '::1' ||
      url.hostname === '0.0.0.0'
    );
  } catch {
    return false;
  }
}

export type OpenPgClientArgs = {
  readonly connectionString: string;
  readonly dbScope: PostgresDbScope;
  /**
   * Create the schema if it does not exist before pinning the session. Use for
   * standalone tools / scripts that may connect before migrations have run
   * (the API request path leaves this false — the schema always exists there).
   */
  readonly ensureSchema?: boolean;
  readonly clientOptions?: PgClientOptions;
  readonly observeOpen?: ObservePgOpen;
};

export type OpenPgClientResult = {
  readonly client: Client;
  readonly sqlClient: PostgresSqlClient;
};

/**
 * Opens one pinned `pg.Client` (one TCP session). For per-request TCP wiring:
 * construct per request, do not share across requests. The session is
 * pinned via an explicit `SET search_path` so it works even when the transport
 * does not forward startup `options`.
 */
export async function openPgClient(
  args: OpenPgClientArgs
): Promise<OpenPgClientResult> {
  const pinSearchPathEachQuery = postgresRejectsStartupSearchPathOption(
    args.connectionString
  );
  const client = createPgClientSession(
    new PgClient({
      connectionString: sanitizePostgresUrlForNodePg(args.connectionString),
      ...args.clientOptions,
    })
  );
  await openSession({
    connect: () => client.connect(),
    close: () => client.end(),
    ...(args.observeOpen === undefined ? {} : { observe: args.observeOpen }),
    initialize: async () => {
      if (args.ensureSchema === true && args.dbScope.schema !== 'public') {
        await client.query(
          `CREATE SCHEMA IF NOT EXISTS ${quotePgIdent(args.dbScope.schema)}`
        );
      }
      // Always pin at open — even on Neon/PgBouncer pooler URLs. Per-query
      // SET LOCAL still covers transaction pooling, but connect()/assert must see
      // the app schema (tests may leave backends on e.g. acme_test_scope).
      await pinAndVerifyPgSessionSchema(
        client,
        args.dbScope,
        args.connectionString
      );
    },
  });
  return {
    client: client as unknown as Client,
    sqlClient: new SqlClientImplPgClient(
      client as unknown as Client,
      args.dbScope,
      pinSearchPathEachQuery
    ),
  };
}

/**
 * Presents one pinned {@link Client} as a `pg.Pool` for Kysely / legacy auth
 * without opening a second TCP session. The adapter pins `search_path` on every
 * query via {@link pgRawQueryWithSearchPathPin} — real `pg.Pool` monkey-patches
 * deadlock on Neon pooler URLs when `max: 1`.
 */
export function adaptPgClientAsPool(
  client: Client,
  dbScope: PostgresDbScope,
  connectionString: string
): Pool {
  const pinSearchPathEachQuery =
    postgresRejectsStartupSearchPathOption(connectionString);
  const execQuery = client.query.bind(client) as PgExecutor['query'];
  const runPinnedQuery = (text: string, values?: unknown[]) =>
    pgRawQueryWithSearchPathPin({
      queryable: { query: execQuery },
      execQuery,
      dbScope,
      pinSearchPathEachQuery,
      text,
      ...(values !== undefined && values.length > 0 ? { values } : {}),
    });
  const checkoutClient = (): PoolClient => {
    const poolClient = client as unknown as PoolClient;
    poolClient.query = ((text: string, values?: unknown[]) =>
      runPinnedQuery(text, values)) as typeof poolClient.query;
    poolClient.release = () => undefined;
    return poolClient;
  };
  let ended = false;
  const poolAdapter = {
    connect: (
      callback?: (
        err: Error | undefined,
        client: PoolClient | undefined,
        done: (release?: boolean | (() => void)) => void
      ) => void
    ) => {
      if (typeof callback === 'function') {
        callback(undefined, checkoutClient(), () => undefined);
        return undefined;
      }
      return Promise.resolve(checkoutClient());
    },
    query: (
      text: string,
      values?: unknown[],
      callback?: (err: Error | undefined, result: unknown) => void
    ) => {
      const run = runPinnedQuery(text, values);
      if (typeof callback === 'function') {
        void run
          .then((result) => callback(undefined, result))
          .catch((err: unknown) => {
            callback(
              err instanceof Error ? err : new Error(String(err)),
              undefined
            );
          });
        return undefined;
      }
      return run;
    },
    end: async () => {
      if (ended) return;
      ended = true;
      try {
        await client.end();
      } catch {
        // already closed by sqlClient.disconnect()
      }
    },
    on: () => poolAdapter,
    totalCount: 1,
    idleCount: 0,
    waitingCount: 0,
  };
  return poolAdapter as unknown as Pool;
}

export type CreatePgPoolArgs = {
  readonly connectionString: string;
  readonly dbScope: PostgresDbScope;
  readonly max?: number;
};

export type CreatePgPoolResult = {
  readonly pool: Pool;
  readonly sqlClient: PostgresSqlClient;
};

/**
 * Creates a `pg.Pool` whose every connection has `search_path` pinned to the
 * scope's schema. The awaited `onConnect` hook runs `SET search_path` before a
 * connection is handed out, so the pin is race-free even when startup
 * `options` are not forwarded by the transport.
 */
export function createPgPool(args: CreatePgPoolArgs): CreatePgPoolResult {
  const pinSearchPathEachQuery = postgresRejectsStartupSearchPathOption(
    args.connectionString
  );
  let connectionString = sanitizePostgresUrlForNodePg(args.connectionString);
  if (!pinSearchPathEachQuery) {
    connectionString = withPostgresSearchPathOption(
      connectionString,
      args.dbScope
    );
  }
  const pool = new PgPool({
    connectionString,
    max: args.max ?? 1,
    onConnect: (client) => setPgSessionSchema(client, args.dbScope),
  });
  return {
    pool: pool as unknown as Pool,
    sqlClient: new SqlClientImplPg(
      pool as unknown as Pool,
      args.dbScope,
      pinSearchPathEachQuery
    ),
  };
}
