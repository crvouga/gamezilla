import { metrics } from '@opentelemetry/api';
import { ATTR } from './attributes';

export const METRIC_DIMENSION_KEYS = [
  ATTR.DEPLOYMENT_ENVIRONMENT_NAME,
  'telemetry.outcome',
  'app.outcome',
  'app.sync.stage',
  'app.sync.cohort',
  'app.sync.target',
  'http.request.method',
  'app.http.status_class',
  'app.http.route_group',
  'app.mutation.outcome',
  'error.type',
  'game.mode',
  'app.room.module',
  'app.room.outcome',
  'web_vital.name',
  'app.synthetic.check',
] as const;

/**
 * Where the SDK cuts every histogram, in the instrument's own unit (seconds
 * for durations). A latency objective can only count "at most X" when X is
 * one of these, so the runtime and the objectives read the same list.
 */
export const HISTOGRAM_BOUNDARIES: readonly number[] = [
  0, 0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10,
  25, 50, 75, 100, 250, 500, 750, 1000, 2500, 5000, 7500, 10000,
];

/** The most label combinations one instrument may produce. */
export const SERIES_BUDGET = 256;

export type MetricContract = {
  readonly name: string;
  readonly description: string;
  readonly unit: string;
  /**
   * A gauge is one reading per sample (a probe's 1 or 0), read by counting
   * and summing its samples over a window rather than by `increase`.
   */
  readonly type: 'counter' | 'histogram' | 'gauge';
  /** Finite vocabularies only; identifiers can never become metric labels. */
  readonly dimensions: Readonly<Record<string, readonly string[]>>;
  /**
   * Stamp every point with the runtime's `deployment.environment.name`, so an
   * alert selects the environment on the series itself. A Worker isolate's
   * resource information goes stale shortly after the isolate ends, so a
   * resource join loses whatever an ended isolate counted.
   */
  readonly environmentScoped?: boolean;
};

const DIMENSION_VALUE = /^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,63}$/;
let metricEnvironment = 'local';

/**
 * The environment `environmentScoped` metrics report. The telemetry runtime
 * that installs the global meter provider sets it once; a name a label cannot
 * carry reports as `unknown` rather than failing the runtime's boot.
 */
export function setMetricEnvironment(environment: string): void {
  metricEnvironment = DIMENSION_VALUE.test(environment)
    ? environment
    : 'unknown';
}

export function createMetric(contract: MetricContract) {
  for (const [key, values] of Object.entries(contract.dimensions)) {
    if (
      !METRIC_DIMENSION_KEYS.includes(
        key as (typeof METRIC_DIMENSION_KEYS)[number]
      ) ||
      values.some((value) => !DIMENSION_VALUE.test(value)) ||
      new Set(values).size !== values.length
    )
      throw new Error(
        'Metric dimensions require an approved finite vocabulary'
      );
  }
  const combinations = Object.values(contract.dimensions).reduce(
    (total, values) => total * values.length,
    1
  );
  if (combinations < 1 || combinations > SERIES_BUDGET)
    throw new Error('Metric dimensions exceed the series budget');
  const meter = metrics.getMeter('@pkgs/observability');
  const instrument =
    contract.type === 'counter'
      ? meter.createCounter(contract.name, contract)
      : contract.type === 'gauge'
        ? meter.createGauge(contract.name, contract)
        : meter.createHistogram(contract.name, contract);
  return (
    value: number,
    attributes: Readonly<Record<string, string>>
  ): boolean => {
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      !validDimensions(contract, attributes)
    )
      return false;
    const stamped =
      contract.environmentScoped === true
        ? {
            ...attributes,
            [ATTR.DEPLOYMENT_ENVIRONMENT_NAME]: metricEnvironment,
          }
        : attributes;
    try {
      if ('add' in instrument) instrument.add(value, stamped);
      else instrument.record(value, stamped);
      return true;
    } catch {
      return false;
    }
  };
}

function validDimensions(
  contract: MetricContract,
  attributes: Readonly<Record<string, string>>
): boolean {
  return (
    Object.keys(attributes).length ===
      Object.keys(contract.dimensions).length &&
    Object.entries(attributes).every(
      ([key, value]) => contract.dimensions[key]?.includes(value) === true
    )
  );
}

