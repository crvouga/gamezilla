/**
 * The spec check, pure over parsed features and statically extracted step
 * definitions. Fails on: undefined / ambiguous / pending steps, unused
 * definitions, UI mechanics in step text, missing or foreign `@domain`,
 * unknown `@goal`, a goal proven by a feature that no scenario tags, and
 * duplicate scenario names. Near-duplicate wording is `similarity.ts`,
 * reported separately as a warning.
 */

import {
  CucumberExpression,
  type ParameterTypeRegistry,
} from '@cucumber/cucumber-expressions';
import type { ExtractedStep } from './extract';
import type { SpecFeature } from './parse';
import { domainOf, goalsOf } from './tags';

export type PackageSpecs = {
  /** Workspace name, e.g. `@libs/friends`. */
  readonly name: string;
  /**
   * `@domain` value every scenario must carry (last name segment). A feature
   * under `features/<other>/` may carry `@domain:<other>` instead: a domain
   * hosted here because only this package composes it.
   */
  readonly domain: string;
  readonly features: readonly SpecFeature[];
  /** Definitions in this package's own `tests/steps/**`. */
  readonly definitions: readonly ExtractedStep[];
  /** Step files of other packages this package's steps entry imports. */
  readonly imports: readonly string[];
};

export type SpecCheckInput = {
  readonly packages: readonly PackageSpecs[];
  /** Definitions every package sees (the shared harness). */
  readonly shared: readonly ExtractedStep[];
  /** Definitions in imported step files whose owner is not a spec package. */
  readonly external?: readonly ExtractedStep[];
  readonly parameterTypes: ParameterTypeRegistry;
  /** Every goal statement id (`social:5`). */
  readonly goalIds: ReadonlySet<string>;
  /** Goal id → feature uris listed as its proofs in the goal manifest. */
  readonly goalSpecProofs: ReadonlyMap<string, readonly string[]>;
};

/** Words that describe the UI, not the intent. Steps say what, never how. */
export const MECHANICS_WORDS = [
  'tap',
  'taps',
  'tapped',
  'click',
  'clicks',
  'clicked',
  'press',
  'presses',
  'pressed',
  'button',
  'modal',
  'dialog',
  'scroll',
  'scrolls',
  'swipe',
  'swipes',
  'navigate',
  'navigates',
  'menu',
  'input',
] as const;

const MECHANICS = new RegExp(`\\b(${MECHANICS_WORDS.join('|')})\\b`, 'i');

type Compiled = {
  readonly step: ExtractedStep;
  readonly expression: CucumberExpression;
  /** `shared`, or the workspace name of the package that defines it. */
  readonly owner: string;
};

function compileAll(
  input: SpecCheckInput,
  errors: string[]
): readonly Compiled[] {
  const out: Compiled[] = [];
  const add = (step: ExtractedStep, owner: string) => {
    try {
      out.push({
        step,
        owner,
        expression: new CucumberExpression(step.text, input.parameterTypes),
      });
    } catch (cause) {
      errors.push(
        `${step.file}:${String(step.line)}: bad step expression "${step.text}": ${cause instanceof Error ? cause.message : String(cause)}`
      );
    }
  };
  for (const step of input.shared) add(step, 'shared');
  for (const step of input.external ?? []) add(step, 'external');
  for (const pkg of input.packages) {
    for (const step of pkg.definitions) add(step, pkg.name);
  }
  return out;
}

function visibleTo(pkg: PackageSpecs, compiled: Compiled): boolean {
  return (
    compiled.owner === 'shared' ||
    compiled.owner === pkg.name ||
    pkg.imports.includes(compiled.step.file)
  );
}

/** `@domain` values a feature at `uri` may carry in `pkg`. */
export function allowedDomains(
  pkg: PackageSpecs,
  uri: string
): readonly string[] {
  const hosted = /^features\/([a-z0-9-]+)\//.exec(uri)?.[1];
  return hosted === undefined ? [pkg.domain] : [pkg.domain, hosted];
}

type ScenarioStepCheck = {
  readonly pkg: PackageSpecs;
  readonly feature: SpecFeature;
  readonly compiled: readonly Compiled[];
  readonly used: Set<Compiled>;
  readonly errors: string[];
};

