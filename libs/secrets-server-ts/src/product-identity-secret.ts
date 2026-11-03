import { identityInput } from '@libs/product-identity-shared-ts/identity-input';
import { Secret } from '@libs/secrets-shared-ts/secret';

/** Optional Infisical override for public deployment configuration. */
export const PRODUCT_IDENTITY_JSON = new Secret({
  name: 'PRODUCT_IDENTITY_JSON',
  optional: true,
  hint: 'Validated identity JSON: brand, stable namespace and external registrations. Optional shared override for the repository variable; never commit values.',
  async validate({ secretValue }) {
    identityInput('configured', secretValue);
  },
});
