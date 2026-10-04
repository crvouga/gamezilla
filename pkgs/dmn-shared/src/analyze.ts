/**
 * Static validity of a decision table over its declared domain (strategy
 * § 4.1): is it complete — does every input combination get an answer — and
 * is it consistent — does no combination get two?
 *
 * The walk goes input by input over the classes of {@link inputClasses},
 * carrying the rules that still match, and stops as soon as the answer below
 * is settled (no rule left: a gap for every value below; fewer than two
 * rules: no overlap below). Each finding names a concrete witness input and
 * the region it stands for (`-` for inputs that do not matter).
 */

import type { DecisionInput } from './evaluate';
import { ruleOutput } from './evaluate';
import type { FeelValue } from './feel';
import { matches } from './feel';
import type { DmnDecision, DmnRule } from './model';
import type { InputClass } from './partition';
import { inputClasses } from './partition';

/** Input name → the class or value it covers, `-` for any. */
export type Region = Readonly<Record<string, string>>;

export type Gap = {
  /** A concrete input no rule answers. */
  readonly input: DecisionInput;
  readonly region: Region;
};

export type Overlap = {
  /** A concrete input more than one rule answers. */
  readonly input: DecisionInput;
  readonly region: Region;
  /** The rules that all match it. */
  readonly rules: readonly string[];
};

type Verdict = 'report' | 'prune' | 'descend';

type Explore = {
  readonly decision: DmnDecision;
  readonly classes: readonly (readonly InputClass[])[];
  /** What to do with a region, given the rules matching it. */
  readonly judge: (rules: readonly DmnRule[], complete: boolean) => Verdict;
  readonly report: (
    picks: readonly InputClass[],
    rules: readonly DmnRule[]
  ) => void;
};

/** Input combinations no rule matches (the table is incomplete). */
export function gaps(decision: DmnDecision): Gap[] {
  const found: Gap[] = [];
  explore(decision, {
    judge: (rules, complete) =>
      rules.length === 0 ? 'report' : complete ? 'prune' : 'descend',
    report: (picks) => found.push(witness(decision, picks)),
  });
  return found;
}

/**
 * Input combinations answered more than once where the hit policy forbids
 * it: under UNIQUE any two matching rules; under ANY two matching rules that
 * answer differently. FIRST and PRIORITY resolve overlaps by design.
 */
export function overlaps(decision: DmnDecision): Overlap[] {
  if (decision.hitPolicy === 'FIRST' || decision.hitPolicy === 'PRIORITY') {
    return [];
  }
  const settled =
    decision.hitPolicy === 'ANY'
      ? (rules: readonly DmnRule[]) => agree(decision, rules)
      : (rules: readonly DmnRule[]) => rules.length < 2;
  const found: Overlap[] = [];
  explore(decision, {
    judge: (rules, complete) =>
      settled(rules) ? 'prune' : complete ? 'report' : 'descend',
    report: (picks, rules) =>
      found.push({
        ...witness(decision, picks),
        rules: rules.map((r) => r.id),
      }),
  });
  return found;
}

function explore(
  decision: DmnDecision,
  handlers: Pick<Explore, 'judge' | 'report'>
): void {
  const classes = decision.inputs.map((_, i) => inputClasses(decision, i));
  visit({ decision, classes, ...handlers }, [], decision.rules);
}

function visit(
  walk: Explore,
  picks: readonly InputClass[],
  rules: readonly DmnRule[]
): void {
  const depth = picks.length;
  const complete = depth === walk.classes.length;
  const verdict = walk.judge(rules, complete);
  if (verdict === 'report') walk.report(picks, rules);
  if (verdict !== 'descend') return;
  for (const option of walk.classes[depth] ?? []) {
    const still = rules.filter((rule) => {
      const test = rule.inputEntries[depth];
      return test !== undefined && matches(test, option.value);
    });
    visit(walk, [...picks, option], still);
  }
}

function witness(
  decision: DmnDecision,
  picks: readonly InputClass[]
): { input: DecisionInput; region: Region } {
  const input: Record<string, FeelValue> = {};
  const region: Record<string, string> = {};
  decision.inputs.forEach((column, i) => {
    const pick = picks[i];
    const fallback = inputClasses(decision, i)[0];
    input[column.name] = (pick ?? fallback)?.value ?? null;
    region[column.name] = pick?.label ?? '-';
  });
  return { input, region };
}

function agree(decision: DmnDecision, rules: readonly DmnRule[]): boolean {
  const answers = new Set(
    rules.map((rule) => JSON.stringify(ruleOutput(decision, rule)))
  );
  return answers.size <= 1;
}
