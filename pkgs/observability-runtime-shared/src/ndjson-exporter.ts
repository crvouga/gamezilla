import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { readUtf8, writeUtf8 } from '@pkgs/object-store-root-shared/helpers';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';

export type NdjsonSpanExporterOptions = {
  readonly store: ObjectStore;
  /**
   * The first segment's key. Later segments carry their number before the
   * extension (`spans.ndjson`, `spans.1.ndjson`, …).
   */
  readonly key: string;
  /** Characters a segment holds before the next one starts. */
  readonly segmentChars?: number;
};

/**
 * An object store has no append, so every export rewrites the object it adds
 * to. One ever-growing object makes that quadratic: a spec part that records
 * 77 MB of spans in 300 exports read and rewrote some 12 GB. Segments bound
 * what one export rewrites.
 */
const SEGMENT_CHARS = 1_000_000;

/** `spans.ndjson`, 2 → `spans.2.ndjson`. Segment 0 is the key itself. */
export function segmentKey(key: string, segment: number): string {
  if (segment === 0) return key;
  const dot = key.lastIndexOf('.');
  return dot <= key.lastIndexOf('/')
    ? `${key}.${String(segment)}`
    : `${key.slice(0, dot)}.${String(segment)}${key.slice(dot)}`;
}

export class NdjsonSpanExporter implements SpanExporter {
  private pending: Promise<void> = Promise.resolve();
  private segment = 0;
  /** What the current segment holds; `null` until its first export reads it. */
  private text: string | null = null;

  constructor(private readonly options: NdjsonSpanExporterOptions) {}

  export(
    spans: ReadableSpan[],
    resultCallback: (result: { code: 0 | 1; error?: Error }) => void
  ): void {
    this.pending = this.pending.then(() => this.append(spans));
    void this.pending.then(
      () => resultCallback({ code: 0 }),
      (error: unknown) =>
        resultCallback({
          code: 1,
          error: error instanceof Error ? error : new Error(String(error)),
        })
    );
  }

  forceFlush(): Promise<void> {
    return this.pending;
  }

  shutdown(): Promise<void> {
    return this.pending;
  }

  private async append(spans: readonly ReadableSpan[]): Promise<void> {
    if (spans.length === 0) return;
    const { store, key } = this.options;
    // An artifact that already exists is added to, once, not replaced.
    this.text ??= (await readUtf8(store, key)) ?? '';
    const lines = spans
      .map((span) => JSON.stringify(spanRecord(span)))
      .join('\n');
    this.text = `${this.text}${lines}\n`;
    await writeUtf8(
      store,
      segmentKey(key, this.segment),
      this.text,
      'application/x-ndjson'
    );
    if (this.text.length >= (this.options.segmentChars ?? SEGMENT_CHARS)) {
      this.segment += 1;
      this.text = '';
    }
  }
}

function milliseconds(time: readonly [number, number]): number {
  return time[0] * 1_000 + time[1] / 1_000_000;
}

function spanRecord(span: ReadableSpan): Record<string, unknown> {
  const context = span.spanContext();
  const status =
    span.status.code === 2 ? 'error' : span.status.code === 1 ? 'ok' : 'unset';
  return {
    traceId: context.traceId,
    spanId: context.spanId,
    ...(span.parentSpanContext === undefined
      ? {}
      : { parentSpanId: span.parentSpanContext.spanId }),
    name: span.name,
    startTimeMs: milliseconds(span.startTime),
    durationMs: milliseconds(span.duration),
    status,
    attributes: { ...span.resource.attributes, ...span.attributes },
    events: span.events.map((event) => ({
      name: event.name,
      timeMs: milliseconds(event.time),
      attributes: event.attributes,
    })),
    links: span.links.map((link) => ({
      traceId: link.context.traceId,
      spanId: link.context.spanId,
      attributes: link.attributes,
    })),
  };
}
