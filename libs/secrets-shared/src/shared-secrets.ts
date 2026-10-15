import { FOUNDATION_SECRETS } from '@libs/infra-shared/foundation-secrets';
import { GLOBAL } from '@libs/infra-shared/global';

/**
 * The secrets environment holding account-wide credentials once; every
 * environment imports it (libs/infra-shared/tofu/stacks/fleet).
 */
export const SHARED_SECRETS_ENV: string = GLOBAL.infisical.shared_env;

/**
 * Account-wide secrets: entered once (`shared`) or written once by bootstrap
 * (`bootstrap`), always in {@link SHARED_SECRETS_ENV}. A copy in an
 * environment would shadow the import.
 */
export const SHARED_SECRET_NAMES: readonly string[] = [
  ...FOUNDATION_SECRETS.shared,
  ...FOUNDATION_SECRETS.shared_derived,
  ...FOUNDATION_SECRETS.bootstrap,
];

export function isSharedSecret(name: string): boolean {
  return SHARED_SECRET_NAMES.includes(name);
}
