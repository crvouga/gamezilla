/**
 * The reference answer: a decision table evaluated for one input, honoring
 * its hit policy. This is the oracle an implementation is compared against,
 * so it is written from the spec's semantics alone and shares nothing with
 * any product code.
 *
 * - UNIQUE: exactly one rule may match;
 * - FIRST: the first matching rule, in table order, answers;
 * - ANY: every matching rule must give the same answer;
 * - PRIORITY: the matching answer ranked highest by the outputs'
 *   `outputValues` order answers.
 *
 * An input the spec does not cover — a missing or unknown name, a value
 * outside the declared domain — is an error, never a guess.
 */

import { inDomain, renderDomain } from './domain';
import type { FeelValue } from './feel';
import { matches, renderFeelValue } from './feel';
import type { DmnDecision, DmnRule } from './model';

export type DecisionInput = Readonly<Record<string, FeelValue>>;
export type DecisionOutput = Readonly<Record<string, FeelValue>>;

export type Evaluation =
  | {
      readonly ok: true;
      readonly output: DecisionOutput;
      /** The rules that gave the answer. */
      readonly rules: readonly string[];
    }
  | { readonly ok: false; readonly error: string };

export function evaluateDecision(
  decision: DmnDecision,
  input: DecisionInput
): Evaluation {
  const invalid = inputProblem(decision, input);
  if (invalid !== null) return { ok: false, error: invalid };
  const hits = matchingRules(decision, input);
  const [first] = hits;
  if (first === undefined) {
    return { ok: false, error: `no rule answers ${renderInput(input)}` };
  }
  switch (decision.hitPolicy) {
    case 'FIRST':
      return answer(decision, [first]);
    case 'PRIORITY':
      return answer(decision, [highestPriority(decision, hits)]);
    case 'ANY':
      return anyHit(decision, { hits, input });
    default:
      return hits.length === 1
        ? answer(decision, hits)
        : {
            ok: false,
            error: `rules ${ids(hits)} all answer ${renderInput(input)} (hit policy UNIQUE allows one)`,
          };
  }
}

/** Every rule whose input entries all match, in table order. */
export function matchingRules(
  decision: DmnDecision,
  input: DecisionInput
): DmnRule[] {
  return decision.rules.filter((rule) =>
    decision.inputs.every((column, i) => {
      const test = rule.inputEntries[i];
      return test !== undefined && matches(test, input[column.name] ?? null);
    })
  );
}

/** The rule's output entries by output name. */
export function ruleOutput(
  decision: DmnDecision,
  rule: DmnRule
): DecisionOutput {
  return Object.fromEntries(
    decision.outputs.map((output, i) => [
      output.name,
      rule.outputEntries[i] ?? null,
    ])
  );
}

/** `tier="guest", plays today=20` — an input as a reader writes it. */
export function renderInput(input: DecisionInput): string {
  return Object.entries(input)
    .map(([name, value]) => `${name}=${renderFeelValue(value)}`)
    .join(', ');
}

/** `decision="deny", reason="limit reached"`. */
export function renderOutput(output: DecisionOutput): string {
  return renderInput(output);
}

function inputProblem(
  decision: DmnDecision,
  input: DecisionInput
): string | null {
  const names = new Set(decision.inputs.map((i) => i.name));
  const unknown = Object.keys(input).filter((name) => !names.has(name));
  if (unknown.length > 0) {
    return `decision ${decision.id} has no input ${unknown.map((n) => `"${n}"`).join(', ')}`;
  }
  for (const column of decision.inputs) {
    if (!Object.hasOwn(input, column.name)) {
      return `input "${column.name}" is missing`;
    }
    const value = input[column.name] ?? null;
    if (!inDomain(column.domain, value)) {
      return `${column.name}=${renderFeelValue(value)} is outside the declared values (${renderDomain(column.domain)})`;
    }
  }
  return null;
}

function answer(decision: DmnDecision, rules: readonly DmnRule[]): Evaluation {
  const [rule] = rules;
  if (rule === undefined) return { ok: false, error: 'no rule answers' };
  return {
    ok: true,
    output: ruleOutput(decision, rule),
    rules: rules.map((r) => r.id),
  };
}

function anyHit(
  decision: DmnDecision,
  at: { hits: readonly DmnRule[]; input: DecisionInput }
): Evaluation {
  const [first, ...rest] = at.hits;
  if (first === undefined) return { ok: false, error: 'no rule answers' };
  const disagreeing = rest.find(
    (rule) => !sameEntries(rule.outputEntries, first.outputEntries)
  );
  if (disagreeing !== undefined) {
    return {
      ok: false,
      error: `rules ${first.id} and ${disagreeing.id} answer ${renderInput(at.input)} differently (hit policy ANY)`,
    };
  }
  return answer(decision, at.hits);
}

function highestPriority(
  decision: DmnDecision,
  hits: readonly DmnRule[]
): DmnRule {
  const rank = (rule: DmnRule): number[] =>
    decision.outputs.map((output, i) =>
      (output.values ?? []).indexOf(rule.outputEntries[i] ?? null)
    );
  let best = hits[0] as DmnRule;
  for (const rule of hits.slice(1)) {
    if (compareRanks(rank(rule), rank(best)) < 0) best = rule;
  }
  return best;
}

function compareRanks(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < a.length; i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function sameEntries(
  a: readonly FeelValue[],
  b: readonly FeelValue[]
): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

function ids(rules: readonly DmnRule[]): string {
  return rules.map((r) => r.id).join(', ');
}
