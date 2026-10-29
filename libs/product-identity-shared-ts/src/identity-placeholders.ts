/**
 * `{namespace}`, `{domain}` and `{brand}` in configuration that cannot import
 * code (OpenTofu variable files, HTML shells, generated artifacts) resolve
 * here, in every language the same way: a literal replace of exactly these
 * three tokens. Any other `{…}` is left for its own owner (OpenTofu's
 * `{project}` / `{suffix}` naming patterns).
 */
import { PRODUCT, type ProductIdentity } from './product-identity.ts';

export const IDENTITY_PLACEHOLDERS = ['namespace', 'domain', 'brand'] as const;

export function resolveIdentityString(
  value: string,
  identity: ProductIdentity = PRODUCT
): string {
  return value
    .replaceAll('{namespace}', identity.technical.namespace)
    .replaceAll('{domain}', identity.brand.domain)
    .replaceAll('{brand}', identity.brand.name);
}

/** Resolves every string inside a JSON value (keys included). */
export function resolveIdentityPlaceholders<T>(
  value: T,
  identity: ProductIdentity = PRODUCT
): T {
  return walk(value, identity) as T;
}

function walk(value: unknown, identity: ProductIdentity): unknown {
  if (typeof value === 'string') return resolveIdentityString(value, identity);
  if (Array.isArray(value)) return value.map((item) => walk(item, identity));
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        resolveIdentityString(key, identity),
        walk(item, identity),
      ])
    );
  return value;
}
