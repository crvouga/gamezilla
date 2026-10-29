/** Mutual formula acceptance and age-dependent ranges, independent of storage. */
import type { AttributeState } from '@pkgs/attribute-shared-ts/attribute';
import type { FormulaWire } from './formula-wire';
import type { RadiusOptions } from './types';

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

/**
 * Weighted distance under one formula. A wait lacking a numeric detail the
 * formula measures is infinitely far from everyone, never an error: it
 * stays waiting and cannot block anyone else.
 */
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
      return Number.POSITIVE_INFINITY;
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

function withinRadius(distance: number, radius: number): boolean {
  return Number.isFinite(distance) && distance <= radius;
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
        withinRadius(pairDistance(a.data, b.data, fa), ra) &&
        withinRadius(pairDistance(a.data, b.data, fb), rb)
      ) {
        return true;
      }
    }
  }
  return false;
}
