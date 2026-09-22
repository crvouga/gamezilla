/**
 * Every membership provider this product can bill through, in one list.
 * Composition roots — the API Worker, `billing:sync`, the secret registry —
 * iterate it and never name a provider, so adding, dropping or swapping one
 * is an edit here plus configuration. Nothing else in the product imports a
 * provider package (the `import-billing-vendor` lint rule).
 */
import {
  createMembershipProviders,
  type MembershipProviderEnv,
  type MembershipProviderModule,
  type MembershipProviders,
} from '@pkgs/billing';
import { MOCK_MEMBERSHIP_PROVIDER } from '@pkgs/billing-mock';
import { PADDLE_MEMBERSHIP_PROVIDER } from '@pkgs/billing-paddle';
import { STRIPE_MEMBERSHIP_PROVIDER } from '@pkgs/billing-stripe';
import type { SecretStore } from '@pkgs/secret-store';

export const MEMBERSHIP_PROVIDER_MODULES: readonly MembershipProviderModule[] =
  [
    STRIPE_MEMBERSHIP_PROVIDER,
    PADDLE_MEMBERSHIP_PROVIDER,
    MOCK_MEMBERSHIP_PROVIDER,
  ];

/** `MembershipProviderEnv.readSecret` over a secret store: trimmed, blank is unset. */
export function membershipSecretReader(
  secretStore: SecretStore
): MembershipProviderEnv['readSecret'] {
  return async (name) => {
    const raw = (await secretStore.getOptional(name))?.readSecretValue();
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    return trimmed.length > 0 ? trimmed : null;
  };
}

/** A module failed to build from its configuration. */
export class MembershipProviderConfigError extends Error {
  constructor(provider: string, cause: unknown) {
    super(
      `billing provider ${provider}: ${cause instanceof Error ? cause.message : String(cause)}`
    );
    this.name = 'MembershipProviderConfigError';
  }
}

/**
 * Builds every configured provider (in list order) and registers them with
 * the checkout provider `chooseCheckout` picks from their ids. `null` when
 * none is configured.
 */
export async function createConfiguredMembershipProviders(args: {
  readonly env: MembershipProviderEnv;
  readonly chooseCheckout: (configured: readonly string[]) => string | null;
  readonly modules?: readonly MembershipProviderModule[];
}): Promise<MembershipProviders | null> {
  const modules = args.modules ?? MEMBERSHIP_PROVIDER_MODULES;
  const built = await Promise.all(
    modules.map(async (module) => {
      try {
        return await module.create(args.env);
      } catch (error) {
        throw new MembershipProviderConfigError(module.provider, error);
      }
    })
  );
  const configured = built.filter((billing) => billing !== null);
  const checkout = args.chooseCheckout(configured.map((b) => b.provider));
  return checkout === null
    ? null
    : createMembershipProviders({ all: configured, checkout });
}
