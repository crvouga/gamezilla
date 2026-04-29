/**
 * Entity backfill orchestration.
 *
 * Streams every supported Stripe object type ({@link ALL_BACKFILL_ENTITY_TYPES})
 * into an `EntityDb`, in a stable order, on a single shared connection. Each
 * row is persisted by {@link backfillStripeListIntoEntityDb} as raw Stripe API
 * JSON so consumers downstream can re-derive any projection they want without
 * round-tripping Stripe.
 *
 * Pure orchestration — no secret resolution, no SQL setup. Callers pass a
 * ready-to-use Stripe client and EntityDb; the entry-point script in
 * `scripts/sync.ts` owns those resources.
 */
import type { EntityDb } from '@gamezilla/lib/entity-db/interface';
import type Stripe from 'stripe';
import {
  ALL_BACKFILL_ENTITY_TYPES,
  ENTITY_BACKFILL_RUNNERS,
  backfillStripeListIntoEntityDb,
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
  readonly entityDb: EntityDb;
  readonly entity: StripeEntityObjectType;
}): Promise<number> {
  const { stripe, entityDb, entity } = args;
  const subTag = `${TAG} ${entity}`;
  const runner = ENTITY_BACKFILL_RUNNERS[entity];
  const iterator = runner({ stripe });
  console.log(`[${subTag}] starting`);
  const { written } = await backfillStripeListIntoEntityDb({
    entityDb,
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
  readonly entityDb: EntityDb;
  readonly entity: StripeEntityObjectType;
}): Promise<EntitiesSyncEntry> {
  const written = await runOne(args);
  return { entity: args.entity, written };
}

/** Run every entity backfill in {@link ALL_BACKFILL_ENTITY_TYPES} order. */
export async function runStripeEntitiesSync(args: {
  readonly stripe: Stripe;
  readonly entityDb: EntityDb;
}): Promise<EntitiesSyncResult> {
  const { stripe, entityDb } = args;
  const perEntity: EntitiesSyncEntry[] = [];
  let totalWritten = 0;
  for (const entity of ALL_BACKFILL_ENTITY_TYPES) {
    const written = await runOne({ stripe, entityDb, entity });
    perEntity.push({ entity, written });
    totalWritten += written;
  }
  console.log(`[${TAG}] done — wrote ${totalWritten} row(s) total`);
  return { perEntity, totalWritten };
}
