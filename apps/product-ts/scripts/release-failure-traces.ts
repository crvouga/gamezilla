import type {
  ReportStep,
  RunReport,
} from '@crvouga/atlas/reports/report-types';
import { serviceName } from '@libs/product-identity-shared-ts/technical-names';
import { readStoreJson } from '@pkgs/harness-root-shared-ts/persist';
import { readUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';
import {
  type NarrateSpan,
  narrate,
} from '@pkgs/observability-root-shared-ts/narrate';
import { NdjsonTraceStore } from '@pkgs/observability-root-shared-ts/ndjson';
import { spansFromDocument } from '@pkgs/observability-root-shared-ts/normalize';
import type {
  TimeRange,
  Trace,
} from '@pkgs/observability-root-shared-ts/types';
import {
  clientTraceEvidence,
  indexClientTraces,
} from './release-client-traces';

const MAX_FAILURES = 3;
const MAX_TRACES = 2;
const MAX_DETAIL_SPANS = 24;
const REQUEST_SPANS = ['worker.fetch', 'http.server.request'];
const REQUEST_CONTEXT = [
  ATTR.SERVICE_NAME,
  ATTR.SERVICE_INSTANCE_ID,
  ATTR.SERVICE_VERSION,
  ATTR.DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR.APP_BUILD_SHA,
  ATTR.APP_DEVICE_ID,
  ATTR.USER_ID,
];

type FailureWindow = TimeRange & { readonly testId: string };
type Candidate = { readonly traceId: string; readonly startMs: number };

function failedStepEnd(steps: readonly ReportStep[]): number | undefined {
  let first = Number.POSITIVE_INFINITY;
  const pending = [...steps];
  while (pending.length > 0) {
    const step = pending.pop()!;
    pending.push(...step.steps);
    if (step.status === 'failed' && Number.isFinite(step.endedAtMs))
      first = Math.min(first, step.endedAtMs);
  }
  return Number.isFinite(first) ? first : undefined;
}

async function failureWindows(
  reports: ObjectStore,
  run: TimeRange
): Promise<FailureWindow[]> {
  const failures: FailureWindow[] = [];
  for (const key of [...(await reports.listKeys())].sort()) {
    if (!key.endsWith('/report.json')) continue;
    const report = await readStoreJson<RunReport>(reports, key);
    const meta = report?.meta;
    if (
      meta?.status !== 'failed' ||
      !Number.isFinite(meta.startedAtMs) ||
      !Number.isFinite(meta.endedAtMs) ||
      meta.startedAtMs < run.startMs ||
      meta.endedAtMs > run.endMs ||
      !Array.isArray(report?.steps)
    )
      continue;
    const endMs = failedStepEnd(report.steps) ?? meta.endedAtMs;
    if (endMs < meta.startedAtMs) continue;
    failures.push({ testId: meta.testId, startMs: meta.startedAtMs, endMs });
  }
  return failures.sort((a, b) => a.startMs - b.startMs);
}

/** Only native collector records; incomplete tails are reported, never inferred. */
function candidates(text: string, mutationNames: readonly string[]) {
  const starts = new Map<string, number>();
  const matches = new Set<string>();
  const clientSpans: NarrateSpan[] = [];
  let malformed = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    let document: unknown;
    try {
      document = JSON.parse(line);
    } catch {
      malformed += 1;
      continue;
    }
    for (const span of spansFromDocument(document)) {
      if (span.attributes[ATTR.SERVICE_NAME] === serviceName('client'))
        clientSpans.push(span);
      starts.set(
        span.traceId,
        Math.min(starts.get(span.traceId) ?? span.startTimeMs, span.startTimeMs)
      );
      if (
        span.name === 'mutation.replay' &&
        mutationNames.includes(String(span.attributes[ATTR.APP_MUTATION_NAME]))
      )
        matches.add(span.traceId);
    }
  }
  return {
    malformed,
    clientIndex: indexClientTraces(clientSpans),
    traces: [...matches].map((traceId) => ({
      traceId,
      startMs: starts.get(traceId)!,
    })),
  };
}

