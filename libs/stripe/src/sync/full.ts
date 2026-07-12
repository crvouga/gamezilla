/**
 * Top-level Stripe sync orchestrator.
 *
 * Composes catalog reconcile → entity_store backfills → webhook reconcile in a
 * stable order on a single shared Stripe client + SqlClient + secret store CLI.
 */
import type { SecretStore } from '@pkgs/secret-store';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type Stripe from 'stripe';
import { runStripeCatalogSync, type CatalogSyncResult } from './catalog';
import { runStripeEntitiesSync, type EntitiesSyncResult } from './entities';
import { runStripeWebhookSync, type WebhookSyncResult } from './webhooks';

export type StripeFullSyncResult = {
  readonly catalog: CatalogSyncResult;
  readonly entities: EntitiesSyncResult;
  readonly webhooks: WebhookSyncResult;
};

export async function runStripeFullSync(args: {
  readonly stripe: Stripe;
  readonly sql: SqlClient;
  /** Used by the webhook step to persist the freshly-issued `whsec_…`. */
  readonly secretStore: SecretStore;
  /** Absolute origin of the API Worker, e.g. `https://api.gamezilla.app`. */
  readonly apiUrlBase: string;
  /** When true, webhook reconcile logs the plan without mutating Stripe/secrets. */
  readonly dryRun?: boolean;
}): Promise<StripeFullSyncResult> {
  const { stripe, sql, secretStore, apiUrlBase } = args;

  const catalog = await runStripeCatalogSync({ stripe, sql });
  const entities = await runStripeEntitiesSync({ stripe, sql });
  const webhooks = await runStripeWebhookSync({
    stripe,
    secretStore,
    apiUrlBase,
    ...(args.dryRun === undefined ? {} : { dryRun: args.dryRun }),
  });

  return { catalog, entities, webhooks };
}
