import { NAMESPACE } from '@libs/product-identity-shared-ts/product-identity';

/**
 * The address domain every Synthetic User is provisioned under. `.invalid`
 * is reserved (RFC 2606): no mail server can ever exist for it, so nothing
 * addressed here can leave the product.
 */
export const SYNTHETIC_ADDRESS_DOMAIN = `synthetic.${NAMESPACE}.invalid`;

export function syntheticAddress(userId: string): string {
  return `${userId}@${SYNTHETIC_ADDRESS_DOMAIN}`;
}

/** True only for an address the Synthetic Population Controller provisions. */
export function isSyntheticAddress(email: string): boolean {
  const address = email.trim().toLowerCase();
  const at = address.lastIndexOf('@');
  return at > 0 && address.slice(at + 1) === SYNTHETIC_ADDRESS_DOMAIN;
}
