/**
 * Pure matching primitives for the SQL adapter's app-layer match pass.
 */

import type { AttributeState } from '@pkgs/attribute-shared/attribute';
import { DEFAULT_RADIUS_OPTIONS } from '@pkgs/matchmaking-shared/types';
import type { RadiusOptions } from '@pkgs/matchmaking-shared/types';
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

export const PARTITION_SIGNATURE_SEPARATOR = String.fromCharCode(0x1f);

/** Non-empty signature when schema has no partitionKeys (empty string binds as NULL on some engines). */
export const GLOBAL_PARTITION_SIGNATURE = '\x1e';

export function partitionSignatureFor(
  data: AttributeState,
  partitionKeys: readonly string[]
): string {
  if (partitionKeys.length === 0) return GLOBAL_PARTITION_SIGNATURE;
  const parts: string[] = [];
  for (const key of partitionKeys) {
    const v = data[key as keyof typeof data];
    parts.push(v === undefined || v === null ? '' : String(v));
  }
  return parts.join(PARTITION_SIGNATURE_SEPARATOR);
}
