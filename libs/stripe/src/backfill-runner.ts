/**
 * Per-entity script runner — keeps `scripts/sync-<entity>.ts` files
 * down to ~10 lines while preserving consistent logs + error handling.
 */
import {
  ALL_BACKFILL_ENTITY_TYPES,
  ENTITY_BACKFILL_RUNNERS,
  backfillStripeListIntoEntityDb,
  type StripeEntityObjectType,
} from './backfill-entities';
import {
  createStripeScriptContext,
  type StripeScriptContext,
} from './script-runtime';

function scriptTagFor(entity: StripeEntityObjectType): string {
  return `stripe sync ${entity}`;
}

async function runOne(
  ctx: StripeScriptContext,
  entity: StripeEntityObjectType
): Promise<number> {
  const tag = scriptTagFor(entity);
  const runner = ENTITY_BACKFILL_RUNNERS[entity];
  const iterator = runner({ stripe: ctx.stripe });
  console.log(`[${tag}] starting`);
  const { written } = await backfillStripeListIntoEntityDb({
    entityDb: ctx.entityDb,
    iterator,
    expectedObjectType: entity,
    onProgress: ({ written: n }) =>
      console.log(`[${tag}] progress ${n} rows`),
  });
  console.log(`[${tag}] done — wrote ${written} ${entity} row(s)`);
  return written;
}

/** Run a single-entity backfill end-to-end. Owns ctx lifecycle. */
export async function runStripeEntityBackfill(
  entity: StripeEntityObjectType
): Promise<void> {
  const ctx = await createStripeScriptContext(scriptTagFor(entity));
  try {
    await runOne(ctx, entity);
  } finally {
    await ctx.disconnect();
  }
}

/** Run every backfill in a stable order on one shared connection. */
export async function runAllStripeEntityBackfills(): Promise<void> {
  const ctx = await createStripeScriptContext('stripe sync entities');
  try {
    let total = 0;
    for (const entity of ALL_BACKFILL_ENTITY_TYPES) {
      total += await runOne(ctx, entity);
    }
    console.log(`[stripe sync entities] done — wrote ${total} row(s) total`);
  } finally {
    await ctx.disconnect();
  }
}
