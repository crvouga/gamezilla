/**
 * Identifiers derived from the immutable technical namespace: telemetry
 * service names, runtime and storage keys, local process and container names.
 * They never change with the brand, so dashboards, alerts, stored sessions and
 * deployed resources keep working through a rebrand.
 */
import { PRODUCT, type ProductIdentity } from './product-identity.ts';

const PART = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `<namespace>-<part>-…`: a service or resource name (`<ns>-server`). */
export function technicalName(
  parts: readonly string[],
  identity: ProductIdentity = PRODUCT
): string {
  for (const part of parts)
    if (!PART.test(part))
      throw new Error(`technical name part "${part}" is not lower-kebab-case`);
  return [identity.technical.namespace, ...parts].join('-');
}

/** `<namespace><separator><key>`: a storage, cookie or label key. */
export function technicalKey(
  key: string,
  separator: '.' | ':' | '_' = '.',
  identity: ProductIdentity = PRODUCT
): string {
  return `${identity.technical.namespace}${separator}${key}`;
}

/** OpenTelemetry `service.name` of a component (`<namespace>-server`). */
export function serviceName(
  component:
    | 'server'
    | 'client'
    | 'room-server'
    | 'synthetic-population-worker',
  identity: ProductIdentity = PRODUCT
): string {
  return technicalName([component], identity);
}
