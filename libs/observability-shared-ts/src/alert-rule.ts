/**
 * One alert rule as `alert-rules.generated.json` holds it for OpenTofu, and
 * the identity every generator gives a rule. Shared by the objectives'
 * rules (`slo-alert-rules`), their companions (`companion-alerts`) and the
 * pipeline's (`pipeline-alerts`).
 */

import type { Route } from './slo-alerts';

export type AlertRule = {
  /** Stable identity; becomes the rule's uid (with the environment). */
  readonly key: string;
  readonly name: string;
  readonly expr: string;
  /** How long the expression must hold before the alert fires. */
  readonly for: string;
  readonly severity: 'critical' | 'warning';
  readonly owner: string;
  /** The objective this defends, or empty for companion and pipeline rules. */
  readonly slo: string;
  /** The objective's tier (`0`, `1`, `2`), or empty when it defends none. */
  readonly tier: string;
  /** Who is told and how: `page`, `push` or `digest`. */
  readonly route: Route;
  /** The capability (the objective's service), or `pipeline`. */
  readonly capability: string;
  /**
   * The objectives a companion rule speaks for, comma-separated; empty
   * otherwise. Text, not a list, so the file is stable under the formatter.
   */
  readonly covers: string;
  /**
   * The label the expression is split by (one alert per route group, check
   * or probe), or empty when it yields one series.
   */
  readonly slice_label: string;
  readonly summary: string;
  readonly runbook_url: string;
  readonly investigate_command: string;
  /** Path on the Grafana instance: Explore, scoped to the environment's error logs. */
  readonly logs_path: string;
  /** Path on the Grafana instance: Explore, scoped to the environment's error traces. */
  readonly traces_path: string;
  /** For an objective: the share of its window's budget this burn spends. */
  readonly budget_spent: string;
  /** For an objective: the burn rate that fires it, in times too fast. */
  readonly burn_threshold: number;
  /** For an objective: PromQL for the budget still left over its window. */
  readonly budget_expr: string;
};

/** Short enough to fit a Grafana uid (40 characters) beside an environment name. */
export function ruleKey(policyName: string): string {
  let hash = 0x811c9dc5;
  for (const char of policyName) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  }
  return `slo-${hash.toString(16).padStart(8, '0')}`;
}

/** `0.214` → `21.4%`. */
export function percent(share: number): string {
  return `${String(Math.round(share * 1000) / 10)}%`;
}
