import {
  SYNC_PERFORMANCE_TARGETS,
  SYNC_TARGET_METRIC,
} from '@pkgs/observability-root-shared-ts/metric-contract';
import { STANDARD_BURN_TIERS } from '@pkgs/openslo-shared-ts/alert-policy';
import { logsPath, tracesPath } from './alert-links';
import type { AlertRule } from './alert-rule';
import { ruleKey } from './alert-rule';
import { emittedMetric } from './emitted-metrics';
import { README_URL } from './slo-alerts';

type Target = (typeof SYNC_PERFORMANCE_TARGETS)[number];
type TargetQueries = ReturnType<typeof targetQueries>;
type AlertKind = {
  readonly name: string;
  readonly critical: boolean;
  readonly expression: (queries: TargetQueries) => string;
};

function targetQueries(target: Target, metric: string) {
  const cohort =
    target.stage === 'database' || target.stage === 'delivery'
      ? 'server'
      : 'foreground';
  const selector = `deployment_environment_name="__ENVIRONMENT__",app_sync_target="${target.id}",app_sync_cohort="${cohort}"`;
  const total = (window: string) =>
    `sum(increase(${metric}{${selector},app_outcome!="unknown"}[${window}]))`;
  const bad = (window: string) =>
    `(sum(increase(${metric}{${selector},app_outcome="bad"}[${window}])) or vector(0))`;
  return {
    target: target.id,
    total,
    bad,
    burn: (window: string) =>
      `(${bad(window)} / ${total(window)} / ${1 - target.share})`,
    unknown: `sum(increase(${metric}{${selector},app_outcome="unknown"}[30m])) > 0`,
  };
}

function rule(kind: AlertKind, expr: string): AlertRule {
  const name = `sync-target-${kind.name}`;
  return {
    key: ruleKey(name),
    name,
    expr,
    for: '2m',
    severity: kind.critical ? 'critical' : 'warning',
    owner: 'sync-engine',
    slo: '',
    tier: '0',
    route: kind.critical ? 'page' : 'push',
    capability: 'sync-engine',
    covers: '',
    slice_label: 'app_sync_target',
    summary:
      'Sync diagnostic target {{ index $labels "app_sync_target" }} violation. Inspect environment, build and workload before inferring population performance.',
    runbook_url: `${README_URL.split('#')[0]}#sync-performance-targets`,
    investigate_command: 'bun obs slow --source prod --since 1h',
    logs_path: logsPath('1h'),
    traces_path: tracesPath('1h'),
    budget_spent: '',
    burn_threshold: 0,
    budget_expr: '',
  };
}

export function syncPerformanceAlerts(): readonly AlertRule[] {
  const series = emittedMetric(SYNC_TARGET_METRIC.name).series;
  if (series.kind !== 'counter')
    throw new Error('Sync target metric must be a counter');
  const targets = SYNC_PERFORMANCE_TARGETS.map((target) =>
    targetQueries(target, series.total)
  );
  const kinds: readonly AlertKind[] = [
    ...STANDARD_BURN_TIERS.map(
      (tier): AlertKind => ({
        name: tier.name,
        critical: tier.severity === 'page',
        expression: (queries) =>
          `(${queries.burn(tier.longWindow)} >= ${tier.factor}) and (${queries.burn(tier.shortWindow)} >= ${tier.factor}) and (${queries.total(tier.shortWindow)} >= 20)`,
      })
    ),
    {
      name: 'uncertain-evidence',
      critical: false,
      expression: (queries) => queries.unknown,
    },
    {
      name: 'low-traffic',
      critical: false,
      expression: (queries) =>
        `${queries.bad('30m')} >= 3 and ${queries.total('30m')} < 20`,
    },
  ];
  return kinds.map((kind) =>
    rule(
      kind,
      targets
        .map(
          (queries) =>
            `label_replace((${kind.expression(queries)}), "app_sync_target", "${queries.target}", "", "")`
        )
        .join(' or ')
    )
  );
}
