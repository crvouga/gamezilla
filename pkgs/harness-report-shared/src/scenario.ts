import type { ReportStep } from '@pkgs/harness-root-shared/report-types';

const GHERKIN = new Set(['given', 'when', 'then', 'and', 'but', '*']);

export type ScenarioLine = {
  readonly step: ReportStep;
  /** Nested harness steps: the actions taken while this line ran. */
  readonly actions: readonly ReportStep[];
};

export function isGherkinStep(step: ReportStep): boolean {
  return GHERKIN.has(step.kind.trim().toLowerCase());
}

/** Title with the keyword removed, so the script can show the keyword once. */
export function gherkinText(step: ReportStep): string {
  const kind = step.kind.trim();
  const title = step.title.trim();
  if (title.toLowerCase().startsWith(kind.toLowerCase())) {
    return title.slice(kind.length).trim();
  }
  return title;
}

function walkActions(steps: readonly ReportStep[], out: ReportStep[]): void {
  for (const step of steps) {
    out.push(step);
    if (step.steps.length > 0) walkActions(step.steps, out);
  }
}

/**
 * Top-level Gherkin lines and the actions nested under each. Null when the
 * run is not a scenario (a model check, a property), so the step tree is
 * the action log instead.
 */
export function scenarioScript(
  steps: readonly ReportStep[]
): readonly ScenarioLine[] | null {
  const lines = steps.filter(isGherkinStep);
  if (lines.length === 0) return null;
  return lines.map((step) => {
    const actions: ReportStep[] = [];
    walkActions(step.steps, actions);
    return { step, actions };
  });
}
