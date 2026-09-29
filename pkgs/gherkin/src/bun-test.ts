/**
 * Run a feature under `bun test`: one `describe` per feature, one `test` per
 * scenario, the registered world opened before and disposed after each.
 *
 * The runner-generated stub (`.cache/spec/<name>.feature.test.ts`) imports the
 * package's steps entry, reads the feature, and calls {@link runFeature}.
 * Given a `reportDir`, every scenario that passes or fails is recorded as
 * behavior evidence (`./evidence`).
 */

import { describe, test } from 'bun:test';
import type { Layer } from '@pkgs/conformance/evidence';
import { recordScenario } from './evidence';
import {
  formatScenarioFailure,
  type StepOutcome,
  undefinedStepSnippet,
} from './failure';
import { parseFeature, type SpecScenario, type SpecStep } from './parse';
import {
  isHostLimit,
  matchStep,
  type ScenarioContext,
  type StepMatch,
  worldLifecycle,
} from './registry';
import { tagFilter } from './tags';

export type RunFeatureOptions = {
  readonly packageName: string;
  /** Feature path as reported (package-relative). */
  readonly featureUri: string;
  /** Tag expression; scenarios outside it are not registered. */
  readonly tags?: string | undefined;
  /**
   * Scenario names this host cannot run; they are not registered. The host
   * decides this beside its bindings — a spec never names where it runs.
   */
  readonly skip?: readonly string[] | undefined;
  /**
   * Register only every `count`-th scenario from `index` (feature order), so
   * one long feature can run as several test files in parallel. Every slice
   * of a feature together registers each scenario exactly once.
   */
  readonly slice?: Slice | undefined;
  /** Per-scenario timeout; default is `bun test --timeout`. */
  readonly timeoutMs?: number | undefined;
  readonly reportHint?: string | undefined;
  /** Report bucket to record each decided scenario's evidence in. */
  readonly reportDir?: string | undefined;
  /**
   * The layer a passing scenario proves: `system` (default, the harness) or
   * `release` (a live run against a deployment).
   */
  readonly layer?: Layer | undefined;
};

export type Slice = { readonly index: number; readonly count: number };

export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function outcome(step: SpecStep, status: StepOutcome['status']): StepOutcome {
  return { keyword: step.keyword, text: step.text, line: step.line, status };
}

function definitionText(match: StepMatch, step: SpecStep): string {
  if (match.kind === 'match') return match.definition.location;
  if (match.kind === 'undefined') {
    return `none — undefined step. Add to tests/steps/:\n${undefinedStepSnippet(step.keyword, step.text)}`;
  }
  return `ambiguous — ${match.definitions.map((d) => `${d.text} (${d.location})`).join(' | ')}`;
}

async function runStep(
  world: unknown,
  match: StepMatch,
  step: SpecStep
): Promise<void> {
  if (match.kind === 'undefined') {
    throw new Error(`undefined step: ${step.keyword} ${step.text}`);
  }
  if (match.kind === 'ambiguous') {
    throw new Error(`ambiguous step: ${step.keyword} ${step.text}`);
  }
  const extra: unknown[] = [];
  if (step.docString !== undefined) extra.push(step.docString);
  if (step.dataTable !== undefined) extra.push(step.dataTable);
  await match.definition.body(world, ...match.args, ...extra);
}

type ScenarioRun = {
  readonly options: RunFeatureOptions;
  readonly featureName: string;
  readonly scenario: SpecScenario;
};

