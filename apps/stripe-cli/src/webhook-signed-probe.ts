import Stripe from 'stripe';
import { STRIPE_CLI_LOG_TAG } from './constants';
import { stripeWebhookUrl } from './webhook-urls';

const PROBE_MAX_ATTEMPTS = 15;
const PROBE_RETRY_MS = 2000;

function buildProbeEventJson(): string {
  const event = {
    id: 'evt_gamezilla_stripe_cli_probe',
    object: 'event',
    type: 'customer.created',
    data: {
      object: {
        id: 'cus_gamezilla_stripe_cli_probe',
        object: 'customer',
      },
    },
    livemode: false,
    api_version: '2024-11-20.acacia',
    created: Math.floor(Date.now() / 1000),
  };
  return JSON.stringify(event);
}

/**
 * POST a Stripe-signed test event to `/stripe/webhook` so the signing secret in
 * Doppler matches `whsec`. Retries for API Doppler cache (~5m).
 */
export async function verifyWebhookWithSignedProbe(args: {
  readonly apiBase: string;
  readonly whsec: string;
  readonly stripeSecretKey: string;
}): Promise<void> {
  const payload = buildProbeEventJson();
  const stripe = new Stripe(args.stripeSecretKey, {
    httpClient: Stripe.createFetchHttpClient(),
  });
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: args.whsec,
  });
  const url = stripeWebhookUrl(args.apiBase);
  let lastDetail = '';
  for (let attempt = 1; attempt <= PROBE_MAX_ATTEMPTS; attempt += 1) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'stripe-signature': signature,
        'Content-Type': 'application/json',
      },
      body: payload,
    });
    const text = await res.text().catch(() => '');
    if (res.ok) {
      console.log(
        `[${STRIPE_CLI_LOG_TAG}] webhook probe OK — ${url} accepted signed test event (HTTP ${String(res.status)})`
      );
      return;
    }
    lastDetail = text.length > 0 ? text : `HTTP ${String(res.status)}`;
    if (attempt === 1 || attempt === PROBE_MAX_ATTEMPTS) {
      console.log(
        `[${STRIPE_CLI_LOG_TAG}] webhook probe attempt ${String(attempt)}/${String(PROBE_MAX_ATTEMPTS)}: HTTP ${String(res.status)}`
      );
    }
    if (attempt < PROBE_MAX_ATTEMPTS) {
      await Bun.sleep(PROBE_RETRY_MS);
    }
  }
  const hint =
    'If you just set STRIPE_WEBHOOK_SECRET, restart `wrangler dev` or wait for the API Doppler secret cache to refresh.';
  console.error(
    `[${STRIPE_CLI_LOG_TAG}] webhook probe failed after ${String(PROBE_MAX_ATTEMPTS)} attempts. Last: ${lastDetail}. ${hint}`
  );
  throw new Error(
    `${STRIPE_CLI_LOG_TAG}: API /stripe/webhook rejected the signed probe (misconfigured Stripe webhook secret, wrong API_URL, or API not wired). ${hint}`
  );
}
