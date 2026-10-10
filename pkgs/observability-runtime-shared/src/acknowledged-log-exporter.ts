import { JsonLogsSerializer } from '@opentelemetry/otlp-transformer';
import type {
  LogRecordExporter,
  ReadableLogRecord,
} from '@opentelemetry/sdk-logs';
import type { Timers } from '@pkgs/clock-shared/types';
import type { HttpClient } from '@pkgs/http-client-shared/types';

/** Standard OTLP JSON with a strict acknowledgement. Unlike best-effort SDK
 * export, rejected records must fail a durable delivery so it can be retried. */
export class AcknowledgedLogExporter implements LogRecordExporter {
  readonly #pending = new Set<Promise<void>>();

  constructor(
    private readonly endpoint: string,
    private readonly headers: Readonly<Record<string, string>>,
    private readonly http: HttpClient,
    private readonly timers: Timers
  ) {}

  export(
    records: ReadableLogRecord[],
    callback: Parameters<LogRecordExporter['export']>[1]
  ): void {
    const operation = this.send(records).then(
      () => callback({ code: 0 }),
      () => callback({ code: 1 })
    );
    this.#pending.add(operation);
    void operation.then(
      () => this.#pending.delete(operation),
      () => this.#pending.delete(operation)
    );
  }

  async forceFlush(): Promise<void> {
    await Promise.all(this.#pending);
  }
  async shutdown(): Promise<void> {
    await this.forceFlush();
  }

  private async send(records: ReadableLogRecord[]): Promise<void> {
    const controller = new AbortController();
    let timer: unknown;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = this.timers.setTimeout(() => {
        controller.abort();
        reject(new Error('OTLP acknowledgement timed out'));
      }, 5000);
    });
    try {
      await Promise.race([this.request(records, controller.signal), deadline]);
    } finally {
      this.timers.clearTimeout(timer);
    }
  }

  private async request(
    records: ReadableLogRecord[],
    signal: AbortSignal
  ): Promise<void> {
    const body = JsonLogsSerializer.serializeRequest(records);
    if (body === undefined) throw new Error('OTLP serialization failed');
    const response = await this.http.fetch(this.endpoint, {
      method: 'POST',
      headers: { ...this.headers, 'content-type': 'application/json' },
      body: body.slice().buffer,
      signal,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('OTLP export rejected');
    }
    const bytes = await acknowledgementBytes(response);
    if (bytes.byteLength === 0) return;
    const outcome = JsonLogsSerializer.deserializeResponse(bytes);
    const rejected = Number(outcome.partialSuccess?.rejectedLogRecords ?? 0);
    if (!Number.isSafeInteger(rejected) || rejected !== 0)
      throw new Error('OTLP records rejected');
  }
}

async function acknowledgementBytes(response: Response): Promise<Uint8Array> {
  if (response.body === null) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > 65_536) {
        await reader.cancel();
        throw new Error('OTLP acknowledgement too large');
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
