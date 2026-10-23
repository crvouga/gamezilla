/**
 * An OpenSLO v1 objective file as the engine reads it: its indicators (SLIs)
 * and objectives (SLOs) and, when it declares them, their alert policies,
 * conditions and notification targets, validated and normalised by `parse`.
 * Metric sources stay opaque product words — the engine never interprets a
 * query; a product adapter measures each indicator.
 */

/** Where a metric comes from, in the product's words. Opaque to the engine. */
export type MetricSource = {
  readonly type: string;
  readonly spec: Readonly<Record<string, unknown>>;
};

/** Good (or bad) events over all events. */
export type RatioMetric = {
  readonly kind: 'ratio';
  readonly counter: boolean;
  /** Exactly one of `good` / `bad` is set. */
  readonly good: MetricSource | null;
  readonly bad: MetricSource | null;
  readonly total: MetricSource;
};

/** One value per sample (a latency, say), compared to each objective's `value`. */
export type ThresholdMetric = {
  readonly kind: 'threshold';
  readonly source: MetricSource;
};

export type Sli = {
  readonly name: string;
  readonly displayName: string | null;
  readonly description: string | null;
  /** Declared inside an SLO (`indicator:`) rather than as its own document. */
  readonly inline: boolean;
  readonly metric: RatioMetric | ThresholdMetric;
};

export type CalendarWindow = {
  /** `2026-01-01 00:00:00` (UTC). */
  readonly startTime: string;
  readonly timeZone: string;
};

export type TimeWindow = {
  /** `28d` — `^\d+[smhdw]$`. */
  readonly duration: string;
  readonly isRolling: boolean;
  /** Set exactly when the window is not rolling. */
  readonly calendar: CalendarWindow | null;
};

export const OPERATORS = ['lt', 'lte', 'gt', 'gte'] as const;
export type Operator = (typeof OPERATORS)[number];

export const BUDGETING_METHODS = ['Occurrences', 'Timeslices'] as const;
export type BudgetingMethod = (typeof BUDGETING_METHODS)[number];

export type Objective = {
  readonly displayName: string;
  /** A fraction in (0, 1] — `targetPercent` is divided by 100. */
  readonly target: number;
  /** Threshold indicators only: a sample is good when `value <op> this.value`. */
  readonly op: Operator | null;
  readonly value: number | null;
  /** Timeslices only: a slice is good when its own ratio reaches this. */
  readonly timeSliceTarget: number | null;
  /** Timeslices only: the slice length (`1m`). */
  readonly timeSliceWindow: string | null;
};

export type Slo = {
  readonly name: string;
  readonly displayName: string | null;
  readonly description: string | null;
  readonly service: string;
  /** The SLI's `metadata.name` (declared or inline). */
  readonly indicator: string;
  readonly timeWindow: TimeWindow;
  readonly budgetingMethod: BudgetingMethod;
  readonly objectives: readonly Objective[];
  /** `alertPolicies: [{ alertPolicyRef }]`: names of AlertPolicy documents. */
  readonly alertPolicies: readonly string[];
};

/** A burn-rate condition: the budget is spent `op` `threshold` times as fast as it lasts. */
export type AlertCondition = {
  readonly name: string;
  readonly displayName: string | null;
  readonly description: string | null;
  /** Who is told and how loudly: `page`, `ticket`, … (the product's words). */
  readonly severity: string;
  readonly op: Operator;
  /** Times faster than the SLO's whole window would last. */
  readonly threshold: number;
  /** How far back the burn rate is averaged (`1h`). */
  readonly lookbackWindow: string;
  /** How long it must hold before it fires (`5m`), when stated. */
  readonly alertAfter: string | null;
};

/** Where an alert goes (`target` names a channel in the product's words). */
export type AlertNotificationTarget = {
  readonly name: string;
  readonly displayName: string | null;
  readonly description: string | null;
  readonly target: string;
};

/**
 * Fires when every one of its conditions holds (a long window to be sure
 * the burn is real, a short one to be sure it is still happening).
 */
export type AlertPolicy = {
  readonly name: string;
  readonly displayName: string | null;
  readonly description: string | null;
  readonly alertWhenNoData: boolean;
  readonly alertWhenResolved: boolean;
  readonly alertWhenBreaching: boolean;
  /** Names of AlertCondition documents, at least one. */
  readonly conditions: readonly string[];
  /** Names of AlertNotificationTarget documents, at least one. */
  readonly notificationTargets: readonly string[];
  readonly labels: Readonly<Record<string, readonly string[]>>;
};

export type OpenSloDoc = {
  readonly slis: readonly Sli[];
  readonly slos: readonly Slo[];
  readonly alertConditions: readonly AlertCondition[];
  readonly alertPolicies: readonly AlertPolicy[];
  readonly alertNotificationTargets: readonly AlertNotificationTarget[];
};