/** Runs the scenario; false when a host limit ended it undecided. */
async function runScenario(run: ScenarioRun): Promise<boolean> {
  const { options, scenario } = run;
  const lifecycle = worldLifecycle();
  const ctx: ScenarioContext = {
    packageName: options.packageName,
    featureUri: options.featureUri,
    featureName: run.featureName,
    scenarioName: scenario.name,
    scenarioLine: scenario.line,
    tags: scenario.tags,
    testId: `${slug(options.featureUri.replace(/^.*\//, '').replace(/\.feature$/, ''))}.${slug(scenario.name)}`,
  };
  const world = await lifecycle.create(ctx);
  const outcomes: StepOutcome[] = [];
  try {
    for (const [index, step] of scenario.steps.entries()) {
      const match = matchStep(step.text);
      const callsBefore = lifecycle.calls?.(world).length ?? 0;
      try {
        const run = () => runStep(world, match, step);
        await (lifecycle.record === undefined
          ? run()
          : lifecycle.record(world, step, run));
        outcomes.push(outcome(step, 'passed'));
      } catch (cause) {
        if (isHostLimit(cause)) {
          const skipped = scenario.steps.length - index - 1;
          console.warn(
            `${options.featureUri}:${String(step.line)} ${scenario.name}: ${(cause as Error).message} — ${String(skipped)} later step(s) skipped`
          );
          return false;
        }
        await lifecycle.failed?.(world, cause).catch((error: unknown) => {
          console.warn(
            `${options.featureUri}:${String(step.line)} ${scenario.name}: capturing failure evidence failed: ${String(error)}`
          );
        });
        const failing = outcome(step, 'failed');
        const rest = scenario.steps
          .slice(index + 1)
          .map((s) => outcome(s, 'skipped'));
        throw new Error(
          formatScenarioFailure({
            packageName: options.packageName,
            featureUri: options.featureUri,
            featureName: run.featureName,
            scenarioName: scenario.name,
            scenarioLine: scenario.line,
            steps: [...outcomes, failing, ...rest],
            failingStep: failing,
            definition: definitionText(match, step),
            calls: (lifecycle.calls?.(world) ?? []).slice(callsBefore),
            cause,
            reportHint: options.reportHint ?? 'report: /reports/<commit sha>, published by bun check',
          }),
          { cause }
        );
      }
    }
  } finally {
    await lifecycle.dispose(world);
  }
  return true;
}

/**
 * The scenario's test body: run it and, with a `reportDir`, record its
 * verdict. A scenario a host limit cut short proved nothing and records
 * nothing, like one the host skips.
 */
async function scenarioTest(run: ScenarioRun, source: string): Promise<void> {
  const { options } = run;
  const record = (status: 'pass' | 'fail', detail?: string) => {
    if (options.reportDir === undefined) return;
    recordScenario({
      reportDir: options.reportDir,
      packageName: options.packageName,
      featureUri: options.featureUri,
      featureSource: source,
      layer: options.layer ?? 'system',
      scenarioName: run.scenario.name,
      status,
      detail,
    });
  };
  let completed: boolean;
  try {
    completed = await runScenario(run);
  } catch (cause) {
    record('fail', failureDetail(cause));
    throw cause;
  }
  if (completed) record('pass');
}

/** The first line of what broke: the step's own error, not the report around it. */
function failureDetail(error: unknown): string {
  const inner =
    error instanceof Error && error.cause !== undefined ? error.cause : error;
  const text = inner instanceof Error ? inner.message : String(inner);
  return text.split('\n')[0] ?? text;
}

/** Register the feature's scenarios with `bun test`. Call at module top level. */
export function runFeature(source: string, options: RunFeatureOptions): void {
  const feature = parseFeature(source, options.featureUri);
  const selected = tagFilter(options.tags ?? process.env['SPEC_TAGS']);
  const skipped = new Set(options.skip ?? []);
  const slice = options.slice ?? { index: 0, count: 1 };
  describe(feature.name, () => {
    for (const [ordinal, scenario] of feature.scenarios.entries()) {
      if (ordinal % slice.count !== slice.index) continue;
      if (!selected(scenario.tags) || skipped.has(scenario.name)) continue;
      const body = () =>
        scenarioTest({ options, featureName: feature.name, scenario }, source);
      if (options.timeoutMs === undefined) {
        test(scenario.name, body);
      } else {
        test(scenario.name, body, options.timeoutMs);
      }
    }
  });
}
