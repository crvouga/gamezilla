/**
 * An OpenSLO v1 objective file as the engine reads it: its indicators (SLIs)
 * and objectives (SLOs), validated and normalised by `parse`. Metric sources
 * stay opaque product words — the engine never interprets a query; a
 * product adapter measures each indicator.
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
};

export type OpenSloDoc = {
  readonly slis: readonly Sli[];
  readonly slos: readonly Slo[];
};
