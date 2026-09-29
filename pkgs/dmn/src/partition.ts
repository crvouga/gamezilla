/**
 * Every input's domain split into classes no rule can tell apart: each
 * listed value is its own class; a number range is cut at every threshold a
 * rule of that input compares against, so each piece is a run of whole
 * numbers on which every test of the table gives the same verdict. Checking
 * one value per class is therefore checking them all — which is what makes
 * completeness and consistency exact over a finite, small set.
 */

import {
  type FeelValue,
  numericEndpoints,
  renderFeelValue,
  type UnaryTest,
} from './feel';
import type { DmnDecision } from './model';

export type InputClass = {
  /** A value of the class (its smallest, for a number range). */
  readonly value: FeelValue;
  /** How a reader writes the class: `"guest"`, `20`, `21..1000`. */
  readonly label: string;
};

/** Every number the rules compare input `index` against, sorted, unique. */
export function thresholds(decision: DmnDecision, index: number): number[] {
  const found = new Set<number>();
  for (const rule of decision.rules) {
    const test = rule.inputEntries[index];
    if (test === undefined) continue;
    for (const value of numericEndpoints(test)) found.add(value);
  }
  return [...found].sort((a, b) => a - b);
}

/** The classes of input `index`, in domain order. */
export function inputClasses(
  decision: DmnDecision,
  index: number
): InputClass[] {
  const domain = decision.inputs[index]?.domain;
  if (domain === undefined) return [];
  if (domain.kind === 'values') {
    return domain.values.map((value) => ({
      value,
      label: renderFeelValue(value),
    }));
  }
  const starts = new Set<number>([domain.min]);
  for (const rule of decision.rules) {
    const test = rule.inputEntries[index];
    if (test === undefined) continue;
    for (const cut of cutPoints(test)) {
      if (cut > domain.min && cut <= domain.max) starts.add(cut);
    }
  }
  const sorted = [...starts].sort((a, b) => a - b);
  return sorted.map((start, i) => {
    const end = (sorted[i + 1] ?? domain.max + 1) - 1;
    return {
      value: start,
      label: start === end ? String(start) : `${String(start)}..${String(end)}`,
    };
  });
}

/**
 * The whole numbers at which `test`'s verdict can change: `< t` and `>= t`
 * change at ceil(t), `<= t` and `> t` at floor(t) + 1, `= t` at t and t + 1.
 */
function cutPoints(test: UnaryTest): number[] {
  switch (test.kind) {
    case 'equal':
      return typeof test.value === 'number' && Number.isInteger(test.value)
        ? [test.value, test.value + 1]
        : [];
    case 'compare':
      return test.op === '<' || test.op === '>='
        ? [Math.ceil(test.value)]
        : [Math.floor(test.value) + 1];
    case 'interval':
      return [
        test.lowClosed ? Math.ceil(test.low) : Math.floor(test.low) + 1,
        test.highClosed ? Math.floor(test.high) + 1 : Math.ceil(test.high),
      ];
    case 'or':
    case 'not':
      return test.tests.flatMap(cutPoints);
    default:
      return [];
  }
}
