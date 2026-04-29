/**
 * Declarative Stripe webhook endpoint sync: one endpoint, all events (`*`).
 * When state drifts: delete all endpoints, create desired, push `whsec_` to Doppler.
 *
 * Reads `STRIPE_SECRET_KEY` and `API_URL` from Doppler via SecretStore (`DOPPLER_TOKEN` or CLI login).
 * Doppler CLI must be configured for `STRIPE_WEBHOOK_SECRET` write (`doppler secrets set`).
 *
 * Flags: `--dry-run` — log plan only; no Stripe or Doppler mutations.
 */
import { TextDecoder } from 'node:util';
import Stripe from 'stripe';
import { createStripeScriptSecretStore } from '../src/script-secret-store';
import { StripeSecretKeys } from '../src/secret-keys';
import {
  decideWebhookSyncPlan,
  type WebhookEndpointSummary,
} from '../src/webhooks-sync-shared';

async function assertApiUrlBase(): Promise<string> {
  const store = createStripeScriptSecretStore();
  const raw = await store.getOptional('API_URL');
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    console.error(
      '[stripe webhooks sync] API_URL is required in Doppler — absolute origin of the API Worker (no path), e.g. https://api.gamezilla.app'
    );
    process.exit(1);
  }
  return raw.trim().replace(/\/+$/, '');
}

async function desiredWebhookUrl(): Promise<string> {
  return `${await assertApiUrlBase()}/stripe/webhook`;
}

async function assertStripeKey(): Promise<string> {
  const store = createStripeScriptSecretStore();
  const key = await store.getOptional(StripeSecretKeys.secretKey);
  const trimmed = typeof key === 'string' ? key.trim() : '';
  if (trimmed.length === 0) {
    console.error(
      '[stripe webhooks sync] STRIPE_SECRET_KEY is missing or blank in Doppler'
    );
    process.exit(1);
  }
  return trimmed;
}

function parseDryRun(argv: string[]): boolean {
  return argv.includes('--dry-run');
}

function setDopplerSecret(name: string, value: string): void {
  const proc = Bun.spawnSync(
    ['doppler', 'secrets', 'set', `${name}=${value}`],
    {
      stdout: 'pipe',
      stderr: 'pipe',
    }
  );
  if (proc.exitCode !== 0) {
    const err = new TextDecoder().decode(proc.stderr);
    throw new Error(
      `doppler secrets set ${name} failed (exit ${proc.exitCode}): ${err}`
    );
  }
}

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
  }));
}

async function main(): Promise<void> {
  const dryRun = parseDryRun(process.argv);
  const secret = await assertStripeKey();
  const stripe = new Stripe(secret);
  const desiredUrl = await desiredWebhookUrl();

  const endpoints = await listAllWebhookEndpoints(stripe);
  const summary = toSummary(endpoints);
  const plan = decideWebhookSyncPlan(summary, desiredUrl);

  console.log(
    `[stripe webhooks sync] desiredUrl=${desiredUrl} existing=${endpoints.length} plan=${plan}${dryRun ? ' (dry-run)' : ''}`
  );

  if (plan === 'noop') {
    console.log('[stripe webhooks sync] in sync — nothing to do');
    return;
  }

  if (dryRun) {
    console.log(
      '[stripe webhooks sync] dry-run: would delete all endpoints and create one'
    );
    return;
  }

  for (const ep of endpoints) {
    await stripe.webhookEndpoints.del(ep.id);
    console.log(`[stripe webhooks sync] deleted endpoint ${ep.id}`);
  }

  const created = await stripe.webhookEndpoints.create({
    url: desiredUrl,
    enabled_events: ['*'],
    description:
      'gamezilla api worker — managed by @gamezilla/stripe webhooks sync',
    metadata: { managed_by: 'gamezilla_stripe_webhooks_sync' },
  });

  console.log(`[stripe webhooks sync] created endpoint ${created.id}`);

  if (
    typeof created.secret !== 'string' ||
    !created.secret.startsWith('whsec_')
  ) {
    throw new Error(
      'Stripe did not return a whsec_ signing secret on webhook endpoint create'
    );
  }

  setDopplerSecret(StripeSecretKeys.webhookSecret, created.secret);
  console.log(
    `[stripe webhooks sync] wrote ${StripeSecretKeys.webhookSecret} to Doppler`
  );
}

await main().catch((e: unknown) => {
  console.error(
    '[stripe webhooks sync] failed',
    e instanceof Error ? e.message : String(e)
  );
  process.exit(1);
});
