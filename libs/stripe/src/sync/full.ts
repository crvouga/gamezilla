/**
 * Top-level Stripe sync orchestrator.
 *
 * Composes catalog reconcile → entity_store backfills in a stable order on a
 * single shared Stripe client + SqlClient.
 */
import type { SqlClient } from '@pkgs/sql-client/interface';
import type Stripe from 'stripe';
import { type CatalogSyncResult, runStripeCatalogSync } from './catalog';
import { type EntitiesSyncResult, runStripeEntitiesSync } from './entities';

export type StripeFullSyncResult = {
  readonly catalog: CatalogSyncResult;
  readonly entities: EntitiesSyncResult;
};

export async function runStripeFullSync(args: {
  readonly stripe: Stripe;
  readonly sql: SqlClient;
}): Promise<StripeFullSyncResult> {
  const { stripe, sql } = args;

  const catalog = await runStripeCatalogSync({ stripe, sql });
  const entities = await runStripeEntitiesSync({ stripe, sql });

  return { catalog, entities };
}
