/**
 * Pure matching primitives for the SQL adapter's app-layer match pass.
 */

import type { AttributeState } from '@pkgs/attribute';
import {
  DEFAULT_RADIUS_OPTIONS,
  type FormulaWire,
  type RadiusOptions,
} from '@pkgs/matchmaking/interface';
export function expandingRadius(
  joinedAtMs: number,
  nowMs: number,
  radius: RadiusOptions
): number {
  const waitSec = Math.max((nowMs - joinedAtMs) / 1000, 0);
  return Math.min(
    radius.baseRadius + waitSec * radius.radiusGrowthPerSecond,
    radius.maxRadius
  );
}

function formulaRadius(
  formula: FormulaWire,
  waitSec: number,
  globalRadius: number
): number {
  const r = formula.radius;
  if (r === undefined) return globalRadius;
  const base = r.baseRadius ?? 0;
  const growth = r.radiusGrowthPerSecond ?? 0;
  const max = r.maxRadius ?? base;
  return Math.min(base + Math.max(waitSec, 0) * growth, max);
}

function pairCompatible(
  a: AttributeState,
  b: AttributeState,
  partition: FormulaWire['partition']
): boolean {
  if (partition === undefined) return true;
  for (const term of partition) {
    const av = a[term.path as keyof typeof a];
    const bv = b[term.path as keyof typeof b];
    if (av !== bv) return false;
  }
  return true;
}

export function pairDistance(
  a: AttributeState,
  b: AttributeState,
  formula: FormulaWire
): number {
  let d = 0;
  for (const term of formula.numeric) {
    const av = a[term.path as keyof typeof a];
    const bv = b[term.path as keyof typeof b];
    if (typeof av !== 'number' || typeof bv !== 'number') {
      throw new Error(
        `matchmaking_pair_distance: missing numeric attr ${term.path}`
      );
    }
    d += term.weight * Math.abs(av - bv);
  }
  for (const term of formula.categorical ?? []) {
    const av = a[term.path as keyof typeof a];
    const bv = b[term.path as keyof typeof b];
    if (av !== bv) d += term.penalty;
  }
  return d;
}

type PairSide = {
  readonly data: AttributeState;
  readonly formulas: readonly FormulaWire[];
  readonly joinedAtMs: number;
};

export type PairMatchArgs = {
  readonly a: PairSide;
  readonly b: PairSide;
  readonly nowMs: number;
  readonly globalRadius: RadiusOptions;
};

export function pairMatch(args: PairMatchArgs): boolean {
  const { a, b, nowMs, globalRadius } = args;
  if (a.formulas.length === 0 || b.formulas.length === 0) return false;
  const aWait = Math.max((nowMs - a.joinedAtMs) / 1000, 0);
  const bWait = Math.max((nowMs - b.joinedAtMs) / 1000, 0);
  const aGlobal = expandingRadius(a.joinedAtMs, nowMs, globalRadius);
  const bGlobal = expandingRadius(b.joinedAtMs, nowMs, globalRadius);
  for (const fa of a.formulas) {
    for (const fb of b.formulas) {
      if (!pairCompatible(a.data, b.data, fa.partition)) continue;
      if (!pairCompatible(a.data, b.data, fb.partition)) continue;
      const ra = formulaRadius(fa, aWait, aGlobal);
      const rb = formulaRadius(fb, bWait, bGlobal);
      if (
        pairDistance(a.data, b.data, fa) <= ra &&
        pairDistance(a.data, b.data, fb) <= rb
      ) {
        return true;
      }
    }
  }
  return false;
}

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
