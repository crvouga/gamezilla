/**
 * Portable matchmaking schema migrate (SQLite + Postgres).
 *
 * No PL/pgSQL, partitions, UNLOGGED, or pg_cron. Hosts drive `tick()`.
 */

import { assert } from '@pkgs/assert';
import { isNamespacedKeyword } from '@pkgs/keyword';
import { raw, sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { MatchmakingSchema } from '../interface/schema';
import { DEFAULT_RADIUS_OPTIONS, type RadiusOptions } from '../interface/types';
import {
  ADD_CLAIM_TOKEN_COLUMN_SQL,
  ADD_CLAIMED_AT_COLUMN_SQL,
  ADD_PRIMARY_BUCKET_COLUMN_SQL,
  ADD_PRIMARY_RATING_COLUMN_SQL,
  CREATE_ACTIVE_PARTITIONS_TABLE_SQL,
  CREATE_MATCHED_MATCH_ID_INDEX_SQL,
  CREATE_MATCHED_MATCHED_AT_INDEX_SQL,
  CREATE_MATCHED_TABLE_SQL,
  CREATE_SCHEMA_STATE_TABLE_SQL,
  CREATE_WAITING_CLAIM_TOKEN_INDEX_SQL,
  CREATE_WAITING_CLAIMED_AT_INDEX_SQL,
  CREATE_WAITING_LOOKUP_INDEX_SQL,
  CREATE_WAITING_TABLE_SQL,
  DROP_ACTIVE_PARTITIONS_SQL,
  DROP_WAITING_TABLE_SQL,
} from './migrate-sql';

export type { MatchmakingSchema };

export type MigrateTuning = {
  readonly maxPairsPerPass?: number;
  readonly maxWaitSeconds?: number;
  readonly matchedRetentionSeconds?: number;
  readonly claimTtlMs?: number;
};

export type MigrateOptions = {
  readonly sqlClient: SqlClient;
  readonly schema?: MatchmakingSchema;
  readonly radius?: RadiusOptions;
  readonly tuning?: MigrateTuning;
};

/** Schema layout version for fingerprinting. */
const SCHEMA_VERSION = 7;

const DEFAULT_BUCKET_WIDTH = 50;

type ResolvedSchema = {
  readonly partitionKeys: readonly string[];
  readonly primaryNumericKey: string | undefined;
  readonly bucketWidth: number;
};

function resolveSchema(schema: MatchmakingSchema | undefined): ResolvedSchema {
  const partitionKeys = schema?.partitionKeys ?? [];
  assert.array(partitionKeys, 'migrate: schema.partitionKeys must be an array');
  for (const k of partitionKeys) {
    assert.nonEmptyString(
      k,
      'migrate: schema.partitionKeys entries must be non-empty strings'
    );
    assert.ok(
      isNamespacedKeyword(k),
      'migrate: partitionKeys must be namespaced keywords',
      { k }
    );
  }
  const primaryNumericKey = schema?.primaryNumericKey;
  if (primaryNumericKey !== undefined) {
    assert.nonEmptyString(
      primaryNumericKey,
      'migrate: schema.primaryNumericKey must be a non-empty string'
    );
    assert.ok(
      isNamespacedKeyword(primaryNumericKey),
      'migrate: primaryNumericKey must be a namespaced keyword',
      { primaryNumericKey }
    );
  }
  const bucketWidth = schema?.bucketWidth ?? DEFAULT_BUCKET_WIDTH;
  assert.ok(
    Number.isFinite(bucketWidth) && bucketWidth > 0,
    'migrate: schema.bucketWidth must be a positive finite number',
    { bucketWidth }
  );
  return { partitionKeys, primaryNumericKey, bucketWidth };
}

function fingerprintSchema(schema: ResolvedSchema): string {
  return JSON.stringify({
    version: SCHEMA_VERSION,
    partitionKeys: schema.partitionKeys,
    primaryNumericKey: schema.primaryNumericKey ?? null,
    bucketWidth: schema.bucketWidth,
  });
}

export function fingerprintForOptions(
  schema: MatchmakingSchema | undefined
): string {
  return fingerprintSchema(resolveSchema(schema));
}

async function tryAlter(
  sqlClient: SqlClient,
  statement: string
): Promise<void> {
  try {
    await sqlClient.run(raw(statement));
  } catch {
    // Column may already exist — ignore.
  }
}

async function rebuildWaitingTable(sqlClient: SqlClient): Promise<void> {
  await sqlClient.run(raw(DROP_WAITING_TABLE_SQL));
  await sqlClient.run(raw(DROP_ACTIVE_PARTITIONS_SQL));
  await sqlClient.run(raw(CREATE_ACTIVE_PARTITIONS_TABLE_SQL));
  await sqlClient.run(raw(CREATE_WAITING_TABLE_SQL));
  await sqlClient.run(raw(CREATE_WAITING_LOOKUP_INDEX_SQL));
  await sqlClient.run(raw(CREATE_WAITING_CLAIM_TOKEN_INDEX_SQL));
  await sqlClient.run(raw(CREATE_WAITING_CLAIMED_AT_INDEX_SQL));
}

async function maybeRebuildSchema(
  sqlClient: SqlClient,
  schema: ResolvedSchema
): Promise<void> {
  const fp = fingerprintSchema(schema);
  const state = await sqlClient.query(
    sql<{ schema_fingerprint: string }>`
      SELECT schema_fingerprint
        FROM matchmaking_schema_state
       WHERE id = 1`
  );
  const currentFp = state[0]?.schema_fingerprint ?? null;
  if (currentFp === fp) return;

  await rebuildWaitingTable(sqlClient);
  await sqlClient.run(
    sql<void>`
      INSERT INTO matchmaking_schema_state (id, schema_fingerprint)
      VALUES (1, ${fp})
      ON CONFLICT (id) DO UPDATE
        SET schema_fingerprint = excluded.schema_fingerprint`
  );
}

/**
 * Idempotent schema install for both SQLite and Postgres.
 */
export async function migrate(opts: MigrateOptions): Promise<void> {
  assert.defined(opts, 'migrate: options required');
  assert.defined(opts.sqlClient, 'migrate: sqlClient required');
  const schema = resolveSchema(opts.schema);
  // radius / tuning are accepted for API compatibility but no longer baked
  // into SQL functions — matching runs in the app layer.
  void opts.radius;
  void opts.tuning;
  void DEFAULT_RADIUS_OPTIONS;

  const { sqlClient } = opts;
  await sqlClient.run(raw(CREATE_SCHEMA_STATE_TABLE_SQL));
  await sqlClient.run(raw(CREATE_MATCHED_TABLE_SQL));
  await sqlClient.run(raw(CREATE_MATCHED_MATCH_ID_INDEX_SQL));
  await sqlClient.run(raw(CREATE_MATCHED_MATCHED_AT_INDEX_SQL));
  await sqlClient.run(raw(CREATE_ACTIVE_PARTITIONS_TABLE_SQL));

  // Ensure waiting table exists before fingerprint compare (fresh DBs).
  await sqlClient.run(raw(CREATE_WAITING_TABLE_SQL));
  await tryAlter(sqlClient, ADD_CLAIM_TOKEN_COLUMN_SQL);
  await tryAlter(sqlClient, ADD_CLAIMED_AT_COLUMN_SQL);
  await tryAlter(sqlClient, ADD_PRIMARY_RATING_COLUMN_SQL);
  await tryAlter(sqlClient, ADD_PRIMARY_BUCKET_COLUMN_SQL);
  await sqlClient.run(raw(CREATE_WAITING_LOOKUP_INDEX_SQL));
  await sqlClient.run(raw(CREATE_WAITING_CLAIM_TOKEN_INDEX_SQL));
  await sqlClient.run(raw(CREATE_WAITING_CLAIMED_AT_INDEX_SQL));

  await maybeRebuildSchema(sqlClient, schema);
}
