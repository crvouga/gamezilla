/**
 * Single Stripe sync entry point — catalog + entity_store backfills + webhook endpoints.
 *
 * Reads via secret store (`SECRETS_TOKEN` or secrets CLI login):
 *   - `STRIPE_SECRET_KEY` (required)
 *   - `DATABASE_URL`            (required; `postgres://…`)
 *
 * Production API origin is derived from project config (not secret store `API_URL`).
 *
 * Writes via secret store CLI on webhook rebuild:
 *   - `STRIPE_WEBHOOK_SECRET`
 *
 * Flags:
 *   --dry-run   Webhook step logs plan without mutating Stripe / secret store.
 *               (Catalog + entity_store steps are idempotent and always run.)
 */
import { APP_IDENTITY } from '@libs/auth/shared/app-identity';
import { pushWorkerSecretBinding } from '@libs/infra/cli/lib/push-worker-secret';
import {
  assertDbUrl,
  assertStripeSecretKey,
  createSqlClientFromDbUrl,
  createStripeClientFromSecret,
} from '../src/script-runtime';
import { StripeSecretKeys } from '../src/secret-keys';
import { createStripeScriptSecretStore } from '../src/script-secret-store';
import { runStripeFullSync } from '../src/sync';

const SCRIPT_TAG = 'stripe sync';

function resolveProductionApiUrlBase(): string {
  return `https://${APP_IDENTITY.apiHost}`.replace(/\/+$/, '');
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const [secret, dbUrl, apiUrlBase] = await Promise.all([
    assertStripeSecretKey(SCRIPT_TAG),
    assertDbUrl(SCRIPT_TAG),
    Promise.resolve(resolveProductionApiUrlBase()),
  ]);

  const stripe = createStripeClientFromSecret(secret);
  const sql = createSqlClientFromDbUrl(dbUrl);
  await sql.connect();
  try {
    const secretStore = await createStripeScriptSecretStore();

    const result = await runStripeFullSync({
      stripe,
      sql,
      secretStore,
      apiUrlBase,
      dryRun,
    });

    if (result.webhooks.kind === 'rebuilt') {
      pushWorkerSecretBinding(
        StripeSecretKeys.webhookSecret,
        result.webhooks.webhookSecret
      );
      console.log(
        `[${SCRIPT_TAG}] pushed ${StripeSecretKeys.webhookSecret} to Cloudflare Worker`
      );
    }

    console.log(
      `[${SCRIPT_TAG}] done`,
      JSON.stringify({
        catalog: {
          products: result.catalog.products.length,
          prices: result.catalog.prices.length,
          dumpedToEntityStore: result.catalog.catalogDumped,
        },
        entities: {
          totalWritten: result.entities.totalWritten,
          perEntity: result.entities.perEntity,
        },
        webhooks:
          result.webhooks.kind === 'rebuilt'
            ? {
                kind: result.webhooks.kind,
                desiredUrl: result.webhooks.desiredUrl,
                deletedCount: result.webhooks.deletedCount,
                createdId: result.webhooks.createdId,
              }
            : result.webhooks,
      })
    );
  } finally {
    await sql.disconnect();
  }
}

await main().catch((e: unknown) => {
  console.error(
    `[${SCRIPT_TAG}] failed`,
    e instanceof Error ? e.message : String(e)
  );
  process.exit(1);
});
