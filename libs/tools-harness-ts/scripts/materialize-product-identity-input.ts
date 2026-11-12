import { identityInput } from '@libs/product-brand-shared-ts/identity-input';
import fixture from '@libs/product-identity/fixtures/verification-identity.json' with {
  type: 'json',
};
import { parseProductIdentity } from '@libs/product-identity-shared-ts/identity-schema';

/** Only build tooling chooses the offline verification fixture. */
export function materializedIdentity(
  raw: string | undefined,
  fixtureMode: boolean
) {
  return fixtureMode ? parseProductIdentity(fixture) : identityInput(raw);
}
