/**
 * Wire-shaped representation of a {@link DistanceFormula}. The HTTP / RPC
 * boundary cannot carry `AttributeTag` (which holds parser functions), so
 * wire-shaped formulas reference attribute keys as plain strings. The
 * SQL-side matching helpers consume exactly this shape; everything in JS
 * that needs to cross a network or be stored as JSONB goes through here.
 */

import { assert } from '@gamezilla/lib/assert';
import type { AttributeState } from '@gamezilla/lib/attribute';
import type { DistanceFormula, RadiusOptions } from './types';

export type NumericTermWire = {
  readonly path: string;
  readonly weight: number;
};
export type CategoricalTermWire = {
  readonly path: string;
  readonly penalty: number;
};
export type PartitionTermWire = { readonly path: string };

/**
 * Per-formula expanding-radius override carried on the wire. Same shape
 * as `RadiusOptions`. When set on a formula, SQL `matchmaking_pair_match`
 * uses these values instead of the function-arg defaults; when absent,
 * the global radius applies.
 */
export type RadiusOptionsWire = {
  readonly baseRadius: number;
  readonly radiusGrowthPerSecond: number;
  readonly maxRadius: number;
};

export type FormulaWire = {
  readonly numeric: readonly NumericTermWire[];
  readonly categorical?: readonly CategoricalTermWire[];
  readonly partition?: readonly PartitionTermWire[];
  readonly radius?: RadiusOptionsWire;
};

function assertRadiusShape(
  radius: RadiusOptions | undefined,
  label: string
): void {
  if (radius === undefined) return;
  assert.ok(
    Number.isFinite(radius.baseRadius) && radius.baseRadius >= 0,
    `${label}: radius.baseRadius must be a non-negative finite number`,
    { baseRadius: radius.baseRadius }
  );
  assert.ok(
    Number.isFinite(radius.radiusGrowthPerSecond) &&
      radius.radiusGrowthPerSecond >= 0,
    `${label}: radius.radiusGrowthPerSecond must be a non-negative finite number`,
    { radiusGrowthPerSecond: radius.radiusGrowthPerSecond }
  );
  assert.ok(
    Number.isFinite(radius.maxRadius) && radius.maxRadius >= radius.baseRadius,
    `${label}: radius.maxRadius must be finite and ≥ baseRadius`,
    { maxRadius: radius.maxRadius, baseRadius: radius.baseRadius }
  );
}

export function assertFormula(formula: DistanceFormula, label: string): void {
  assert.defined(formula, `${label}: formula is required`);
  assert.array(formula.numeric, `${label}: formula.numeric must be an array`);
  const catTerms = formula.categorical ?? [];
  const partTerms = formula.partition ?? [];
  assert.ok(
    formula.numeric.length + catTerms.length + partTerms.length > 0,
    `${label}: formula must declare at least one numeric, categorical, or partition term`
  );
  for (const t of formula.numeric) {
    assert.ok(
      Number.isFinite(t.weight) && t.weight >= 0,
      `${label}: numeric weight must be a non-negative finite number`,
      { tag: t.tag.key, weight: t.weight }
    );
  }
  for (const t of catTerms) {
    assert.ok(
      Number.isFinite(t.penalty) && t.penalty >= 0,
      `${label}: categorical penalty must be a non-negative finite number`,
      { tag: t.tag.key, penalty: t.penalty }
    );
  }
  assertRadiusShape(formula.radius, label);
}

export function assertDataMatchesFormula(
  data: AttributeState,
  formula: DistanceFormula,
  label: string
): void {
  for (const t of formula.numeric) {
    const key: string = t.tag.key;
    const v = t.tag.from(data);
    assert.ok(
      typeof v === 'number' && Number.isFinite(v),
      `${label}: numeric attr ${key} must parse to a finite number`,
      { key, value: v }
    );
  }
  for (const t of formula.categorical ?? []) {
    t.tag.parse(data[t.tag.key]);
  }
  for (const t of formula.partition ?? []) {
    t.tag.parse(data[t.tag.key]);
  }
}

export function serializeFormula(formula: DistanceFormula): FormulaWire {
  const wire: FormulaWire = {
    numeric: formula.numeric.map((t) => ({
      path: t.tag.key,
      weight: t.weight,
    })),
    categorical: (formula.categorical ?? []).map((t) => ({
      path: t.tag.key,
      penalty: t.penalty,
    })),
    partition: (formula.partition ?? []).map((t) => ({
      path: t.tag.key,
    })),
  };
  if (formula.radius !== undefined) {
    return { ...wire, radius: { ...formula.radius } };
  }
  return wire;
}

export function assertWireFormula(wire: FormulaWire, label: string): void {
  assert.defined(wire, `${label}: formula required`);
  assert.array(wire.numeric, `${label}: numeric must be an array`);
  for (let i = 0; i < wire.numeric.length; i += 1) {
    const term: NumericTermWire | undefined = wire.numeric[i];
    assert.defined(term, `${label}: numeric[${String(i)}] required`);
    assert.nonEmptyString(
      term.path,
      `${label}: numeric[${String(i)}].path must be a non-empty string`
    );
    assert.ok(
      Number.isFinite(term.weight) && term.weight >= 0,
      `${label}: numeric[${String(i)}].weight must be a non-negative finite number`,
      { path: term.path, weight: term.weight }
    );
  }
  const cats = wire.categorical ?? [];
  for (let i = 0; i < cats.length; i += 1) {
    const term: CategoricalTermWire | undefined = cats[i];
    assert.defined(term, `${label}: categorical[${String(i)}] required`);
    assert.nonEmptyString(
      term.path,
      `${label}: categorical[${String(i)}].path must be a non-empty string`
    );
    assert.ok(
      Number.isFinite(term.penalty) && term.penalty >= 0,
      `${label}: categorical[${String(i)}].penalty must be a non-negative finite number`,
      { path: term.path, penalty: term.penalty }
    );
  }
  const parts = wire.partition ?? [];
  for (let i = 0; i < parts.length; i += 1) {
    const term: PartitionTermWire | undefined = parts[i];
    assert.defined(term, `${label}: partition[${String(i)}] required`);
    assert.nonEmptyString(
      term.path,
      `${label}: partition[${String(i)}].path must be a non-empty string`
    );
  }
  assert.ok(
    wire.numeric.length + cats.length + parts.length > 0,
    `${label}: formula must declare at least one numeric, categorical, or partition term`
  );
  if (wire.radius !== undefined) {
    assertRadiusShape(wire.radius, label);
  }
}
