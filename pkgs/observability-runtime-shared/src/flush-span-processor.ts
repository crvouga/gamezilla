import { TraceFlags } from '@opentelemetry/api';
import type {
  ReadableSpan,
  SpanExporter,
  SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { FlushExportQueue } from './flush-export-queue';

/** A Worker has no timer or collector connections until its explicit flush. */
export class FlushSpanProcessor implements SpanProcessor {
  private readonly queue: FlushExportQueue<ReadableSpan>;

  constructor(exporter: SpanExporter) {
    this.queue = new FlushExportQueue(exporter);
  }

  onStart(): void {}

  onEnd(span: ReadableSpan): void {
    if ((span.spanContext().traceFlags & TraceFlags.SAMPLED) !== 0)
      this.queue.add(span);
  }

  forceFlush(): Promise<void> {
    return this.queue.forceFlush();
  }
  shutdown(): Promise<void> {
    return this.queue.shutdown();
  }
}
