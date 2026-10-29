/**
 * Agent-readable failure text for one scenario: where it lives, which step
 * broke, what the world was asked to do in that step, and the cause.
 */

export type StepOutcome = {
  readonly keyword: string;
  readonly text: string;
  readonly line: number;
  readonly status: 'passed' | 'failed' | 'skipped';
};

export type ScenarioFailure = {
  readonly packageName: string;
  readonly featureUri: string;
  readonly featureName: string;
  readonly scenarioName: string;
  readonly scenarioLine: number;
  readonly steps: readonly StepOutcome[];
  readonly failingStep: StepOutcome;
  /** `file:line` of the matched definition, or why there is none. */
  readonly definition: string;
  /** World calls made while the failing step ran, oldest first. */
  readonly calls: readonly string[];
  readonly cause: unknown;
  readonly reportHint: string;
};

function causeText(cause: unknown): string {
  if (cause instanceof Error) {
    const lines = cause.message.split('\n');
    const stackHead = (cause.stack ?? '')
      .split('\n')
      .filter((line) => line.trim().startsWith('at '))
      .slice(0, 4);
    return [...lines, ...stackHead].join('\n    ');
  }
  return String(cause);
}

const STATUS_MARK: Record<StepOutcome['status'], string> = {
  passed: '✓',
  failed: '✗',
  skipped: '-',
};

export function formatScenarioFailure(f: ScenarioFailure): string {
  const calls =
    f.calls.length === 0
      ? '    (no world calls recorded)'
      : f.calls.map((call) => `    ${call}`).join('\n');
  const steps = f.steps
    .map(
      (step) =>
        `    ${STATUS_MARK[step.status]} ${step.keyword} ${step.text}  (line ${String(step.line)})`
    )
    .join('\n');
  return [
    `scenario failed: ${f.scenarioName}`,
    `  package:   ${f.packageName}`,
    `  feature:   ${f.featureUri}:${String(f.scenarioLine)}  ${f.featureName}`,
    `  step:      ${f.failingStep.keyword} ${f.failingStep.text}  (${f.featureUri}:${String(f.failingStep.line)})`,
    `  definition: ${f.definition}`,
    '  world calls during the step:',
    calls,
    `  cause: ${causeText(f.cause)}`,
    '  steps:',
    steps,
    `  ${f.reportHint}`,
  ].join('\n');
}

/** Snippet an implementer can paste for an undefined step. */
export function undefinedStepSnippet(keyword: string, text: string): string {
  const kind = /^(given|when|then)$/i.test(keyword)
    ? keyword[0]?.toUpperCase() + keyword.slice(1).toLowerCase()
    : 'Step';
  const escaped = text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `${kind}('${escaped}', async (w) => {\n  // one harness call, then assert (Then)\n});`;
}
