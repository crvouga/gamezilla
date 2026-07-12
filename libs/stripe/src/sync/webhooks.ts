/**
 * Webhook endpoint reconciliation: one endpoint, all events (`*`).
 *
 * When state drifts: delete every existing endpoint, create the desired one,
 * push the freshly-issued `whsec_…` signing secret to secret store so the API
 * Worker can verify incoming events on next deploy.
 *
 * Pure orchestration — no secret resolution. Callers pass a ready-to-use
 * Stripe client + secret store CLI, and the absolute origin of the API Worker.
 *
 * `dryRun: true` short-circuits before any Stripe or secret store mutation.
 */
import type { SecretStore } from '@pkgs/secret-store';
import type Stripe from 'stripe';
import { StripeSecretKeys } from '../secret-keys';
import {
  decideWebhookSyncPlan,
  isLocalApiUrl,
  type WebhookEndpointSummary,
} from '../webhooks-sync-shared';

const TAG = 'stripe sync webhooks';

/**
 * Managed Stripe webhook description. Changing this string forces a rebuild
 * on the next sync (description is part of the in-sync check) so a freshly
 * issued `whsec_…` can be written to the secret store.
 */
const WEBHOOK_DESCRIPTION =
  'API worker — managed by @libs/stripe sync (api.gamezilla.app)';
// Deployed Stripe endpoint metadata value. Do not change without migrating
// the `managed_by` metadata on existing live webhook endpoints.
const WEBHOOK_MANAGED_BY_TAG = 'gamezilla_stripe_sync';
const WEBHOOK_PATH = '/api/stripe/webhook';

export type WebhookSyncResult =
  | {
      readonly kind: 'noop';
      readonly desiredUrl: string;
      readonly existing: number;
    }
  | {
      readonly kind: 'rebuilt';
      readonly desiredUrl: string;
      readonly deletedCount: number;
      readonly createdId: string;
      readonly webhookSecret: string;
    }
  | {
      readonly kind: 'dry-run';
      readonly desiredUrl: string;
      readonly existing: number;
      readonly plan: 'noop' | 'rebuild';
    }
  | {
      readonly kind: 'skipped-local';
      readonly desiredUrl: string;
    };

async function listAllWebhookEndpoints(
  stripe: Stripe
): Promise<Stripe.WebhookEndpoint[]> {
  const out: Stripe.WebhookEndpoint[] = [];
  for await (const ep of stripe.webhookEndpoints.list({ limit: 100 })) {
    out.push(ep);
  }
  return out;
}

function toSummary(
  endpoints: ReadonlyArray<Stripe.WebhookEndpoint>
): WebhookEndpointSummary[] {
  return endpoints.map((e) => ({
    url: e.url,
    enabled_events: e.enabled_events ?? [],
    status: e.status,
    description: e.description ?? null,
  }));
}

function buildDesiredWebhookUrl(apiUrlBase: string): string {
  const trimmed = apiUrlBase.trim().replace(/\/+$/, '');
  return `${trimmed}${WEBHOOK_PATH}`;
}

async function rebuildWebhookEndpoint(
  stripe: Stripe,
  endpoints: ReadonlyArray<Stripe.WebhookEndpoint>,
  desiredUrl: string,
  secretStore: SecretStore
): Promise<{ deletedCount: number; createdId: string; secret: string }> {
  let deletedCount = 0;
  for (const ep of endpoints) {
    await stripe.webhookEndpoints.del(ep.id);
    deletedCount += 1;
    console.log(`[${TAG}] deleted endpoint ${ep.id}`);
  }

  const created = await stripe.webhookEndpoints.create({
    url: desiredUrl,
    enabled_events: ['*'],
    description: WEBHOOK_DESCRIPTION,
    metadata: { managed_by: WEBHOOK_MANAGED_BY_TAG },
  });
  console.log(`[${TAG}] created endpoint ${created.id}`);

  if (
    typeof created.secret !== 'string' ||
    !created.secret.startsWith('whsec_')
  ) {
    throw new Error(
      `[${TAG}] Stripe did not return a whsec_ signing secret on webhook endpoint create`
    );
  }

  await secretStore.setSecret(StripeSecretKeys.webhookSecret, created.secret);
  process.env[StripeSecretKeys.webhookSecret] = created.secret;
  console.log(
    `[${TAG}] wrote ${StripeSecretKeys.webhookSecret} via secret store`
  );

  return { deletedCount, createdId: created.id, secret: created.secret };
}

/**
 * Reconcile Stripe webhook endpoints to the canonical state for `apiUrlBase`.
 * On rebuild, writes the new `whsec_…` secret back through `secretStore`
 * under {@link StripeSecretKeys.webhookSecret}.
 */
export async function runStripeWebhookSync(args: {
  readonly stripe: Stripe;
  /**
   * Used to persist the freshly-issued `whsec_…` after a rebuild. Must be a
   * write-capable {@link SecretStore} (typically a `secret storeScriptSecretStore`);
   * read-only HTTP impls will throw on `setSecret`.
   */
  readonly secretStore: SecretStore;
  /** Absolute origin of the API Worker (no path), e.g. `https://api.gamezilla.app`. */
  readonly apiUrlBase: string;
  readonly dryRun?: boolean;
}): Promise<WebhookSyncResult> {
  const { stripe, secretStore, apiUrlBase, dryRun = false } = args;
  const desiredUrl = buildDesiredWebhookUrl(apiUrlBase);

  if (isLocalApiUrl(apiUrlBase)) {
    console.log(
      `[${TAG}] desiredUrl=${desiredUrl} skipped — API_URL is not publicly accessible. ` +
        'Use the Stripe CLI for local webhooks: ' +
        `\`stripe listen --forward-to ${desiredUrl}\` ` +
        '(then paste the printed `whsec_…` into secret store as STRIPE_WEBHOOK_SECRET).'
    );
    return { kind: 'skipped-local', desiredUrl };
  }

  const endpoints = await listAllWebhookEndpoints(stripe);
  const summary = toSummary(endpoints);
  const plan = decideWebhookSyncPlan(summary, desiredUrl, {
    desiredDescription: WEBHOOK_DESCRIPTION,
  });

  console.log(
    `[${TAG}] desiredUrl=${desiredUrl} existing=${endpoints.length} plan=${plan}${dryRun ? ' (dry-run)' : ''}`
  );

  if (plan === 'noop') {
    console.log(`[${TAG}] in sync — nothing to do`);
    return { kind: 'noop', desiredUrl, existing: endpoints.length };
  }

  if (dryRun) {
    console.log(`[${TAG}] dry-run: would delete all endpoints and create one`);
    return {
      kind: 'dry-run',
      desiredUrl,
      existing: endpoints.length,
      plan,
    };
  }

  const { deletedCount, createdId, secret } = await rebuildWebhookEndpoint(
    stripe,
    endpoints,
    desiredUrl,
    secretStore
  );

  return {
    kind: 'rebuilt',
    desiredUrl,
    deletedCount,
    createdId,
    webhookSecret: secret,
  };
}
