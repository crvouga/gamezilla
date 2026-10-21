import type { MembershipProviderSecretDef } from '@pkgs/billing-root-shared-ts/provider-module';

import { PaddleSecretKeys } from './secret-keys';
import { PADDLE_LIVE_ORIGIN, PADDLE_SANDBOX_ORIGIN } from './wire';

type ValidateInput = Parameters<MembershipProviderSecretDef['validate']>[0];

const API_KEY = /^pdl_(live|sdbx)_apikey_[A-Za-z0-9_]+$/;

function requireNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${label} must be non-empty`);
  }
}

export async function validatePaddleApiKeyValue(
  input: ValidateInput
): Promise<void> {
  const v = input.secretValue.trim();
  requireNonEmpty(v, PaddleSecretKeys.apiKey);
  if (!API_KEY.test(v)) {
    throw new Error(
      'Must be a Paddle API key (pdl_live_apikey_… or pdl_sdbx_apikey_…)'
    );
  }
  const origin = v.startsWith('pdl_sdbx_')
    ? PADDLE_SANDBOX_ORIGIN
    : PADDLE_LIVE_ORIGIN;
  try {
    const res = await input.fetch(`${origin}/products?per_page=1`, {
      headers: { Authorization: `Bearer ${v}`, 'Paddle-Version': '1' },
    });
    if (!res.ok) {
      throw new Error(`Paddle API returned HTTP ${String(res.status)}`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Paddle')) throw e;
    throw new Error(
      `Paddle unreachable: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

export function validatePaddleWebhookSecretValue(
  input: ValidateInput
): Promise<void> {
  const v = input.secretValue.trim();
  requireNonEmpty(v, PaddleSecretKeys.webhookSecret);
  if (!v.startsWith('pdl_ntfset_')) {
    throw new Error('Must start with pdl_ntfset_');
  }
  return Promise.resolve();
}

export function validatePaddleCheckoutUrlValue(
  input: ValidateInput
): Promise<void> {
  const v = input.secretValue.trim();
  requireNonEmpty(v, PaddleSecretKeys.checkoutUrl);
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    throw new Error('Must be an absolute URL');
  }
  if (url.protocol !== 'https:') throw new Error('Must be an https URL');
  return Promise.resolve();
}

/**
 * Secret definitions for the infra registry. All optional: a deployment bills
 * through Paddle only when `PADDLE_API_KEY` is set.
 */
export const billingPaddleSecretDefs: readonly MembershipProviderSecretDef[] = [
  {
    name: PaddleSecretKeys.apiKey,
    hint: 'Paddle API key (pdl_live_apikey_… or pdl_sdbx_apikey_…) — Paddle → Developer tools → Authentication',
    optional: true,
    pushToApiWorker: true,
    validate: validatePaddleApiKeyValue,
  },
  {
    name: PaddleSecretKeys.webhookSecret,
    hint: 'Paddle notification destination secret (pdl_ntfset_…) — printed by billing:sync when it creates the destination',
    optional: true,
    pushToApiWorker: true,
    validate: validatePaddleWebhookSecretValue,
  },
  {
    name: PaddleSecretKeys.checkoutUrl,
    hint: 'Paddle hosted checkout link (https://pay.paddle.io/hsc_…) — Paddle → Checkout → Hosted checkouts',
    optional: true,
    pushToApiWorker: true,
    validate: validatePaddleCheckoutUrlValue,
  },
];
