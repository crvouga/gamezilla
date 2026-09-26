/**
 * The secrets the OpenTofu foundation stack asserts (`human`) or writes
 * (`generated`, `derived`, `bootstrap`) in every environment's secret store.
 * `@libs/secrets` checks its registry against this list.
 */
import secretNames from '../../tofu/stacks/foundation/secrets.json';

export type FoundationSecretNames = {
  readonly human: readonly string[];
  readonly generated: readonly string[];
  readonly derived: readonly string[];
  readonly bootstrap: readonly string[];
};

export const FOUNDATION_SECRETS: FoundationSecretNames = secretNames;
