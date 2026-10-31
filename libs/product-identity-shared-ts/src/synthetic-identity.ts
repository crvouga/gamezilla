/**
 * A synthetic brand for rebrand tests: same namespace and external ids,
 * another name and domain. Anything that still shows the real brand under it
 * spells the brand by hand instead of reading the identity.
 */
import { PRODUCT, type ProductIdentity } from './product-identity.ts';

export function syntheticIdentity(
  identity: ProductIdentity = PRODUCT
): ProductIdentity {
  return {
    ...identity,
    brand: {
      ...identity.brand,
      name: 'Northwind Arcade',
      shortName: 'Northwind',
      domain: 'northwind.example',
      securityContact: 'mailto:security@northwind.example',
    },
  };
}
