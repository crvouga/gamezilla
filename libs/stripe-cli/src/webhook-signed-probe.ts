import Stripe from 'stripe';
import { STRIPE_CLI_LOG_TAG } from './constants';
import { stripeWebhookUrl } from './webhook-urls';

const PROBE_MAX_ATTEMPTS = 15;
const PROBE_RETRY_MS = 2000;
const PROBE_BODY_PREVIEW_LIMIT = 200;

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

function formatProbeDetail(status: number, body: string): string {
  const trimmed = body.trim();
  if (trimmed.length === 0) return `HTTP ${String(status)}`;
  const preview =
    trimmed.length > PROBE_BODY_PREVIEW_LIMIT
      ? `${trimmed.slice(0, PROBE_BODY_PREVIEW_LIMIT)}…`
      : trimmed;
  return `HTTP ${String(status)} ${preview}`;
}

type ProbeAttempt =
  | { readonly kind: 'ok'; readonly status: number }
  | { readonly kind: 'http'; readonly detail: string }
  | { readonly kind: 'error'; readonly detail: string };

async function probeOnce(args: {
  readonly url: string;
  readonly signature: string;
  readonly payload: string;
}): Promise<ProbeAttempt> {
  try {
    const res = await fetch(args.url, {
      method: 'POST',
      headers: {
        'stripe-signature': args.signature,
        'Content-Type': 'application/json',
      },
      body: args.payload,
    });
    if (res.ok) return { kind: 'ok', status: res.status };
    const text = await res.text().catch(() => '');
    return { kind: 'http', detail: formatProbeDetail(res.status, text) };
  } catch (e: unknown) {
    const detail = `fetch error: ${e instanceof Error ? e.message : String(e)}`;
    return { kind: 'error', detail };
  }
}

/**
 * POST a Stripe-signed test event to `/stripe/webhook` so the signing secret
 * in Doppler matches `whsec`. The Worker self-heals a stale cached secret on
 * the same request (see `constructStripeEventSelfHealing` in
 * `@libs/stripe/stripe-webhook-route`), so the probe usually succeeds on the
 * first attempt; the retry loop covers Worker boot races and Doppler write
 * propagation.
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
  const signature = await stripe.webhooks.generateTestHeaderStringAsync({
    payload,
    secret: args.whsec,
  });
  const url = stripeWebhookUrl(args.apiBase);
  let lastDetail = '(no attempts)';
  for (let attempt = 1; attempt <= PROBE_MAX_ATTEMPTS; attempt += 1) {
    const result = await probeOnce({ url, signature, payload });
    if (result.kind === 'ok') {
      console.log(
        `[${STRIPE_CLI_LOG_TAG}] webhook probe OK — ${url} accepted signed test event (HTTP ${String(result.status)})`
      );
      return;
    }
    lastDetail = result.detail;
    if (
      result.kind === 'error' ||
      attempt === 1 ||
      attempt === PROBE_MAX_ATTEMPTS
    ) {
      console.log(
        `[${STRIPE_CLI_LOG_TAG}] webhook probe attempt ${String(attempt)}/${String(PROBE_MAX_ATTEMPTS)}: ${lastDetail}`
      );
    }
    if (attempt < PROBE_MAX_ATTEMPTS) {
      await Bun.sleep(PROBE_RETRY_MS);
    }
  }
  const hint =
    'If you just rotated STRIPE_WEBHOOK_SECRET, the next probe attempt should refresh the Worker cache; ' +
    'if it does not, check that `wrangler dev` is running and API_URL points at it.';
  const summary = `${STRIPE_CLI_LOG_TAG}: API ${url} rejected the signed probe after ${String(
    PROBE_MAX_ATTEMPTS
  )} attempts. Last response: ${lastDetail}. ${hint}`;
  console.error(`[${STRIPE_CLI_LOG_TAG}] ${summary}`);
  throw new Error(summary);
}
