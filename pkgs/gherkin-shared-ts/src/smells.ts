/**
 * BDD smells: patterns that usually mean a scenario is a script, a bundle of
 * rules, or a test of internals rather than one example of one behavior.
 * Unlike the spec check these are judgment calls, so they are warnings; the
 * caller decides whether to fail on them (`spec:verify --strict-smells`).
 */

import type { SpecFeature, SpecScenario } from './parse';
import { domainOf } from './tags';

export type SmellOptions = {
  /** More steps than this and the scenario is probably a script. */
  readonly maxSteps: number;
  /** More `When`s than this and the scenario is probably several rules. */
  readonly maxActions: number;
  /**
   * Domains whose scenarios are journeys: a `When` after a `Then` is the
   * journey itself there, not a bundle of rules.
   */
  readonly journeyDomains: ReadonlySet<string>;
  /**
   * Words that are usually architecture rather than behavior but can be
   * legitimate product language, so they warn instead of fail.
   */
  readonly suspectWords: readonly string[];
};

function scenarioSmells(
  feature: SpecFeature,
  scenario: SpecScenario,
  opts: SmellOptions,
  suspect: RegExp | null
): string[] {
  const where = `${feature.uri}:${String(scenario.line)}: scenario "${scenario.name}"`;
  const smells: string[] = [];
  const types = scenario.steps.map((step) => step.type);
  if (scenario.steps.length > opts.maxSteps) {
    smells.push(
      `${where} has ${String(scenario.steps.length)} steps (over ${String(opts.maxSteps)}); lift the steps to intent or split it`
    );
  }
  const actions = types.filter((type) => type === 'Action').length;
  if (actions > opts.maxActions) {
    smells.push(
      `${where} has ${String(actions)} When steps (over ${String(opts.maxActions)}); one event per scenario`
    );
  }
  const domain = domainOf(scenario.tags);
  const journey = domain !== null && opts.journeyDomains.has(domain);
  const chained = types.some(
    (type, i) => i > 0 && type === 'Action' && types[i - 1] === 'Outcome'
  );
  if (chained && !journey) {
    smells.push(
      `${where} acts again after a Then; that is usually one scenario per rule`
    );
  }
  if (suspect !== null) {
    for (const step of scenario.steps) {
      const hit = suspect.exec(step.text);
      if (hit !== null) {
        smells.push(
          `${feature.uri}:${String(step.line)}: step "${step.text}" mentions "${hit[1] ?? ''}"; say what a person observes instead`
        );
      }
    }
  }
  return smells;
}

/**
 * Every smell in `features`, deterministic order, each once (an outline's
 * rows share their steps' smells).
 */
export function specSmells(
  features: readonly SpecFeature[],
  opts: SmellOptions
): readonly string[] {
  const suspect =
    opts.suspectWords.length === 0
      ? null
      : new RegExp(`\\b(${opts.suspectWords.join('|')})\\b`, 'i');
  const smells: string[] = [];
  for (const feature of features) {
    if (feature.description.trim() === '') {
      smells.push(
        `${feature.uri}: feature "${feature.name}" has no description; say why the capability matters`
      );
    }
    for (const scenario of feature.scenarios) {
      smells.push(...scenarioSmells(feature, scenario, opts, suspect));
    }
  }
  return [...new Set(smells)];
}
