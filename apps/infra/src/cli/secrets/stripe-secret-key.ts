import type { SecretEntry } from './types';

async function validateStripeSecretKeyValue(
  value: string
): Promise<string | null> {
  const v = value.trim();
  if (v.length === 0) return 'Must be non-empty';
  if (!v.startsWith('sk_live_') && !v.startsWith('sk_test_')) {
    return 'Must start with sk_live_ or sk_test_';
  }
  try {
    const res = await fetch('https://api.stripe.com/v1/products?limit=1', {
      headers: { Authorization: `Bearer ${v}` },
    });
    if (!res.ok) {
      return `Stripe API returned HTTP ${res.status}`;
    }
  } catch (e) {
    return `Stripe unreachable: ${e instanceof Error ? e.message : String(e)}`;
  }
  return null;
}

export class StripeSecretKey implements SecretEntry {
  readonly secretKey = 'STRIPE_SECRET_KEY';
  readonly env = 'STRIPE_SECRET_KEY';
  readonly hint =
    'Stripe secret API key (sk_live_… or sk_test_…) — Dashboard → Developers → API keys';

  async validate(value: string): Promise<string | null> {
    const v = value.trim();
    if (v.length === 0) return 'Must be non-empty when set';
    return validateStripeSecretKeyValue(v);
  }
}
