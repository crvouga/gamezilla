/**
 * The spec check, pure over parsed features and statically extracted step
 * definitions. Fails on: undefined / ambiguous / pending steps, unused
 * definitions, UI mechanics or implementation words in step text, a narrator
 * ("I", "the user") instead of a named person, a scenario with no outcome, a
 * `Given` after the scenario has acted, missing or foreign `@domain`, and
 * duplicate scenario names. Near-duplicate wording (`similarity.ts`) and
 * softer BDD smells (`smells.ts`) are reported separately as warnings.
 */

import {
  CucumberExpression,
  type ParameterTypeRegistry,
} from '@cucumber/cucumber-expressions';
import type { ExtractedStep } from './extract';
import type { SpecFeature } from './parse';
import { domainOf } from './tags';

export type PackageSpecs = {
  /** Workspace name, e.g. `@libs/friends`. */
  readonly name: string;
  /**
   * The `specs/<domain>/` directories this package runs. A scenario carries
   * the `@domain` of the directory its feature lives in.
   */
  readonly domains: readonly string[];
  readonly features: readonly SpecFeature[];
  /** Definitions in this package's own `tests/steps/**`. */
  readonly definitions: readonly ExtractedStep[];
  /** Step files of other packages this package's steps entry imports. */
  readonly imports: readonly string[];
  /**
   * False when the package's steps entry does not register the shared
   * harness steps (a `pkgs/*` package never imports `libs/`), so they are not
   * defined for it at run time. Absent means true.
   */
  readonly sharedSteps?: boolean;
};

export type SpecCheckInput = {
  /** Operator terms explicitly declared by maintenance contexts, keyed by domain. */
  readonly allowedImplementationWords?: ReadonlyMap<string, readonly string[]>;
  readonly packages: readonly PackageSpecs[];
  /** The shared harness definitions, seen by packages that register them. */
  readonly shared: readonly ExtractedStep[];
  /** Definitions in imported step files whose owner is not a spec package. */
  readonly external?: readonly ExtractedStep[];
  readonly parameterTypes: ParameterTypeRegistry;
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

/**
 * Words that name how the product is built — storage, transport, hosting,
 * vendors, internals — rather than what it does. A spec must read the same
 * after any rewrite of the implementation.
 */
export const IMPLEMENTATION_WORDS = [
  'api',
  'apis',
  'bucket',
  'cache',
  'cached',
  'callback',
  'callbacks',
  'certificate',
  'column',
  'columns',
  'cookie',
  'cookies',
  'cors',
  'credential',
  'credentials',
  'database',
  'databases',
  'dns',
  'emqx',
  'endpoint',
  'endpoints',
  'env var',
  'grafana',
  'header',
  'headers',
  'http',
  'https',
  'indexeddb',
  'json',
  'localstorage',
  'migration',
  'migrations',
  'mqtt',
  'oauth',
  'opentofu',
  'otlp',
  'postgres',
  'redirect',
  'redirects',
  'schema',
  'secret store',
  'service worker',
  'sql',
  'sqlite',
  'tempo',
  'terraform',
  'tls',
  'token',
  'tokens',
  'webhook',
  'webhooks',
  'websocket',
  'websockets',
  'worker',
  'workers',
  'wss',
] as const;

/**
 * A narrator instead of a person. Scenarios name who acts — a persona
 * ("Alice") or a role ("a guest") — never "I" or an anonymous "the user".
 */
const NARRATOR = /\b(I|I'm|I've|me|my|mine)\b|\bthe users?\b/;

const IMPLEMENTATION = new RegExp(
  `\\b(${IMPLEMENTATION_WORDS.join('|')})\\b`,
  'i'
);

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
    (compiled.owner === 'shared' && pkg.sharedSteps !== false) ||
    compiled.owner === pkg.name ||
    pkg.imports.includes(compiled.step.file)
  );
}

/** `@domain` values a feature at `uri` (`specs/<domain>/<name>.feature`) may carry. */
export function allowedDomains(
  pkg: PackageSpecs,
  uri: string
): readonly string[] {
  const dir = /^specs\/([a-z0-9-]+)\/[^/]+\.feature$/.exec(uri)?.[1];
  return dir === undefined ? pkg.domains : [dir];
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
        `${where}: @domain:${domain} but the feature lives in ${feature.uri} (expected @domain:${allowed.join(' or @domain:')})`
      );
    }
  }
}

function checkScenarioShape(feature: SpecFeature, errors: string[]): void {
  for (const scenario of feature.scenarios) {
    const where = `${feature.uri}:${String(scenario.line)}: scenario "${scenario.name}"`;
    if (!scenario.steps.some((step) => step.type === 'Outcome')) {
      errors.push(`${where} has no Then; every scenario states an outcome`);
    }
    let acted = false;
    for (const step of scenario.steps) {
      if (step.type === 'Action' || step.type === 'Outcome') acted = true;
      else if (step.type === 'Context' && acted) {
        errors.push(
          `${feature.uri}:${String(step.line)}: Given "${step.text}" comes after the scenario acted; context goes first (or split the scenario)`
        );
      }
    }
  }
}

function checkStepWording(
  feature: SpecFeature,
  errors: string[],
  allowedWords: readonly string[]
): void {
  const allowed = new Set(allowedWords.map((word) => word.toLowerCase()));
  for (const scenario of feature.scenarios) {
    for (const step of scenario.steps) {
      const narrator = NARRATOR.exec(step.text);
      if (narrator !== null) {
        errors.push(
          `${feature.uri}:${String(step.line)}: step "${step.text}" is narrated ("${narrator[0]}"); name the person (Alice, a guest) instead`
        );
      }
      const hit = MECHANICS.exec(step.text);
      if (hit !== null) {
        errors.push(
          `${feature.uri}:${String(step.line)}: step "${step.text}" describes UI mechanics ("${hit[1] ?? ''}"); say the intent instead`
        );
      }
      const leak = [
        ...step.text.matchAll(new RegExp(IMPLEMENTATION, 'gi')),
      ].find((match) => !allowed.has(match[1]!.toLowerCase()));
      if (leak !== undefined) {
        errors.push(
          `${feature.uri}:${String(step.line)}: step "${step.text}" names implementation ("${leak[1] ?? ''}"); say the product behavior instead`
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
      checkScenarioTags(pkg, feature, errors);
      checkStepWording(
        feature,
        errors,
        input.allowedImplementationWords?.get(
          allowedDomains(pkg, feature.uri)[0] ?? ''
        ) ?? []
      );
      checkScenarioShape(feature, errors);
    }
  }
  checkUnused(compiled, used, errors);
  return errors;
}
