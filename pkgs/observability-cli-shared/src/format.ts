import { narrate } from '@pkgs/observability-shared/narrate';
import type {
  TimeRange,
  Trace,
  TraceRef,
  TraceStore,
} from '@pkgs/observability-shared/types';
import { formatRange } from './time';

export const FORMAT_HEADER = 'obs/v1';

export function heading(store: TraceStore, range?: TimeRange): string {
  const lines = [FORMAT_HEADER, `source: ${store.source}`];
  if (range !== undefined) lines.push(`utc-range: ${formatRange(range)}`);
  return lines.join('\n');
}

export function traceLine(ref: TraceRef): string {
  const state = ref.errorCount > 0 ? `ERROR(${ref.errorCount})` : 'ok';
  return `${new Date(ref.startedAtMs).toISOString()} ${state} ${ref.traceId} ${ref.rootName} ${ref.durationMs.toFixed(1)}ms ${ref.spanCount} spans`;
}

export function narratedTrace(trace: Trace, maxLines = 40): string {
  return narrate(trace.spans, { maxLines });
}

export function nextForTrace(trace: Trace): string {
  const error = trace.spans.find((span) => span.status === 'error');
  if (error !== undefined) {
    return `next: bun obs span ${trace.traceId} ${error.spanId}`;
  }
  return `next: bun obs trace ${trace.traceId} --json`;
}

export function noResults(
  subject: string,
  args: {
    readonly source: string;
    readonly window: string;
    readonly range?: TimeRange;
  }
): string {
  return [
    FORMAT_HEADER,
    `source: ${args.source}`,
    ...(args.range === undefined
      ? []
      : [`utc-range: ${formatRange(args.range)}`]),
    `No traces matched ${JSON.stringify(subject)}.`,
    `next: bun obs find ${JSON.stringify(subject)} --window ${args.window}`,
    `next: bun obs last --window ${args.window}`,
  ].join('\n');
}
