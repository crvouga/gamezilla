/**
 * The alerts on the telemetry pipeline itself: whether what the server
 * reports reaches the backend and fits its contracts. They belong to the
 * same generated rule set as the objectives' alerts, so they are read from
 * the same instrument catalog and carry the same owner, severity, runbook and
 * investigation command.
 */

import {
  EXPORT_ATTEMPTS_METRIC,
  PIPELINE_HEARTBEAT_METRIC,
  SCHEMA_VIOLATIONS_METRIC,
} from '@pkgs/observability-root-shared/pipeline-metrics';
import { emittedMetric } from './emitted-metrics';
import type { AlertRule } from './slo-alert-rules';
import { RUNBOOK_URL } from './slo-alerts';
import { environmentJoin } from './slo-promql';

const ENVIRONMENT = '__ENVIRONMENT__';

function counter(name: string): string {
  const { series } = emittedMetric(name);
  if (series.kind !== 'counter') {
    throw new Error(`observability: ${name} is not a counter`);
  }
  return series.total;
}

type PipelineAlert = Pick<
  AlertRule,
  | 'key'
  | 'name'
  | 'expr'
  | 'for'
  | 'severity'
  | 'owner'
  | 'summary'
  | 'investigate_command'
>;

/** A pipeline alert is not about an objective, so it names none and spends no budget. */
function pipelineRule(alert: PipelineAlert): AlertRule {
  return {
    key: alert.key,
    name: alert.name,
    expr: alert.expr,
    for: alert.for,
    severity: alert.severity,
    owner: alert.owner,
    slo: '',
    summary: alert.summary,
    runbook_url: RUNBOOK_URL,
    investigate_command: alert.investigate_command,
    budget_spent: '',
    burn_threshold: 0,
  };
}

export const PIPELINE_ALERTS: readonly AlertRule[] = (
  [
    {
      key: 'event-export-failures',
      name: 'Reliable event exports repeatedly fail',
      expr: `sum(increase(${counter(EXPORT_ATTEMPTS_METRIC.name)}{telemetry_outcome="failure"}[15m])${environmentJoin(ENVIRONMENT)}) > 10`,
      for: '5m',
      severity: 'warning',
      owner: 'observability',
      summary:
        'Check OTLP credential scopes, ingestion responses and pending/exhausted telemetry outbox deliveries. Business operations are committed; preserve event identities when replaying.',
      investigate_command: 'bun obs last --errors --window 1h --source prod',
    },
    {
      key: 'schema-rejections',
      name: 'Telemetry contract violations',
      expr: `sum(increase(${counter(SCHEMA_VIOLATIONS_METRIC.name)}[15m])${environmentJoin(ENVIRONMENT)}) > 0`,
      for: '5m',
      severity: 'warning',
      owner: 'observability',
      summary:
        'Compare the producing release with its registered event contracts. Investigate undeclared event names, required attributes and incompatible schema versions before replaying.',
      investigate_command: 'bun obs last --errors --window 1h --source prod',
    },
    {
      key: 'pipeline-absent',
      name: 'Telemetry heartbeat is absent',
      expr: `(sum(count_over_time(${counter(PIPELINE_HEARTBEAT_METRIC.name)}{deployment_environment_name="${ENVIRONMENT}"}[15m])) or vector(0)) == bool 0`,
      for: '5m',
      severity: 'critical',
      owner: 'observability',
      summary:
        'The scheduled server heartbeat has not reached the metrics backend for fifteen minutes. Check scheduled Worker execution, OTLP authentication, metrics ingestion and the latest deployment. If the command shows traces but no beat, the metrics path is broken; if it shows nothing, read the Worker with `bun obs platform --service <worker-name>`.',
      investigate_command: 'bun obs last --window 1h --source prod',
    },
  ] satisfies readonly PipelineAlert[]
).map(pipelineRule);
