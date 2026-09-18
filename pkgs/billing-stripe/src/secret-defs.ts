import { StripeSecretKeys } from './secret-keys';

export type BillingStripeSecretValidateInput = {
  readonly secretValue: string;
  readonly fetch: (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response>;
};

export type BillingStripeSecretDef = {
  readonly name: string;
  readonly hint: string;
  readonly optional?: boolean;
  readonly pushToApiWorker?: boolean;
  validate(input: BillingStripeSecretValidateInput): Promise<void>;
};

function requireNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${label} must be non-empty`);
  }
}

export async function validateStripeSecretKeyValue(
  input: BillingStripeSecretValidateInput
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
  input: BillingStripeSecretValidateInput
): Promise<void> {
  const v = input.secretValue.trim();
  requireNonEmpty(v, StripeSecretKeys.publishableKey);
  if (!v.startsWith('pk_live_') && !v.startsWith('pk_test_')) {
    throw new Error('Must start with pk_live_ or pk_test_');
  }
}

export function validateStripeWebhookSecretValue(
  input: BillingStripeSecretValidateInput
): Promise<void> {
  const v = input.secretValue.trim();
  requireNonEmpty(v, StripeSecretKeys.webhookSecret);
  if (!v.startsWith('whsec_')) {
    throw new Error('Must start with whsec_');
  }
  return Promise.resolve();
}

/**
 * Secret definitions for the infra registry. Callers wrap these with their
 * `Secret` class and inject `fetch` into `validate`.
 */
export const billingStripeSecretDefs: readonly BillingStripeSecretDef[] = [
  {
    name: StripeSecretKeys.secretKey,
    hint: 'Stripe secret API key (sk_live_… or sk_test_…) — Dashboard → Developers → API keys',
    pushToApiWorker: true,
    validate: validateStripeSecretKeyValue,
  },
  {
    name: StripeSecretKeys.publishableKey,
    hint: 'Stripe publishable key (pk_live_… or pk_test_…)',
    optional: true,
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
