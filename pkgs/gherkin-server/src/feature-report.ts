import type { ScenarioContext } from '@pkgs/gherkin-shared/registry';
import type { RunReportOptions } from '@pkgs/harness-root-shared/report-types';
import { RunReporter } from '@pkgs/harness-root-shared/reporter';

/** Worlds with their own recorder retain their UI frames and nested measurements. */
export function createFeatureReporter(
  ctx: ScenarioContext,
  options: RunReportOptions | undefined,
  hasRecorder: boolean
): RunReporter | null {
  if (hasRecorder || options === undefined || options.enabled === false)
    return null;
  return new RunReporter({
    system: ctx.packageName,
    runtime: 'gherkin',
    seed: ctx.testId,
    options: {
      ...options,
      testId: ctx.testId,
      title: `${ctx.featureName}: ${ctx.scenarioName}`,
      sourceFile: ctx.featureUri,
      sourceLine: ctx.scenarioLine,
    },
    snapshots: [],
    surface: null,
    sessionNow: () => 0,
  });
}
