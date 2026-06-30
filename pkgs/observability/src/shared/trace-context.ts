import type { SpanContext } from './types';

export const TRACEPARENT_HEADER = 'traceparent';
export const TRACESTATE_HEADER = 'tracestate';

const VERSION = '00';
const SAMPLED_FLAGS = '01';
const UNSAMPLED_FLAGS = '00';

export function formatTraceparent(context: SpanContext): string {
  const flags =
    (context.traceFlags & 0x1) === 1 ? SAMPLED_FLAGS : UNSAMPLED_FLAGS;
  return `${VERSION}-${context.traceId}-${context.spanId}-${flags}`;
}

export function parseTraceparent(value: string): SpanContext | undefined {
  const trimmed = value.trim();
  const parts = trimmed.split('-');
  if (parts.length !== 4) return undefined;
  const [version, traceId, spanId, flagsHex] = parts;
  if (version !== VERSION) return undefined;
  if (traceId === undefined || !/^[0-9a-f]{32}$/.test(traceId)) return undefined;
  if (spanId === undefined || !/^[0-9a-f]{16}$/.test(spanId)) return undefined;
  if (flagsHex === undefined || !/^[0-9a-f]{2}$/.test(flagsHex)) return undefined;
  const traceFlags = parseInt(flagsHex, 16);
  if (!Number.isFinite(traceFlags)) return undefined;
  return { traceId, spanId, traceFlags };
}

export function injectTraceContext(
  context: SpanContext,
  carrier: Record<string, string>
): void {
  carrier[TRACEPARENT_HEADER] = formatTraceparent(context);
}

export function extractTraceContext(
  carrier: Record<string, string>
): SpanContext | undefined {
  const raw = carrier[TRACEPARENT_HEADER];
  if (raw === undefined || raw.length === 0) return undefined;
  return parseTraceparent(raw);
}

export function sampledSpanContext(
  traceId: string,
  spanId: string
): SpanContext {
  return { traceId, spanId, traceFlags: 0x1 };
}
