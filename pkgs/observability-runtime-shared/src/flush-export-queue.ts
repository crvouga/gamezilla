type ExportResult = { readonly code: number; readonly error?: Error };

/** Plain records may wait; invocation-owned I/O starts only when the host flushes. */
export class FlushExportQueue<T> {
  private records: T[] = [];
  private closed = false;

  constructor(
    private readonly exporter: {
      export(records: T[], done: (result: ExportResult) => void): void;
      shutdown(): Promise<void>;
    }
  ) {}

  add(record: T): void {
    if (!this.closed) this.records.push(record);
  }

  async forceFlush(): Promise<void> {
    const batch = this.records;
    this.records = [];
    if (batch.length === 0) return;
    await new Promise<void>((resolve, reject) => {
      this.exporter.export(batch, (result) => {
        if (result.code === 0) resolve();
        else reject(result.error ?? new Error('Telemetry export failed'));
      });
    });
  }

  async shutdown(): Promise<void> {
    this.closed = true;
    await this.forceFlush();
    await this.exporter.shutdown();
  }
}
