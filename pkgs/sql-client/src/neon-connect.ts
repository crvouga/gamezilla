/**
 * Sanctioned Neon serverless connection factories for Cloudflare Workers.
 *
 * Uses `@neondatabase/serverless` HTTP `/sql` for per-request SQL and for
 * short-lived pools (Better Auth / Kysely). Every factory pins the session
 * `search_path` to the application schema.
 */
import { neonConfig, Pool as NeonPool } from '@neondatabase/serverless';
import type { Pool } from 'pg';
import { SqlClientImplNeonHttp } from './impl-neon-http';
import type { PostgresSqlClient } from './interface';
import type { PostgresDbScope } from './postgres-schema';
import { withPostgresSearchPathOption } from './postgres-session-schema';

let neonWorkersConfigured = false;

/** One-time Neon driver setup for Cloudflare Workers (HTTP fetch). */
export function configureNeonForWorkers(): void {
  if (neonWorkersConfigured) return;
  neonWorkersConfigured = true;
  neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;
  neonConfig.poolQueryViaFetch = true;
}

export type OpenNeonRequestSessionArgs = {
  readonly connectionString: string;
  readonly dbScope: PostgresDbScope;
};

export type OpenNeonRequestSessionResult = {
  readonly sqlClient: PostgresSqlClient;
};

/**
 * Opens one stateless Neon HTTP session per Worker request. Construct per
 * request; do not share across requests.
 */
export async function openNeonRequestSession(
  args: OpenNeonRequestSessionArgs
): Promise<OpenNeonRequestSessionResult> {
  configureNeonForWorkers();
  const sqlClient = new SqlClientImplNeonHttp(
    args.connectionString,
    args.dbScope
  );
  await sqlClient.connect();
  return { sqlClient };
}

export type CreateNeonPoolArgs = {
  readonly connectionString: string;
  readonly dbScope: PostgresDbScope;
  readonly max?: number;
};

export type CreateNeonPoolResult = {
  /** Neon `Pool` over HTTP — pg-compatible for Kysely `PostgresDialect`. */
  readonly pool: Pool;
};

/**
 * Short-lived Neon HTTP pool (`max: 1` per request for Better Auth).
 * `search_path` is pinned via the connection string startup option so
 * `poolQueryViaFetch` stays enabled (no pool event listeners).
 */
export function createNeonPool(args: CreateNeonPoolArgs): CreateNeonPoolResult {
  configureNeonForWorkers();
  const connectionString = withPostgresSearchPathOption(
    args.connectionString,
    args.dbScope
  );
  const pool = new NeonPool({
    connectionString,
    max: args.max ?? 1,
  });
  return { pool: pool as unknown as Pool };
}
