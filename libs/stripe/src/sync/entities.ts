/**
 * Entity backfill orchestration.
 *
 * Streams every supported Stripe object type ({@link ALL_BACKFILL_ENTITY_TYPES})
 * into entity_store, in a stable order, on a single shared connection.
 */
import type { SqlClient } from '@pkgs/sql-client/interface';
import type Stripe from 'stripe';
import {
  ALL_BACKFILL_ENTITY_TYPES,
  ENTITY_BACKFILL_RUNNERS,
  backfillStripeListIntoEntityStore,
  type StripeEntityObjectType,
} from '../backfill-entities';

const TAG = 'stripe sync entities';

export type EntitiesSyncEntry = {
  readonly entity: StripeEntityObjectType;
  readonly written: number;
};

export type EntitiesSyncResult = {
  readonly perEntity: ReadonlyArray<EntitiesSyncEntry>;
  readonly totalWritten: number;
};

async function runOne(args: {
  readonly stripe: Stripe;
  readonly sql: SqlClient;
  readonly entity: StripeEntityObjectType;
}): Promise<number> {
  const { stripe, sql, entity } = args;
  const subTag = `${TAG} ${entity}`;
  const runner = ENTITY_BACKFILL_RUNNERS[entity];
  const iterator = runner({ stripe });
  console.log(`[${subTag}] starting`);
  const { written } = await backfillStripeListIntoEntityStore({
    sql,
    iterator,
    expectedObjectType: entity,
    onProgress: ({ written: n }) =>
      console.log(`[${subTag}] progress ${n} rows`),
  });
  console.log(`[${subTag}] done — wrote ${written} ${entity} row(s)`);
  return written;
}

/**
 * Run a single-entity backfill — kept exported for ad-hoc one-off backfills
 * (most callers should use {@link runStripeEntitiesSync} which covers all types).
 */
export async function runStripeEntityBackfill(args: {
  readonly stripe: Stripe;
  readonly sql: SqlClient;
  readonly entity: StripeEntityObjectType;
}): Promise<EntitiesSyncEntry> {
  const written = await runOne(args);
  return { entity: args.entity, written };
}

/** Run every entity backfill in {@link ALL_BACKFILL_ENTITY_TYPES} order. */
export async function runStripeEntitiesSync(args: {
  readonly stripe: Stripe;
  readonly sql: SqlClient;
}): Promise<EntitiesSyncResult> {
  const { stripe, sql } = args;
  const perEntity: EntitiesSyncEntry[] = [];
  let totalWritten = 0;
  for (const entity of ALL_BACKFILL_ENTITY_TYPES) {
    const written = await runOne({ stripe, sql, entity });
    perEntity.push({ entity, written });
    totalWritten += written;
  }
  console.log(`[${TAG}] done — wrote ${totalWritten} row(s) total`);
  return { perEntity, totalWritten };
}