function checkScenarioSteps(check: ScenarioStepCheck): void {
  const { compiled, errors, feature, pkg, used } = check;
  const visible = compiled.filter((c) => visibleTo(pkg, c));
  for (const scenario of feature.scenarios) {
    for (const step of scenario.steps) {
      const where = `${feature.uri}:${String(step.line)}`;
      const matches = visible.filter(
        (c) => c.expression.match(step.text) !== null
      );
      if (matches.length === 0) {
        errors.push(`${where}: undefined step "${step.keyword} ${step.text}"`);
        continue;
      }
      if (matches.length > 1) {
        errors.push(
          `${where}: ambiguous step "${step.text}" matches ${matches
            .map(
              (m) => `"${m.step.text}" (${m.step.file}:${String(m.step.line)})`
            )
            .join(', ')}`
        );
      }
      for (const match of matches) {
        used.add(match);
        if (match.step.pending) {
          errors.push(
            `${where}: pending step "${step.text}" (${match.step.file}:${String(match.step.line)})`
          );
        }
      }
    }
  }
}

function checkScenarioTags(
  pkg: PackageSpecs,
  feature: SpecFeature,
  input: SpecCheckInput,
  errors: string[]
): void {
  const names = new Set<string>();
  for (const scenario of feature.scenarios) {
    const where = `${feature.uri}:${String(scenario.line)}`;
    if (names.has(scenario.name)) {
      errors.push(`${where}: duplicate scenario name "${scenario.name}"`);
    }
    names.add(scenario.name);
    const domain = domainOf(scenario.tags);
    const allowed = allowedDomains(pkg, feature.uri);
    if (domain === null) {
      errors.push(
        `${where}: scenario has no @domain tag (expected @domain:${allowed.join(' or @domain:')})`
      );
    } else if (!allowed.includes(domain)) {
      errors.push(
        `${where}: @domain:${domain} but the feature lives in ${pkg.name} (expected @domain:${allowed.join(' or @domain:')})`
      );
    }
    for (const goal of goalsOf(scenario.tags)) {
      if (!input.goalIds.has(goal)) {
        errors.push(
          `${where}: unknown goal @goal:${goal} (not a docs/GOAL.md statement)`
        );
      }
    }
  }
}

function checkStepWording(feature: SpecFeature, errors: string[]): void {
  for (const scenario of feature.scenarios) {
    for (const step of scenario.steps) {
      const hit = MECHANICS.exec(step.text);
      if (hit !== null) {
        errors.push(
          `${feature.uri}:${String(step.line)}: step "${step.text}" describes UI mechanics ("${hit[1] ?? ''}"); say the intent instead`
        );
      }
    }
  }
}

function checkGoalProofs(input: SpecCheckInput, errors: string[]): void {
  const taggedIn = new Map<string, Set<string>>();
  for (const pkg of input.packages) {
    for (const feature of pkg.features) {
      for (const scenario of feature.scenarios) {
        for (const goal of goalsOf(scenario.tags)) {
          const uris = taggedIn.get(goal) ?? new Set<string>();
          uris.add(feature.uri);
          taggedIn.set(goal, uris);
        }
      }
    }
  }
  for (const [goal, uris] of input.goalSpecProofs) {
    for (const uri of uris) {
      if (!taggedIn.get(goal)?.has(uri)) {
        errors.push(
          `goal ${goal}: ${uri} is listed as its proof but no scenario there is tagged @goal:${goal}`
        );
      }
    }
  }
}

function checkUnused(
  compiled: readonly Compiled[],
  used: ReadonlySet<Compiled>,
  errors: string[]
): void {
  for (const c of compiled) {
    if (!used.has(c)) {
      errors.push(
        `${c.step.file}:${String(c.step.line)}: unused step definition "${c.step.text}"`
      );
    }
  }
}

/** Every rule the specs break; empty when clean. Deterministic order. */
export function checkSpecs(input: SpecCheckInput): readonly string[] {
  const errors: string[] = [];
  const compiled = compileAll(input, errors);
  const used = new Set<Compiled>();
  for (const pkg of input.packages) {
    for (const feature of pkg.features) {
      checkScenarioSteps({ compiled, errors, feature, pkg, used });
      checkScenarioTags(pkg, feature, input, errors);
      checkStepWording(feature, errors);
    }
  }
  checkGoalProofs(input, errors);
  checkUnused(compiled, used, errors);
  return errors;
}
