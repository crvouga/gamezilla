/** Build-local identity, materialized from external configuration; never committed. */
import raw from '@libs/product-identity/product-identity.json' with {
  type: 'json',
};
import { parseProductIdentity } from './identity-schema.ts';

export {
  type ProductIdentity,
  parseProductIdentity,
  productIdentitySchema,
} from './identity-schema.ts';

export const PRODUCT = parseProductIdentity(raw);
export const PRODUCT_NAME = PRODUCT.brand.name;
export const NAMESPACE = PRODUCT.technical.namespace;
