/** jose re-exports, so tests verify tokens the way a relying party would. */
import { createLocalJWKSet, type JSONWebKeySet, jwtVerify } from 'jose';

export { jwtVerify };

export function createJWKSSet(raw: { readonly keys: unknown[] }) {
  return createLocalJWKSet(raw as unknown as JSONWebKeySet);
}
