/**
 * Expected against actual (strategy § 4.2): every generated case a layer
 * governs, answered by the spec and by the layer, compared on the outputs
 * the layer can see. Exported on its own so a product package can run its
 * mutation tests — an inverted permission, a moved limit, a missing server
 * check — straight against it and require a mismatch.
 */

import type { DecisionCase } from './cases';
import type { DecisionInput, DecisionOutput } from './evaluate';
import { renderInput, renderOutput } from './evaluate';
import type { FeelValue } from './feel';
import type { DmnDecision, DmnDefinitions } from './model';
import { findDecision } from './model';
import type { DecisionBinding, DecisionLayer } from './registry';

export type Mismatch = {
  readonly caseId: string;
  readonly input: DecisionInput;
  /** The spec's answer on the observed outputs; `null` when it has none. */
  readonly expected: DecisionOutput | null;
  /** The layer's answer on the observed outputs; `null` when it threw. */
  readonly actual: DecisionOutput | null;
  readonly reason: string;
};

export type LayerComparison = {
  /** Cases the layer governs, each compared. Zero proves nothing. */
  readonly checked: number;
  readonly mismatches: readonly Mismatch[];
};

export type CompareOptions<World> = {
  readonly decision: DmnDecision;
  readonly cases: readonly DecisionCase[];
  readonly layer: DecisionLayer<World>;
  /** Handed to `decide` as `context.world`. */
  readonly world?: World;
};

/** Compare one layer with the spec on every case it governs, in order. */
export async function compareLayer<World = undefined>(
  options: CompareOptions<World>
): Promise<LayerComparison> {
  const { decision, cases, layer } = options;
  const observed = observedOutputs(decision, layer);
  let checked = 0;
  const mismatches: Mismatch[] = [];
  for (const c of cases) {
    if (layer.applies !== undefined && !layer.applies(c.input)) continue;
    checked += 1;
    const actual = await answerOf(layer, {
      input: c.input,
      context: {
        decisionId: decision.id,
        caseId: c.id,
        world: options.world as World,
      },
    });
    const mismatch = compareCase(c, { observed, actual });
    if (mismatch !== null) mismatches.push(mismatch);
  }
  return { checked, mismatches };
}

/**
 * What is wrong with a binding for this file: decisions it names that the
 * file lacks, no layers at all, a layer observing an output the decision
 * does not have.
 */
export function bindingProblems<World>(
  definitions: DmnDefinitions,
  binding: DecisionBinding<World>
): string[] {
  const problems: string[] = [];
  const ids = binding.decisions ?? definitions.decisions.map((d) => d.id);
  if (ids.length === 0) problems.push('the binding checks no decision');
  if (Object.keys(binding.layers).length === 0) {
    problems.push('the binding has no layers — bind at least one');
  }
  for (const id of ids) {
    const decision = findDecision(definitions, id);
    if (decision === undefined) {
      problems.push(`the file has no decision "${id}"`);
      continue;
    }
    for (const [name, layer] of Object.entries(binding.layers)) {
      try {
        observedOutputs(decision, layer);
      } catch (cause) {
        problems.push(`layer "${name}": ${(cause as Error).message}`);
      }
    }
  }
  return problems;
}

/** Up to `limit` mismatches as a reader-facing list. */
export function formatMismatches(
  mismatches: readonly Mismatch[],
  limit = 20
): string {
  const lines = mismatches.slice(0, limit).map((m) => {
    const expected = m.expected === null ? '(none)' : renderOutput(m.expected);
    const actual = m.actual === null ? '(none)' : renderOutput(m.actual);
    return `- ${renderInput(m.input)}\n    expected: ${expected}\n    actual:   ${actual}\n    ${m.reason}`;
  });
  const more = mismatches.length - limit;
  if (more > 0) lines.push(`… and ${String(more)} more`);
  return lines.join('\n');
}

function observedOutputs(
  decision: DmnDecision,
  layer: { readonly observes?: readonly string[] | undefined }
): readonly string[] {
  const all = decision.outputs.map((o) => o.name);
  const observed = layer.observes ?? all;
  if (observed.length === 0) throw new Error('observes no output');
  const unknown = observed.filter((name) => !all.includes(name));
  if (unknown.length > 0) {
    throw new Error(
      `observes ${unknown.map((n) => `"${n}"`).join(', ')}, which decision ${decision.id} does not output (${all.join(', ')})`
    );
  }
  return observed;
}

type Answer =
  | { readonly ok: true; readonly output: DecisionOutput }
  | { readonly ok: false; readonly error: string };

async function answerOf<World>(
  layer: DecisionLayer<World>,
  call: {
    input: DecisionInput;
    context: Parameters<DecisionLayer<World>['decide']>[1];
  }
): Promise<Answer> {
  try {
    return { ok: true, output: await layer.decide(call.input, call.context) };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

function compareCase(
  c: DecisionCase,
  at: { observed: readonly string[]; actual: Answer }
): Mismatch | null {
  const { observed, actual } = at;
  const base = { caseId: c.id, input: c.input };
  const seen = actual.ok ? pick(actual.output, observed) : null;
  if (!c.expected.ok) {
    return {
      ...base,
      expected: null,
      actual: seen,
      reason: `the spec has no answer: ${c.expected.error}`,
    };
  }
  const expected = pick(c.expected.output, observed);
  if (!actual.ok) {
    return {
      ...base,
      expected,
      actual: null,
      reason: `the layer threw: ${actual.error}`,
    };
  }
  const differing = observed.filter(
    (name) =>
      !Object.hasOwn(actual.output, name) ||
      actual.output[name] !== expected[name]
  );
  if (differing.length === 0) return null;
  return {
    ...base,
    expected,
    actual: seen,
    reason: `differs on ${differing.join(', ')}`,
  };
}

function pick(
  output: DecisionOutput,
  names: readonly string[]
): Record<string, FeelValue> {
  const picked: Record<string, FeelValue> = {};
  for (const name of names) {
    if (Object.hasOwn(output, name)) picked[name] = output[name] ?? null;
  }
  return picked;
}