function criticalSpans(spans: readonly NarrateSpan[]): NarrateSpan[] {
  const slowest = [...spans].sort((a, b) => b.durationMs - a.durationMs);
  const latest = [...spans].sort(
    (a, b) => b.startTimeMs + b.durationMs - a.startTimeMs - a.durationMs
  );
  const chosen = new Map<string, NarrateSpan>();
  const priorities = [
    ...slowest.filter((span) => span.status === 'error').slice(0, 4),
    ...slowest.filter((span) => span.name !== 'db.query').slice(0, 8),
    ...slowest.filter((span) => span.name === 'db.query').slice(0, 4),
    ...latest.filter((span) => span.name === 'db.query').slice(0, 4),
  ];
  const byId = new Map(spans.map((span) => [span.spanId, span]));
  for (const span of priorities) chosen.set(span.spanId, span);
  for (const span of chosen.values()) {
    const parent = span.parentSpanId && byId.get(span.parentSpanId);
    if (parent && chosen.size < MAX_DETAIL_SPANS)
      chosen.set(parent.spanId, parent);
  }
  return [...chosen.values()];
}

/** Keep shared context once; retain a child's changed service or identity. */
function requestContextOnce(spans: readonly NarrateSpan[]): NarrateSpan[] {
  const root =
    spans.find((span) => span.name === 'http.server.request') ??
    spans.find((span) => span.name === 'worker.fetch') ??
    spans[0];
  if (root === undefined) return [];
  return spans.map((span) => {
    if (span.spanId === root.spanId) return span;
    const attributes = { ...span.attributes };
    for (const key of REQUEST_CONTEXT)
      if (Object.is(attributes[key], root.attributes[key]))
        delete attributes[key];
    return { ...span, attributes };
  });
}

function traceEvidence(trace: Trace, candidate: Candidate): string {
  const details = criticalSpans(trace.spans);
  const missing = REQUEST_SPANS.filter(
    (name) => !trace.spans.some((span) => span.name === name)
  );
  return [
    `request trace ${trace.traceId}; earliest collected span ${new Date(candidate.startMs).toISOString()}`,
    `${trace.spans.length} collected spans; ${trace.spans.length - details.length} omitted from critical work summary (lifecycle, slowest queries and last completed queries).`,
    ...(missing.length === 0
      ? []
      : [
          `Incomplete request trace: no collected ${missing.join(', ')} span; no unfinished duration is inferred.`,
        ]),
    narrate(requestContextOnce(details), { maxLines: 120, maxChars: 10_000 }),
  ].join('\n');
}

/** Bounded failure-only output before PR telemetry and reports are removed. */
export async function releaseFailureTraces(args: {
  readonly reports: ObjectStore;
  readonly telemetry: ObjectStore;
  readonly run: TimeRange;
  readonly mutationNames: readonly string[];
}): Promise<string> {
  const windows = await failureWindows(args.reports, args.run);
  if (windows.length === 0)
    return 'release trace evidence: no current failed-scenario timeline; request time anchor unavailable (no broader trace fallback).';
  const source = await readUtf8(args.telemetry, 'spans.ndjson');
  if (source === null)
    return 'release trace evidence: native collector spans.ndjson is unavailable.';
  const found = candidates(source, args.mutationNames);
  const store = new NdjsonTraceStore(
    args.telemetry,
    'release native collector'
  );
  const output = [
    'release trace evidence: collected completed spans; absent spans may be unfinished or unexported.',
    `${windows.length} failed scenario timelines; ${Math.max(0, windows.length - MAX_FAILURES)} omitted by the failure cap; ${found.malformed} malformed collector lines ignored.`,
  ];
  let clientBudget = 2_000;
  for (const window of windows.slice(0, MAX_FAILURES)) {
    output.push(
      `failed scenario ${window.testId}; request-start window ${new Date(window.startMs).toISOString()} .. ${new Date(window.endMs).toISOString()}`
    );
    const matching = found.traces
      .filter(
        (trace) =>
          trace.startMs >= window.startMs && trace.startMs <= window.endMs
      )
      .sort(
        (a, b) =>
          b.startMs - a.startMs ||
          (a.traceId < b.traceId ? -1 : a.traceId > b.traceId ? 1 : 0)
      );
    output.push(
      `${matching.length} matching request traces; ${Math.max(0, matching.length - MAX_TRACES)} omitted by the trace cap.`
    );
    for (const candidate of matching.slice(0, MAX_TRACES)) {
      const trace = await store.getTrace(candidate.traceId);
      if (trace !== null) {
        output.push(traceEvidence(trace, candidate));
        const client = clientTraceEvidence(found.clientIndex, trace, {
          mutationNames: args.mutationNames,
          maxChars: clientBudget - 1,
        });
        if (client !== '') {
          output.push(client);
          clientBudget -= client.length + 1;
        }
      }
    }
  }
  return output.join('\n');
}
