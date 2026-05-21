/**
 * One-shot cleanup of legacy hand-written `idx_snap_*` snapshot indexes that
 * existed before app code switched to declarative `pdb_idx_*` indexes via
 * `@pkgs/patch-db`'s `PatchDbEngineOptions.indexes`.
 *
 * The new declarative reconciler only manages indexes whose names start with
 * `pdb_idx_`, so it cannot drop these by itself. Listing names explicitly
 * keeps the cleanup conservative: we never drop an index we did not author.
 *
 * Safe to remove from the migration sequence after one production deploy
 * cycle (i.e. after every database has run this cleanup at least once).
 *
 * Idempotent (`DROP INDEX IF EXISTS`) and tolerates the same `42501 must be
 * owner of …` ownership error patch-db's own DDL tolerates today.
 */
import type { Logger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';

const LEGACY_SNAPSHOT_INDEX_NAMES = [
  'idx_snap_space_host',
  'idx_snap_space_live',
  'idx_snap_membership_guest',
  'idx_snap_membership_space',
  'idx_snap_membership_active',
  'idx_snap_session_device',
  'idx_snap_session_account',
  'idx_snap_provider_account',
] as const;

type PgLikeError = {
  code?: string;
  message?: string;
};

function toPgLikeError(error: unknown): PgLikeError {
  if (error !== null && typeof error === 'object') return error as PgLikeError;
  return {};
}

function isIgnorableOwnershipError(error: unknown): boolean {
  const e = toPgLikeError(error);
  return (
    e.code === '42501' &&
    /must be owner of (table|index|relation) /i.test(e.message ?? '')
  );
}

export async function dropLegacyAppSnapshotIndexes(args: {
  sqlClient: SqlClient;
  logger: Logger;
}): Promise<void> {
  const log = args.logger.child({
    migration: 'drop-legacy-app-snapshot-indexes',
  });
  log.info('legacy app snapshot indexes: start', {
    count: LEGACY_SNAPSHOT_INDEX_NAMES.length,
  });
  for (const name of LEGACY_SNAPSHOT_INDEX_NAMES) {
    const stmt = `DROP INDEX IF EXISTS "${name}"`;
    try {
      await args.sqlClient.run(stmt);
    } catch (error) {
      if (isIgnorableOwnershipError(error)) {
        const e = toPgLikeError(error);
        log.warn('legacy app snapshot indexes: skipping (non-owner)', {
          code: e.code,
          message: e.message ?? String(error),
          indexName: name,
        });
        continue;
      }
      log.error('legacy app snapshot indexes: drop failed', {
        indexName: name,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
  log.info('legacy app snapshot indexes: complete');
}
