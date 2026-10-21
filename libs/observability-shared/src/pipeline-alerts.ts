/**
 * The alerts on the telemetry pipeline itself: whether what the server
 * reports reaches the backend and fits its contracts. They belong to the
 * same generated rule set as the objectives' alerts, so they are read from
 * the same instrument catalog and carry the same owner, severity, runbook and
 * investigation command.
 */

import { BILLING_CALLBACKS_METRIC } from '@pkgs/observability-root-shared/billing-metrics';
import {
  OUTBOX_DELIVERIES_EXHAUSTED_METRIC,
  OUTBOX_DRAIN_RUNS_METRIC,
} from '@pkgs/observability-root-shared/outbox-metrics';
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

const README =
  'https://github.com/crvouga/gamezilla/blob/main/libs/observability-shared/README.md';

/**
 * Events in a window, for a counter that carries the environment on each
 * point. A Worker isolate's series starts at its first count, and a
 * short-lived isolate may report a single sample, which `increase` cannot see.
 * Growth of series that already existed plus the first value of series that
 * appeared in the window counts each event once, and the rule stays one series.
 */
function windowedCount(name: string, matchers: string, window: string): string {
  const selector = `${counter(name)}{deployment_environment_name="${ENVIRONMENT}"${matchers === '' ? '' : `,${matchers}`}}`;
  return `((sum(increase(${selector}[${window}])) or vector(0)) + (sum(min_over_time(${selector}[${window}]) unless min_over_time(${selector}[${window}] offset ${window})) or vector(0)))`;
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
> & {
  /** Its own runbook section; the objectives' section otherwise. */
  readonly runbook_url?: string;
};

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
    runbook_url: alert.runbook_url ?? RUNBOOK_URL,
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
    {
      key: 'outbox-exhausted',
      name: 'Outbox deliveries exhausted their retries',
      expr: `${windowedCount(OUTBOX_DELIVERIES_EXHAUSTED_METRIC.name, '', '1h')} > 0`,
      for: '5m',
      severity: 'warning',
      owner: 'runtime',
      summary:
        'Background work gave up after its last attempt and is parked, so its effect (a notice, an erasure, a match step) has not happened. Find the consumer and error in the logs; do not edit or delete the parked rows.',
      runbook_url: `${README}#outbox-deliveries-exhausted-their-retries`,
      investigate_command: 'bun obs last --errors --window 1h --source prod',
    },
    {
      key: 'outbox-drain-failing',
      name: 'Scheduled outbox drain keeps failing',
      expr: `${windowedCount(OUTBOX_DRAIN_RUNS_METRIC.name, 'app_outcome="failure"', '15m')} >= 3`,
      for: '5m',
      severity: 'critical',
      owner: 'runtime',
      summary:
        'The scheduled drain failed at least three times in fifteen minutes while the schedule still runs, so background work and telemetry export are stalled. Check the drain error, database reachability and the latest deployment.',
      runbook_url: `${README}#scheduled-outbox-drain-keeps-failing`,
      investigate_command: 'bun obs last --errors --window 1h --source prod',
    },
    {
      key: 'billing-callbacks-refused',
      name: 'Billing provider callbacks are being refused',
      expr: `${windowedCount(BILLING_CALLBACKS_METRIC.name, 'app_outcome=~"unverified|failed"', '1h')} >= 3`,
      for: '5m',
      severity: 'critical',
      owner: 'billing',
      summary:
        'At least three provider callbacks in an hour failed their signature check or processing, so payment and membership changes may not reach accounts. Compare the webhook signing secret with the provider and check the latest deployment; the provider retries refused deliveries.',
      runbook_url: `${README}#billing-provider-callbacks-are-being-refused`,
      investigate_command: 'bun obs last --errors --window 1h --source prod',
    },
  ] satisfies readonly PipelineAlert[]
).map(pipelineRule);
