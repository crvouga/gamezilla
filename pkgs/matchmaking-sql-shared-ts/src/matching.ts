/**
 * Pure matching primitives for the SQL adapter's app-layer match pass.
 */

import type { AttributeState } from '@pkgs/attribute-shared-ts/attribute';
import type { RadiusOptions } from '@pkgs/matchmaking-root-shared-ts/types';
import { DEFAULT_RADIUS_OPTIONS } from '@pkgs/matchmaking-root-shared-ts/types';
export function resolveGlobalRadius(
  radius: RadiusOptions | undefined
): RadiusOptions {
  return radius ?? DEFAULT_RADIUS_OPTIONS;
}

export function primaryRating(
  data: AttributeState,
  primaryNumericKey: string | undefined
): number {
  if (primaryNumericKey === undefined) return 0;
  const v = data[primaryNumericKey as keyof typeof data];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export function primaryBucket(rating: number, bucketWidth: number): number {
  return Math.floor(rating / Math.max(bucketWidth, 1));
}

/** Non-empty signature when schema has no partitionKeys (empty string binds as NULL on some engines). */
export const GLOBAL_PARTITION_SIGNATURE = '\x1e';

/**
 * One pool per tuple of partition values. The tuple is encoded as a JSON
 * array so no value, whatever characters it holds, can read as another
 * tuple; a missing value and an empty one are different values.
 */
export function partitionSignatureFor(
  data: AttributeState,
  partitionKeys: readonly string[]
): string {
  if (partitionKeys.length === 0) return GLOBAL_PARTITION_SIGNATURE;
  return JSON.stringify(
    partitionKeys.map((key) => data[key as keyof typeof data] ?? null)
  );
}
