/**
 * Top-level Stripe sync orchestrator.
 *
 * Composes catalog reconcile → patch-db backfills → webhook reconcile in a
 * stable order on a single shared Stripe client + PatchDb + Vault CLI.
 *
 * The order matters:
 *   1. Catalog: ensures Products/Prices exist + patch-db has the latest
 *      `stripe.catalog_*` entities so the Worker can resolve `priceKey` after webhooks
 *      start firing.
 *   2. Entities: snapshots existing Stripe state into patch-db so any objects
 *      created before this deploy (or before webhooks were configured) are
 *      visible to the API.
 *   3. Webhooks: only after catalog + patch-db are coherent do we wire up the
 *      live event stream — otherwise the first webhook events arrive against
 *      a DB that doesn't know about the existing customers/subs.
 */
import type { SecretStore } from '@pkgs/secret-store';
import type { PatchDb } from '@pkgs/patch-db/interface';
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
  readonly patchDb: PatchDb;
  /** Used by the webhook step to persist the freshly-issued `whsec_…`. */
  readonly secretStore: SecretStore;
  /** Absolute origin of the API Worker, e.g. `https://api.gamezilla.app`. */
  readonly apiUrlBase: string;
  /** When true, webhook reconcile logs the plan without mutating Stripe/secrets. */
  readonly dryRun?: boolean;
}): Promise<StripeFullSyncResult> {
  const { stripe, patchDb, secretStore, apiUrlBase } = args;

  const catalog = await runStripeCatalogSync({ stripe, patchDb });
  const entities = await runStripeEntitiesSync({ stripe, patchDb });
  const webhooks = await runStripeWebhookSync({
    stripe,
    secretStore,
    apiUrlBase,
    ...(args.dryRun === undefined ? {} : { dryRun: args.dryRun }),
  });

  return { catalog, entities, webhooks };
}
