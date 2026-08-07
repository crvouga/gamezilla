import { requireNonEmpty, Secret, type SecretInput } from './secret';

async function validateStripeSecretKey(input: SecretInput): Promise<void> {
  const v = input.secretValue.trim();
  requireNonEmpty(v, 'STRIPE_SECRET_KEY');
  if (!v.startsWith('sk_live_') && !v.startsWith('sk_test_')) {
    throw new Error('Must start with sk_live_ or sk_test_');
  }
  try {
    const res = await fetch('https://api.stripe.com/v1/products?limit=1', {
      headers: { Authorization: `Bearer ${v}` },
    });
    if (!res.ok) {
      throw new Error(`Stripe API returned HTTP ${String(res.status)}`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Stripe')) throw e;
    throw new Error(
      `Stripe unreachable: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

async function validateStripePublishableKey(input: SecretInput): Promise<void> {
  const v = input.secretValue.trim();
  requireNonEmpty(v, 'STRIPE_PUBLISHABLE_KEY');
  if (!v.startsWith('pk_live_') && !v.startsWith('pk_test_')) {
    throw new Error('Must start with pk_live_ or pk_test_');
  }
}

export const STRIPE_SECRET_KEY = new Secret({
  name: 'STRIPE_SECRET_KEY',
  hint: 'Stripe secret API key (sk_live_… or sk_test_…) — Dashboard → Developers → API keys',
  pushToApiWorker: true,
  validate: validateStripeSecretKey,
});

export const STRIPE_PUBLISHABLE_KEY = new Secret({
  name: 'STRIPE_PUBLISHABLE_KEY',
  hint: 'Stripe publishable key (pk_live_… or pk_test_…)',
  optional: true,
  validate: validateStripePublishableKey,
});
