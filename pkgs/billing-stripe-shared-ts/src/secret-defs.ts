import type { MembershipProviderSecretDef } from '@pkgs/billing-root-shared-ts/provider-module';

import { StripeSecretKeys } from './secret-keys';

type ValidateInput = Parameters<MembershipProviderSecretDef['validate']>[0];

function requireNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${label} must be non-empty`);
  }
}

export async function validateStripeSecretKeyValue(
  input: ValidateInput
): Promise<void> {
  const v = input.secretValue.trim();
  requireNonEmpty(v, StripeSecretKeys.secretKey);
  if (!v.startsWith('sk_live_') && !v.startsWith('sk_test_')) {
    throw new Error('Must start with sk_live_ or sk_test_');
  }
  try {
    const res = await input.fetch(
      'https://api.stripe.com/v1/products?limit=1',
      {
        headers: { Authorization: `Bearer ${v}` },
      }
    );
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

export async function validateStripePublishableKeyValue(
  input: ValidateInput
): Promise<void> {
  const v = input.secretValue.trim();
  requireNonEmpty(v, StripeSecretKeys.publishableKey);
  if (!v.startsWith('pk_live_') && !v.startsWith('pk_test_')) {
    throw new Error('Must start with pk_live_ or pk_test_');
  }
}

export function validateStripeWebhookSecretValue(
  input: ValidateInput
): Promise<void> {
  const v = input.secretValue.trim();
  requireNonEmpty(v, StripeSecretKeys.webhookSecret);
  if (!v.startsWith('whsec_')) {
    throw new Error('Must start with whsec_');
  }
  return Promise.resolve();
}

/**
 * Secret definitions for the deployment's registry. All optional, like every
 * provider's: a deployment bills through Stripe only when
 * `STRIPE_SECRET_KEY` is set.
 */
export const billingStripeSecretDefs: readonly MembershipProviderSecretDef[] = [
  {
    name: StripeSecretKeys.secretKey,
    hint: 'Stripe secret API key (sk_live_… or sk_test_…) — Dashboard → Developers → API keys',
    optional: true,
    pushToApiWorker: true,
    validate: validateStripeSecretKeyValue,
  },
  {
    name: StripeSecretKeys.publishableKey,
    hint: 'Stripe publishable key (pk_live_… or pk_test_…)',
    optional: true,
    pushToApiWorker: false,
    validate: validateStripePublishableKeyValue,
  },
  {
    name: StripeSecretKeys.webhookSecret,
    hint: 'Stripe webhook signing secret (whsec_…) — Dashboard → Developers → Webhooks',
    optional: true,
    pushToApiWorker: true,
    validate: validateStripeWebhookSecretValue,
  },
];