/** Proposed engineering targets, not measurements or claims of compliance. */
export const SYNC_PERFORMANCE_TARGETS = [
  { id: 'local-write-fast', stage: 'local-write', ms: 50, share: 0.95 },
  { id: 'local-write-tail', stage: 'local-write', ms: 100, share: 0.99 },
  { id: 'read-fast', stage: 'read', ms: 300, share: 0.95 },
  { id: 'read-tail', stage: 'read', ms: 750, share: 0.99 },
  { id: 'read-deadline', stage: 'read', ms: 2000, share: 0.999 },
  { id: 'write-fast', stage: 'write', ms: 300, share: 0.95 },
  { id: 'write-tail', stage: 'write', ms: 750, share: 0.99 },
  { id: 'write-deadline', stage: 'write', ms: 2000, share: 0.999 },
  { id: 'peer-fast', stage: 'peer', ms: 200, share: 0.95 },
  { id: 'peer-tail', stage: 'peer', ms: 1000, share: 0.99 },
  { id: 'reconnect-fast', stage: 'reconnect', ms: 2000, share: 0.95 },
  { id: 'reconnect-tail', stage: 'reconnect', ms: 5000, share: 0.99 },
  { id: 'database-fast', stage: 'database', ms: 25, share: 0.95 },
  { id: 'database-tail', stage: 'database', ms: 100, share: 0.99 },
  { id: 'delivery-fast', stage: 'delivery', ms: 250, share: 0.95 },
  { id: 'delivery-tail', stage: 'delivery', ms: 1000, share: 0.99 },
] as const;

export const SYNC_PERFORMANCE_STAGES = [
  'local-write',
  'read',
  'write',
  'peer',
  'reconnect',
  'database',
  'delivery',
  'merge',
  'queue',
  'validate',
  'rebase',
  'hash',
  'sort',
  'encode',
  'digest',
  'notify',
  'transport',
  'schema',
  'outbox-materialize',
  'outbox-claim',
  'outbox-commit',
] as const;
export type SyncPerformanceStage = (typeof SYNC_PERFORMANCE_STAGES)[number];
export const SYNC_TARGET_WINDOW = '28d';

export const SYNC_COHORTS = [
  'foreground',
  'background',
  'synthetic',
  'server',
  'unknown',
] as const;
export type SyncCohort = (typeof SYNC_COHORTS)[number];
export type MeasurementTimers = {
  readonly setTimeout: (run: () => void, ms: number) => unknown;
  readonly clearTimeout: (handle: unknown) => void;
};
type RecordMetric = (
  value: number,
  dimensions: Readonly<Record<string, string>>
) => boolean;

/** An unfinished operation consumes its target budget at the deadline, exactly once. */
export function startSyncMeasurement(args: {
  readonly stage: SyncPerformanceStage;
  readonly cohort: SyncCohort;
  readonly now: () => number;
  readonly timers?: MeasurementTimers;
  readonly duration: RecordMetric;
  readonly target: RecordMetric;
  readonly elapsedBeforeStartMs?: number;
}): (success: boolean) => void {
  const alreadyElapsed = args.elapsedBeforeStartMs ?? 0;
  const start = args.now() - alreadyElapsed;
  const targets = SYNC_PERFORMANCE_TARGETS.filter(
    (target) => target.stage === args.stage
  );
  let settled = false;
  let finished = false;
  const recordTargets = (success: boolean, elapsed: number) => {
    if (settled) return;
    settled = true;
    for (const target of targets)
      args.target(1, {
        'app.sync.target': target.id,
        'app.sync.cohort': args.cohort,
        'app.outcome':
          !Number.isFinite(elapsed) || elapsed < 0
            ? 'unknown'
            : success && elapsed <= target.ms
              ? 'good'
              : 'bad',
      });
  };
  const deadline = Math.max(0, ...targets.map((target) => target.ms));
  if (deadline > 0 && alreadyElapsed > deadline)
    recordTargets(false, alreadyElapsed);
  const timer =
    deadline > 0 && !settled
      ? args.timers?.setTimeout(
          () => recordTargets(false, deadline),
          Math.max(0, deadline - alreadyElapsed)
        )
      : undefined;
  return (success) => {
    if (finished) return;
    finished = true;
    if (timer !== undefined) args.timers?.clearTimeout(timer);
    const elapsed = args.now() - start;
    recordTargets(success, elapsed);
    if (!Number.isFinite(elapsed) || elapsed < 0) return;
    args.duration(elapsed / 1000, {
      'app.sync.stage': args.stage,
      'app.sync.cohort': args.cohort,
      'app.outcome': success ? 'success' : 'failure',
    });
  };
}

