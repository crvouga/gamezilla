/**
 * The secrets the OpenTofu foundation stack asserts (`human`) or writes
 * (`generated`, `derived`, `bootstrap`) in every environment's secret store,
 * and the account-wide ones a person enters once in the shared environment
 * (`shared`; every environment imports it — stacks/fleet). `@libs/secrets`
 * checks its registry against this list. `placeholders` are the values
 * committed to git for local sidecars: a stored generated secret equal to one
 * is public and is replaced instead of adopted (`libs/infra/tests` pins them
 * to the sidecar packages' constants).
 */
import secretNames from '../tofu/stacks/foundation/secrets.json';

export type FoundationSecretNames = {
  readonly human: readonly string[];
  readonly shared: readonly string[];
  readonly generated: readonly string[];
  readonly placeholders: readonly string[];
  readonly derived: readonly string[];
  readonly bootstrap: readonly string[];
};

export const FOUNDATION_SECRETS: FoundationSecretNames = secretNames;
