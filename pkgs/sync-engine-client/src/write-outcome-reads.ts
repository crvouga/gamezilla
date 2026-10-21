/**
 * What became of this install's writes: one write's outcome, the latest
 * choice of a kind, the refusals nobody has acknowledged, and the queue
 * still waiting to upload.
 */

import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import sql, { join, type Sql } from '@pkgs/sql-root-shared/sql';
import type { MutationRegistry } from '@pkgs/sync-engine-shared/mutations-types';
import { watchMutationFeedback } from './mutation-feedback';
import {
  listUnackedWriteRejections,
  mutationStatus,
  pendingMutationCount,
} from './mutation-status';
import type { SyncEngine, WatchSubscription } from './sync-engine-port';

/**
 * A refused write nobody has acknowledged yet. `mutationName` is `null` when
 * the write itself is no longer on the device.
 */
export type WriteRefusal = {
  readonly mutationId: string;
  readonly mutationName: string | null;
  readonly code: string;
  readonly message: string;
};

type Watch = <T extends Record<string, unknown>>(
  query: Sql<T>
) => WatchSubscription<readonly T[]>;

/**
 * Writes whose callers hear the server's verdict themselves: `pending`
 * through `mutate()`'s result, `local` through its mutation feedback.
 */
function surfacedElsewhere(registry: MutationRegistry): readonly string[] {
  return Object.values(registry)
    .filter((m) => m.pendingUx === 'pending' || m.pendingUx === 'local')
    .map((m) => m.name)
    .sort();
}

/**
 * Unacknowledged refusals of writes no caller hears about: `instant` writes
 * resolve on the local apply, so the server's later refusal undoes them
 * without a word unless something shows it. A refusal whose write is gone
 * from the device, or unknown to this build, is never assumed told.
 */
export function watchUnheardRefusals(
  watch: Watch,
  clientId: string,
  registry: MutationRegistry
): WatchSubscription<readonly WriteRefusal[]> {
  const told = surfacedElsewhere(registry);
  const unheard =
    told.length === 0
      ? sql`1 = 1`
      : sql`(m.name IS NULL OR m.name NOT IN (${join(told.map((name) => sql`${name}`))}))`;
  return watch(sql<WriteRefusal>`
    SELECT r.mutation_id AS "mutationId", m.name AS "mutationName",
      r.code AS code, r.message AS message
    FROM sync_engine_write_rejections AS r
    LEFT JOIN sync_engine_mutations AS m
      ON m.id = r.mutation_id AND m.client_id = r.client_id
    WHERE r.client_id = ${clientId}
      AND r.acknowledged = ${0}
      AND r.deleted_at IS NULL
      AND ${unheard}
    ORDER BY r.created_at ASC, r.mutation_id ASC
  `);
}

export type WriteOutcomeReads = Pick<
  SyncEngine,
  | 'mutationOutcome'
  | 'mutationFeedback'
  | 'listRejections'
  | 'unheardRefusals'
  | 'pendingMutationCount'
>;

/** The {@link SyncEngine} reads of write outcomes, over one local database. */
export function writeOutcomeReads(args: {
  readonly db: SqlClient;
  readonly watch: Watch;
  readonly clientId: () => string;
  readonly registry: MutationRegistry;
}): WriteOutcomeReads {
  return {
    mutationOutcome: (mutationId) => mutationStatus(args.db, mutationId),
    mutationFeedback: (mutationName, scope) =>
      watchMutationFeedback(args.watch, args.clientId(), mutationName, scope),
    listRejections: () => listUnackedWriteRejections(args.db, args.clientId()),
    unheardRefusals: () =>
      watchUnheardRefusals(args.watch, args.clientId(), args.registry),
    pendingMutationCount: () => pendingMutationCount(args.db, args.clientId()),
  };
}
