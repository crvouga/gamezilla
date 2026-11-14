/**
 * The alert on the important CI workflows: a Release, Health or Verify
 * Nightly run on `main` whose latest recorded result is a failure
 * (`ci-workflow-results.ts`). One alert per workflow; it clears when that
 * workflow's next run on `main` passes. The same run files or updates the
 * workflow's GitHub issue (`libs/tools-harness-ts/scripts/ci-workflow-alert.ts`).
 */

import { logsPath, tracesPath } from './alert-links';
import type { AlertRule } from './alert-rule';
import {
  CI_WORKFLOW_DIMENSION,
  CI_WORKFLOW_METRIC,
} from './ci-workflow-results';
import { emittedMetric, labelOf } from './emitted-metrics';
import { REPOSITORY_URL } from './slo-alerts';

const ENVIRONMENT = '__ENVIRONMENT__';

/**
 * Longer than the slowest schedule (Verify Nightly, once a day), so a
 * failed night stays visible until the next night replaces it.
 */
export const CI_RESULT_LOOKBACK = '26h';

function resultSeries(): string {
  const { series } = emittedMetric(CI_WORKFLOW_METRIC.name);
  if (series.kind !== 'gauge') {
    throw new Error(`observability: ${CI_WORKFLOW_METRIC.name} is not a gauge`);
  }
  return series.value;
}

export function ciWorkflowAlerts(): readonly AlertRule[] {
  return [
    {
      key: 'ci-workflow-failing',
      name: 'An important CI workflow is failing on main',
      expr: `last_over_time(${resultSeries()}{deployment_environment_name="${ENVIRONMENT}"}[${CI_RESULT_LOOKBACK}]) < 1`,
      for: '0s',
      severity: 'critical',
      owner: 'platform',
      slo: '',
      tier: '',
      route: 'page',
      capability: 'ci',
      covers: '',
      slice_label: labelOf(CI_WORKFLOW_DIMENSION),
      summary:
        'The latest Release, Health or Verify Nightly run on main failed (the slice names the workflow). Its GitHub issue "<Workflow> is failing on main" links the run; fix the root cause on one pull request and confirm the next run on main is green.',
      runbook_url: `${REPOSITORY_URL}/libs/observability-server-ts/README.md#an-important-ci-workflow-is-failing-on-main`,
      // The workflow's GitHub issue links its run; the errors are what Health
      // and Release met in the environment.
      investigate_command: 'bun obs errors --since 26h --source prod',
      logs_path: logsPath('1h'),
      traces_path: tracesPath('1h'),
      budget_spent: '',
      burn_threshold: 0,
      budget_expr: '',
    },
  ];
}
