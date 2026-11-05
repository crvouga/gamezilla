import { alertedObjective } from '@pkgs/openslo-shared-ts/alert-policy';
import type { OpenSloDoc } from '@pkgs/openslo-shared-ts/model';
import { ENVIRONMENT_PLACEHOLDER, logsPath, tracesPath } from './alert-links';
import type { AlertRule } from './alert-rule';
import { ruleKey } from './alert-rule';
import {
  investigationCommand,
  metricBackedSlos,
  metricIndicatorOf,
  runbookFor,
  tierOf,
} from './slo-alerts';
import { badCount, sliceLabel, windowQueries } from './slo-promql';

/** An invariant has no spendable budget: one observed violation pages. */
export function integrityRules(
  docs: readonly OpenSloDoc[]
): readonly AlertRule[] {
  return metricBackedSlos(docs)
    .filter((slo) => alertedObjective(slo).target === 1)
    .map((slo) => {
      const indicator = metricIndicatorOf(slo);
      const slice = sliceLabel(indicator);
      const queries = windowQueries({
        indicator,
        window: '5m',
        environment: ENVIRONMENT_PLACEHOLDER,
        by: slice,
      });
      return {
        key: ruleKey(`integrity:${slo.name}`),
        name: `${slo.displayName ?? slo.name}: integrity violation`,
        expr: `${badCount(queries)} > 0`,
        for: '0s',
        severity: 'critical',
        owner: indicator.owner,
        slo: '',
        covers: slo.name,
        tier: String(tierOf(slo)),
        route: 'page',
        capability: slo.service,
        slice_label: slice ?? '',
        summary:
          'A zero-tolerance promise was violated. Contain the affected operation and preserve evidence. There is no error budget; readiness remains breached over the objective window.',
        runbook_url: runbookFor(slo.name),
        investigate_command: investigationCommand({
          indicator,
          lookback: '5m',
        }),
        logs_path: logsPath('5m'),
        traces_path: tracesPath('5m'),
        budget_spent: '',
        burn_threshold: 0,
        budget_expr: '',
      };
    });
}
