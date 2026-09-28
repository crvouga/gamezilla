/**
 * The cases an implementation is checked on (strategy § 5, "Generated
 * cases"): every listed value of every input, crossed with boundary
 * representatives of every number input — its domain's min and max, 0 and 1
 * when in the domain, and L-1, L, L+1 for every threshold L a rule of that
 * input compares against. Each case carries the reference answer.
 */

import {
  type DecisionInput,
  type Evaluation,
  evaluateDecision,
} from './evaluate';
import type { FeelValue } from './feel';
import type { DmnDecision } from './model';
import { thresholds } from './partition';

export type DecisionCase = {
  /** Stable: `tier=guest/capability=game.play/plays today=20`. */
  readonly id: string;
  readonly input: DecisionInput;
  /** The reference answer (an error when the table has none). */
  readonly expected: Evaluation;
};

/** The values input `index` is checked at, in domain order. */
export function caseValues(decision: DmnDecision, index: number): FeelValue[] {
  const domain = decision.inputs[index]?.domain;
  if (domain === undefined) return [];
  if (domain.kind === 'values') return [...domain.values];
  const picks = new Set<number>([domain.min, domain.max, 0, 1]);
  for (const t of thresholds(decision, index)) {
    const near = Number.isInteger(t)
      ? [t - 1, t, t + 1]
      : [Math.floor(t), Math.ceil(t)];
    for (const value of near) picks.add(value);
  }
  return [...picks]
    .filter((v) => v >= domain.min && v <= domain.max)
    .sort((a, b) => a - b);
}

/** Every case, inputs varying last-input-fastest. */
export function generateCases(decision: DmnDecision): DecisionCase[] {
  let inputs: Record<string, FeelValue>[] = [{}];
  decision.inputs.forEach((column, i) => {
    const values = caseValues(decision, i);
    inputs = inputs.flatMap((partial) =>
      values.map((value) => ({ ...partial, [column.name]: value }))
    );
  });
  return inputs.map((input) => ({
    id: caseId(input),
    input,
    expected: evaluateDecision(decision, input),
  }));
}

/** `tier=guest/plays today=20` — strings bare, in input order. */
export function caseId(input: DecisionInput): string {
  const parts = Object.entries(input).map(
    ([name, value]) => `${name}=${String(value)}`
  );
  return parts.length === 0 ? '-' : parts.join('/');
}
