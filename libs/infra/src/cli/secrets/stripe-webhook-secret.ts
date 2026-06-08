import type { SecretEntry } from './types';

/**
 * Optional until `stripe:sync` creates the webhook endpoint and writes this to Vault.
 */
export class StripeWebhookSecret implements SecretEntry {
  readonly secretKey = 'STRIPE_WEBHOOK_SECRET';
  readonly env = 'STRIPE_WEBHOOK_SECRET';
  readonly hint =
    'Stripe webhook signing secret (whsec_…) — set by `bun run --filter @apps/api stripe:sync` after first deploy, or paste from Dashboard → Developers → Webhooks';

  async validate(value: string): Promise<string | null> {
    const v = value.trim();
    if (v.length === 0) return 'Must be non-empty when set';
    if (!v.startsWith('whsec_')) {
      return 'Must start with whsec_';
    }
    return null;
  }
}
