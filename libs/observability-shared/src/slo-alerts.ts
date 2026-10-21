/**
 * What an alert on an objective carries, and how it reaches a person.
 *
 * Two paths run the same standard policies (`@pkgs/openslo-shared`'s
 * `standardAlerts`), generated from each objective's own target:
 *
 * - the hourly Health job evaluates them against the metrics backend and
 *   fails when one fires (`alertingBinding`), so it works with no dashboard
 *   service at all;
 * - Grafana evaluates the rules generated into `alert-rules.generated.json`
 *   (`slo-alert-rules`) whenever its instance is active.
 */

import type { AlertBundle } from '@pkgs/openslo-shared/alert-policy';
import { standardAlerts } from '@pkgs/openslo-shared/alert-policy';
import type {
  AlertNotificationTarget,
  OpenSloDoc,
  Slo,
} from '@pkgs/openslo-shared/model';
import type { AlertingBinding } from '@pkgs/openslo-shared/registry';
import { parseDuration } from '@pkgs/openslo-shared/window';
import type { MetricIndicator } from './slo-indicators';
import { indicatorFor } from './slo-indicators';

/** Where the team reads how objectives and their alerts work. */
export const RUNBOOK_URL =
  'https://github.com/crvouga/gamezilla/blob/main/libs/observability-shared/README.md#service-level-objectives';

/** How far back `bun obs` can usefully look: Tempo keeps three days. */
const LONGEST_INVESTIGATION = '3d';

/** The places an alert goes. Every policy tells all of them. */
export const ALERT_TARGETS: readonly AlertNotificationTarget[] = [
  {
    name: 'health-job-failure',
    displayName: null,
    description:
      'The hourly Health run fails its objectives job, and GitHub notifies the people watching the repository. Works with no dashboard service.',
    target: 'github-actions',
  },
  {
    name: 'grafana-notification-policy',
    displayName: null,
    description:
      "Grafana raises the alert through the stack's existing notification policy while its instance is active.",
    target: 'grafana',
  },
];

/** The exact command that starts investigating an alert looking back `lookback`. */
export function investigationCommand(input: {
  readonly indicator: MetricIndicator;
  readonly lookback: string;
}): string {
  const asked = parseDuration(input.lookback) ?? 0;
  const longest = parseDuration(LONGEST_INVESTIGATION) ?? 0;
  const since = asked > longest ? LONGEST_INVESTIGATION : input.lookback;
  return `bun obs ${input.indicator.investigate} --since ${since} --source prod`;
}

/** The SLO's metric indicator, or why it has none. */
function metricIndicatorOf(slo: Slo): MetricIndicator {
  const indicator = indicatorFor(slo.indicator);
  if (indicator === undefined || indicator.kind === 'health-job-history') {
    throw new Error(
      `observability: SLO ${slo.name} has no metric indicator in the catalog (SLI ${slo.indicator})`
    );
  }
  return indicator;
}

/** Alerting for a binding whose SLIs are all in the catalog. */
export function alertingBinding(): AlertingBinding {
  return {
    minimumEventsPerHour: (slo) => metricIndicatorOf(slo).minimumEventsPerHour,
    respond: ({ slo, lookbackWindow }) => {
      const indicator = metricIndicatorOf(slo);
      return {
        owner: indicator.owner,
        runbook: RUNBOOK_URL,
        command: investigationCommand({ indicator, lookback: lookbackWindow }),
      };
    },
  };
}

/** The SLOs of these files that the metrics measure, in file order. */
export function metricBackedSlos(docs: readonly OpenSloDoc[]): readonly Slo[] {
  return docs
    .flatMap((doc) => doc.slos)
    .filter((slo) => {
      const indicator = indicatorFor(slo.indicator);
      return indicator !== undefined && indicator.kind !== 'health-job-history';
    });
}

/** Every standard policy of every metric-backed SLO, with the shared targets. */
export function sloAlertBundle(docs: readonly OpenSloDoc[]): AlertBundle {
  const bundles = metricBackedSlos(docs).map((slo) =>
    standardAlerts({ slo, targets: ALERT_TARGETS })
  );
  return {
    conditions: bundles.flatMap((b) => b.conditions),
    policies: bundles.flatMap((b) => b.policies),
    targets: ALERT_TARGETS,
  };
}
