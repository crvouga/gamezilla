import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { readUtf8, writeUtf8 } from '@pkgs/object-store-shared/helpers';
import type { ObjectStore } from '@pkgs/object-store-shared/interface';

export type NdjsonSpanExporterOptions = {
  readonly store: ObjectStore;
  readonly key: string;
};

export class NdjsonSpanExporter implements SpanExporter {
  private pending: Promise<void> = Promise.resolve();

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
    const existing =
      (await readUtf8(this.options.store, this.options.key)) ?? '';
    const lines = spans
      .map((span) => JSON.stringify(spanRecord(span)))
      .join('\n');
    await writeUtf8(
      this.options.store,
      this.options.key,
      `${existing}${lines}\n`,
      'application/x-ndjson'
    );
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
