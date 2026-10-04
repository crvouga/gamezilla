/**
 * Validation helpers for join / joinRaw / updateFormulas inputs. Split
 * out of `matchmaker.ts` to keep that file under the per-file line cap.
 *
 * Every helper is `@internal` — none of these escape the package.
 */

import { assert } from '@pkgs/assert-shared/singleton';
import { assertFormula, assertWireFormula } from './formula-wire';
import type { FormulaWire } from './formula-wire';
import {
  MATCHMAKING_MAX_GROUP_SIZE,
  MATCHMAKING_MIN_GROUP_SIZE,
  MATCHMAKING_PAYLOAD_LIMITS,
} from './payload-limits';
import type { DistanceFormula } from './types';

/**
 * Hard cap on `JoinInput.formulas.length`. Bounds the SQL cost of
 * `matchmaking_pair_match` (cartesian over `a.formulas x b.formulas`)
 * and the per-row JSON TEXT width on `matchmaking_waiting`. Kept in step
 * with `MATCHMAKING_PAYLOAD_LIMITS.maxFormulas` deliberately — both
 * are the same cap surfaced at different layers.
 */
export const MAX_FORMULAS_PER_PARTICIPANT = 8;

/**
 * Caller-supplied per-row payload bundle. Threaded into
 * `Matchmaker.insertJoin` as one object so the function signature
 * stays narrow enough for Biome's `useMaxParams` cap and so adding a
 * future field doesn't ripple through every caller.
 *
 * @internal
 */
export type InsertJoinAttrs = {
  readonly groupSize: number;
  readonly metadata: Record<string, unknown> | null;
};

/**
 * Normalises and validates a caller-supplied `groupSize`. Returns the
 * integer to send to SQL. `undefined` becomes the minimum (2 — the
 * pairwise default).
 *
 * @internal
 */
export function resolveGroupSize(
  value: number | undefined,
  label: string
): number {
  if (value === undefined) return MATCHMAKING_MIN_GROUP_SIZE;
  assert.ok(Number.isInteger(value), `${label}: groupSize must be an integer`, {
    groupSize: value,
  });
  assert.ok(
    value >= MATCHMAKING_MIN_GROUP_SIZE && value <= MATCHMAKING_MAX_GROUP_SIZE,
    `${label}: groupSize must be between ${String(MATCHMAKING_MIN_GROUP_SIZE)} and ${String(MATCHMAKING_MAX_GROUP_SIZE)}`,
    { groupSize: value }
  );
  return value;
}

const METADATA_UTF8 = new TextEncoder();

/**
 * Normalises and validates a caller-supplied `metadata` blob. Returns
 * either the original object (passed straight to JSON TEXT) or `null` when
 * unset / explicitly nulled.
 *
 * @internal
 */
export function resolveMetadata(
  value: Record<string, unknown> | null | undefined,
  label: string
): Record<string, unknown> | null {
  if (value === undefined || value === null) return null;
  assert.record(value, `${label}: metadata must be a plain object or null`);
  const encoded = JSON.stringify(value);
  const bytes = METADATA_UTF8.encode(encoded).length;
  assert.ok(
    bytes <= MATCHMAKING_PAYLOAD_LIMITS.maxMetadataBytes,
    `${label}: metadata JSON must be at most ${String(MATCHMAKING_PAYLOAD_LIMITS.maxMetadataBytes)} bytes (UTF-8)`,
    { bytes }
  );
  return value;
}

/**
 * Normalises every per-row caller knob in one call. Each helper above
 * is exported separately for fine-grained reuse; this is the one the
 * `join` / `joinRaw` happy path uses.
 *
 * @internal
 */
export function resolveJoinAttrs(
  input: {
    readonly groupSize?: number;
    readonly metadata?: Record<string, unknown> | null;
  },
  label: string
): InsertJoinAttrs {
  return {
    groupSize: resolveGroupSize(input.groupSize, label),
    metadata: resolveMetadata(input.metadata, label),
  };
}

/**
 * Shared array-shape assertion for the `formulas` field on every
 * input path (`join`, `joinRaw`, `updateFormulas`, `updateFormulasRaw`).
 * Centralised so a future cap change is one edit.
 *
 * @internal
 */
function assertFormulasShape(
  formulas: readonly unknown[] | undefined,
  label: string
): asserts formulas is readonly unknown[] {
  assert.array(formulas, `${label}: formulas must be an array`);
  assert.ok(formulas.length > 0, `${label}: formulas must be non-empty`);
  assert.ok(
    formulas.length <= MAX_FORMULAS_PER_PARTICIPANT,
    `${label}: formulas must contain at most ${String(MAX_FORMULAS_PER_PARTICIPANT)} entries`,
    { count: formulas.length }
  );
}

/**
 * Validates a typed `DistanceFormula[]` (used by `join` and
 * `updateFormulas`). Walks each formula through `assertFormula`.
 *
 * @internal
 */
export function assertDistanceFormulasInput(
  formulas: readonly DistanceFormula[] | undefined,
  label: string
): asserts formulas is readonly DistanceFormula[] {
  assertFormulasShape(formulas, label);
  for (let i = 0; i < formulas.length; i += 1) {
    const itemLabel = `${label}: formulas[${String(i)}]`;
    const formula: DistanceFormula | undefined = formulas[i];
    assert.defined(formula, `${itemLabel}: formula required`);
    assertFormula(formula, itemLabel);
  }
}

/**
 * Validates a wire-shaped `FormulaWire[]` (used by `joinRaw` and
 * `updateFormulasRaw`). Walks each formula through `assertWireFormula`.
 *
 * @internal
 */
export function assertWireFormulasInput(
  formulas: readonly FormulaWire[] | undefined,
  label: string
): asserts formulas is readonly FormulaWire[] {
  assertFormulasShape(formulas, label);
  for (let i = 0; i < formulas.length; i += 1) {
    const itemLabel = `${label}: formulas[${String(i)}]`;
    const wire: FormulaWire | undefined = formulas[i];
    assert.defined(wire, `${itemLabel}: formula required`);
    assertWireFormula(wire, itemLabel);
  }
}
