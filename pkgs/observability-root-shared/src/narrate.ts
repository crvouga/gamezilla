import type { Attributes, AttributeValue } from '@opentelemetry/api';
import { ATTR } from './attributes';
import { EVENT } from './events';
import { allowlistedAttributes } from './redaction';

export type NarrateEvent = {
  readonly name: string;
  readonly timeMs: number;
  readonly attributes?: Attributes;
};

export type NarrateLink = {
  readonly traceId: string;
  readonly spanId: string;
  readonly attributes?: Attributes;
};

export type NarrateSpan = {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly startTimeMs: number;
  readonly durationMs: number;
  readonly status: 'unset' | 'ok' | 'error';
  readonly statusMessage?: string;
  readonly attributes: Attributes;
  readonly events?: readonly NarrateEvent[];
  readonly links?: readonly NarrateLink[];
};

export type NarrateOptions = {
  readonly gapThresholdMs?: number;
  readonly maxChars?: number;
  readonly maxLines?: number;
};

const DEFAULT_MAX_CHARS = 7_000;
const MAX_VALUE_CHARS = 1_200;

export function narrate(
  spans: readonly NarrateSpan[],
  options: NarrateOptions = {}
): string {
  if (spans.length === 0) return 'No spans found.';
  const ordered = [...spans].sort(compareSpans);
  const origin = ordered[0]?.startTimeMs ?? 0;
  const gapThresholdMs = options.gapThresholdMs ?? 1_000;
  const maxLines = options.maxLines ?? 80;
  const lines = [
    `trace ${ordered[0]?.traceId ?? 'unknown'} (${spans.length} spans)`,
  ];
  const errors = ordered.filter((span) => span.status === 'error');
  if (errors.length > 0) {
    lines.push(`errors (${errors.length}):`);
    for (const span of errors) {
      lines.push(formatSpan(span, origin));
      appendAttributes(lines, span.attributes, maxLines);
      appendEvents(lines, span, origin, maxLines);
      appendLinks(lines, span, origin, maxLines);
    }
    lines.push('timeline:');
  }
  let previousEnd = origin;
  for (const span of ordered) {
    if (lines.length >= maxLines) break;
    const gap = span.startTimeMs - previousEnd;
    if (gap > gapThresholdMs) lines.push(`  … gap ${formatDuration(gap)}`);
    lines.push(formatSpan(span, origin));
    appendAttributes(lines, span.attributes, maxLines);
    appendEvents(lines, span, origin, maxLines);
    appendLinks(lines, span, origin, maxLines);
    previousEnd = Math.max(previousEnd, span.startTimeMs + span.durationMs);
  }
  if (lines.length >= maxLines && spans.length > 0) {
    lines.push(
      `  … output capped at ${maxLines} lines; drill into an error span`
    );
  }
  return boundOutput(
    lines.slice(0, maxLines + 1),
    options.maxChars ?? DEFAULT_MAX_CHARS
  );
}

function compareSpans(left: NarrateSpan, right: NarrateSpan): number {
  return (
    left.startTimeMs - right.startTimeMs ||
    compareCodeUnits(left.name, right.name) ||
    compareCodeUnits(left.spanId, right.spanId)
  );
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function formatSpan(span: NarrateSpan, origin: number): string {
  const status = span.status === 'error' ? 'ERROR' : span.status.toUpperCase();
  const message =
    span.statusMessage === undefined
      ? ''
      : ` — ${singleLine(span.statusMessage, MAX_VALUE_CHARS)}`;
  return `${formatOffset(span.startTimeMs - origin)} ${formatDuration(span.durationMs)} ${span.name} [${status}]${message}`;
}

function appendAttributes(
  lines: string[],
  attributes: Attributes,
  maxLines: number
): void {
  const safe = allowlistedAttributes(attributes);
  for (const key of Object.keys(safe).sort()) {
    if (lines.length >= maxLines) return;
    lines.push(`    ${key}=${formatValue(safe[key])}`);
  }
}

function appendEvents(
  lines: string[],
  span: NarrateSpan,
  origin: number,
  maxLines: number
): void {
  const ordered = [...(span.events ?? [])].sort(compareEvents);
  for (const event of ordered) {
    if (lines.length >= maxLines) return;
    if (event.name === EVENT.LOG_EMITTED) {
      lines.push(formatLogEvent(event, origin));
      continue;
    }
    lines.push(
      `    ${formatOffset(event.timeMs - origin)} event ${event.name}`
    );
    if (span.status === 'error') {
      appendAttributes(lines, event.attributes ?? {}, maxLines);
    }
  }
}

function compareEvents(left: NarrateEvent, right: NarrateEvent): number {
  return left.timeMs - right.timeMs || compareCodeUnits(left.name, right.name);
}

function formatLogEvent(event: NarrateEvent, origin: number): string {
  const safe = allowlistedAttributes(event.attributes ?? {});
  const severity = String(safe[ATTR.APP_LOG_SEVERITY] ?? 'info').toUpperCase();
  const loggerName = String(safe[ATTR.APP_LOG_NAME] ?? 'app');
  const message = String(safe[ATTR.APP_LOG_MESSAGE] ?? '');
  return `    ${formatOffset(event.timeMs - origin)} log ${severity} ${singleLine(loggerName, 128)}: ${singleLine(message, 512)}`;
}

function appendLinks(
  lines: string[],
  span: NarrateSpan,
  origin: number,
  maxLines: number
): void {
  for (const link of span.links ?? []) {
    if (lines.length >= maxLines) return;
    const linkedOrigin = link.attributes?.[ATTR.APP_MUTATION_ORIGIN_TIME_MS];
    const originTime =
      typeof linkedOrigin === 'number' && Number.isFinite(linkedOrigin)
        ? linkedOrigin
        : origin;
    const elapsed = Math.max(0, span.startTimeMs - originTime);
    lines.push(
      `    caused by ${link.traceId}/${link.spanId}, ${formatDuration(elapsed)} earlier`
    );
  }
}

function formatValue(value: AttributeValue | undefined): string {
  const rendered = Array.isArray(value)
    ? `[${value.join(',')}]`
    : String(value);
  return singleLine(rendered, MAX_VALUE_CHARS);
}

function singleLine(value: string, maxChars: number): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length <= maxChars
    ? compact
    : `${compact.slice(0, Math.max(0, maxChars - 12))}…[truncated]`;
}

function boundOutput(lines: readonly string[], maxChars: number): string {
  const output: string[] = [];
  let used = 0;
  for (const raw of lines) {
    const line = singleLine(raw, MAX_VALUE_CHARS);
    const size = line.length + (output.length === 0 ? 0 : 1);
    if (used + size > maxChars) {
      output.push('  … output capped; drill into the referenced error span');
      break;
    }
    output.push(line);
    used += size;
  }
  return output.join('\n');
}

function formatOffset(milliseconds: number): string {
  return `+${(milliseconds / 1_000).toFixed(3)}s`;
}

function formatDuration(milliseconds: number): string {
  return milliseconds < 1_000
    ? `${milliseconds.toFixed(1)}ms`
    : `${(milliseconds / 1_000).toFixed(2)}s`;
}
