/**
 * Public hostnames and origins under the brand's domain. A label is the part
 * before the domain (`www`, `api-dev`); none is the apex.
 */
import { PRODUCT, type ProductIdentity } from './product-identity.ts';

export function brandHost(
  label?: string,
  identity: ProductIdentity = PRODUCT
): string {
  return label === undefined || label === ''
    ? identity.brand.domain
    : `${label}.${identity.brand.domain}`;
}

export function brandOrigin(
  label?: string,
  identity: ProductIdentity = PRODUCT
): string {
  return `https://${brandHost(label, identity)}`;
}

/** The production web client's origin (`https://www.<domain>`). */
export function webOrigin(identity: ProductIdentity = PRODUCT): string {
  return brandOrigin('www', identity);
}

/** The production API's hostname (`api.<domain>`). */
export function apiHost(identity: ProductIdentity = PRODUCT): string {
  return brandHost('api', identity);
}
