import type {
  LogRecordExporter,
  LogRecordProcessor,
  ReadableLogRecord,
  ReadWriteLogRecord,
} from '@opentelemetry/sdk-logs';
import { FlushExportQueue } from './flush-export-queue';

/** Log emission never creates a timer or performs I/O on a Worker request. */
export class FlushLogProcessor implements LogRecordProcessor {
  private readonly queue: FlushExportQueue<ReadableLogRecord>;
  constructor(exporter: LogRecordExporter) {
    this.queue = new FlushExportQueue(exporter);
  }
  onEmit(record: ReadWriteLogRecord): void {
    this.queue.add(record);
  }
  forceFlush(): Promise<void> {
    return this.queue.forceFlush();
  }
  shutdown(): Promise<void> {
    return this.queue.shutdown();
  }
}
