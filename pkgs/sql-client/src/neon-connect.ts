/**
 * Sanctioned Neon serverless connection factories for Cloudflare Workers.
 *
 * Uses `@neondatabase/serverless` WebSocket `Client` (per request) and `Pool`
 * (Better Auth / Kysely). Every factory pins the session `search_path` to the
 * application schema.
 */
import {
  neonConfig,
  Pool as NeonPool,
  type Client as NeonClient,
} from '@neondatabase/serverless';
import type { Pool } from 'pg';
import { SqlClientImplPlanetScalePostgresWs } from './impl-planetscale-postgres-ws';
import type { SqlClient } from './interface';
import type { PostgresDbScope } from './postgres-schema';
import {
  assertPgSessionSchema,
  setPgSessionSchema,
  type PgQueryable,
} from './postgres-session-schema';

let neonWorkersConfigured = false;

/** One-time Neon driver setup for Cloudflare Workers (WebSocket + HTTP fetch). */
export function configureNeonForWorkers(): void {
  if (neonWorkersConfigured) return;
  neonWorkersConfigured = true;
  neonConfig.webSocketConstructor = WebSocket;
  neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;
}

function neonClientQueryable(client: NeonClient): PgQueryable {
  return {
    query: async <R extends Record<string, unknown>>(queryText: string) => {
      const result = await client.query(queryText);
      return { rows: result.rows as R[] };
    },
  };
}

export type OpenNeonRequestSessionArgs = {
  readonly connectionString: string;
  readonly dbScope: PostgresDbScope;
};

export type OpenNeonRequestSessionResult = {
  readonly sqlClient: SqlClient;
  readonly neonClient: NeonClient;
};

/**
 * Opens one Neon WebSocket session per Worker request. Real Postgres
 * transactions; construct per request, do not share across requests.
 */
export async function openNeonRequestSession(
  args: OpenNeonRequestSessionArgs
): Promise<OpenNeonRequestSessionResult> {
  configureNeonForWorkers();
  const sqlClient = new SqlClientImplPlanetScalePostgresWs(args.connectionString);
  await sqlClient.connect();
  const neonClient = sqlClient.neonClient();
  const queryable = neonClientQueryable(neonClient);
  await setPgSessionSchema(queryable, args.dbScope);
  await assertPgSessionSchema(queryable, args.dbScope);
  return { sqlClient, neonClient };
}

export type CreateNeonPoolArgs = {
  readonly connectionString: string;
  readonly dbScope: PostgresDbScope;
  readonly max?: number;
};

export type CreateNeonPoolResult = {
  /** Neon `Pool` — pg-compatible for Kysely `PostgresDialect`. */
  readonly pool: Pool;
};

/**
 * Short-lived Neon WebSocket pool (`max: 1` per request for Better Auth).
 * Pins `search_path` on every connection via the pool `connect` event.
 */
export function createNeonPool(args: CreateNeonPoolArgs): CreateNeonPoolResult {
  configureNeonForWorkers();
  const pool = new NeonPool({
    connectionString: args.connectionString,
    max: args.max ?? 1,
  });
  pool.on('connect', (client: NeonClient) => {
    void setPgSessionSchema(client as PgQueryable, args.dbScope);
  });
  return { pool: pool as unknown as Pool };
}