export const SYNC_DURATION_METRIC: MetricContract = {
  name: 'sync.work.duration',
  description: 'Monotonic duration of completed sync work',
  type: 'histogram',
  unit: 's',
  environmentScoped: true,
  dimensions: {
    'app.sync.stage': SYNC_PERFORMANCE_STAGES,
    'app.sync.cohort': SYNC_COHORTS,
    'app.outcome': ['success', 'failure'],
  },
};
export const SYNC_TARGET_METRIC: MetricContract = {
  name: 'sync.work.target',
  description:
    'Operations judged at completion or deadline; unknown evidence never counts as good',
  type: 'counter',
  unit: '{operation}',
  environmentScoped: true,
  dimensions: {
    'app.sync.target': SYNC_PERFORMANCE_TARGETS.map((t) => t.id),
    'app.sync.cohort': SYNC_COHORTS,
    'app.outcome': ['good', 'bad', 'unknown'],
  },
};
export const SYNC_STARTED_METRIC: MetricContract = {
  name: 'sync.work.started',
  description:
    'Started sync operations, including operations without a terminal result',
  type: 'counter',
  unit: '{operation}',
  environmentScoped: true,
  dimensions: { 'app.sync.stage': SYNC_PERFORMANCE_STAGES },
};

/** Install only at a telemetry composition root with an injected monotonic clock. */
let recorder: ReturnType<typeof createRecorder> | undefined;
type MeasurementOptions = {
  readonly timers?: MeasurementTimers;
  readonly cohort?: () => SyncCohort;
};
function createRecorder(now: () => number, options: MeasurementOptions) {
  const duration = createMetric(SYNC_DURATION_METRIC);
  const target = createMetric(SYNC_TARGET_METRIC);
  const started = createMetric(SYNC_STARTED_METRIC);
  const pending = new Set<(success: boolean) => void>();
  let closed = false;
  const unknown = (
    stage: SyncPerformanceStage,
    cohort = options.cohort?.() ?? 'unknown'
  ) => {
    if (closed) return;
    started(1, { 'app.sync.stage': stage });
    for (const value of SYNC_PERFORMANCE_TARGETS.filter(
      (value) => value.stage === stage
    ))
      target(1, {
        'app.sync.target': value.id,
        'app.sync.cohort': cohort,
        'app.outcome': 'unknown',
      });
  };
  const begin = (
    stage: SyncPerformanceStage,
    elapsedBeforeStartMs = 0,
    cohort = options.cohort?.() ?? 'unknown'
  ) => {
    if (closed) return () => undefined;
    if (!Number.isFinite(elapsedBeforeStartMs) || elapsedBeforeStartMs < 0) {
      unknown(stage, cohort);
      return () => undefined;
    }
    started(1, { 'app.sync.stage': stage });
    const complete = startSyncMeasurement({
      stage,
      cohort,
      elapsedBeforeStartMs,
      now,
      duration,
      target,
      ...(options.timers === undefined ? {} : { timers: options.timers }),
    });
    const finish = (success: boolean) => {
      pending.delete(finish);
      complete(success);
    };
    pending.add(finish);
    return finish;
  };
  return {
    begin,
    unknown,
    capture: () => {
      const start = now();
      const cohort = options.cohort?.() ?? 'unknown';
      return (stage: SyncPerformanceStage) =>
        begin(stage, now() - start, cohort);
    },
    dispose: () => {
      closed = true;
      for (const finish of pending) finish(false);
    },
  };
}
export function installSyncPerformance(
  now: () => number,
  options: MeasurementOptions = {}
): () => void {
  const installed = createRecorder(now, options);
  recorder = installed;
  return () => {
    if (recorder === installed) recorder = undefined;
    installed.dispose();
  };
}
export function beginSyncMeasurement(
  stage: SyncPerformanceStage,
  elapsedBeforeStartMs = 0
): (success: boolean) => void {
  return recorder?.begin(stage, elapsedBeforeStartMs) ?? (() => undefined);
}

/** Capture before asynchronous workload qualification, retaining the original cohort. */
export function captureSyncMeasurement(): (
  stage: SyncPerformanceStage
) => (success: boolean) => void {
  return recorder?.capture() ?? (() => () => undefined);
}
/** Missing provenance or clock evidence must never become a good SLO observation. */
export function recordUnknownSyncMeasurement(
  stage: SyncPerformanceStage
): void {
  recorder?.unknown(stage);
}

/** Optional observers must not add database work when telemetry is disabled. */
export function syncPerformanceEnabled(): boolean {
  return recorder !== undefined;
}
