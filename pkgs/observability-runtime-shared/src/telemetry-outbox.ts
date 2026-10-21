import type { Clock, Timers } from '@pkgs/clock-shared/types';
import type { HttpClient } from '@pkgs/http-client-shared/types';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';
import { deliverTelemetry, TelemetryBatchRefused } from './telemetry-delivery';

type Signal = 'traces' | 'logs';
type Batch = {
  readonly signal: Signal;
  readonly body: string;
  readonly recordedAtMs: number;
};
type Options = {
  readonly store: ObjectStore;
  readonly http: HttpClient;
  readonly clock: Clock;
  readonly timers: Timers;
  readonly createId: () => string;
  readonly endpoints: Readonly<Record<Signal, string>>;
};

/** SDK acknowledgement means locally persisted; remote delivery retries independently. */
export class TelemetryOutbox {
  readonly http: HttpClient;
  private pending: Promise<void> | undefined;
  private retry: unknown;
  private stopped = false;

  constructor(private readonly options: Options) {
    this.http = { fetch: (input, init) => this.enqueue(input, init) };
  }

  start(): void {
    void this.flush()
      .then(() => this.flush())
      .catch(() => this.scheduleRetry());
  }

  stop(): void {
    this.stopped = true;
    this.options.timers.clearTimeout(this.retry);
  }

  flush(): Promise<void> {
    if (this.pending !== undefined) return this.pending;
    if (this.stopped) return Promise.resolve();
    this.options.timers.clearTimeout(this.retry);
    this.retry = undefined;
    const work = this.drain();
    this.pending = work;
    void work.then(
      () => {
        this.pending = undefined;
      },
      () => {
        this.pending = undefined;
        this.scheduleRetry();
      }
    );
    return work;
  }

  private async enqueue(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const request = new Request(input, init);
    const signal = this.signalFor(request.url);
    if (request.method !== 'POST' || signal === undefined)
      throw new Error('Unexpected telemetry request');
    const batch: Batch = {
      signal,
      body: await request.text(),
      recordedAtMs: this.options.clock.now(),
    };
    const key = `${this.options.clock.now()}-${this.options.createId()}.json`;
    await this.options.store.put(
      key,
      new TextEncoder().encode(JSON.stringify(batch)),
      'application/json'
    );
    this.start();
    return Response.json({});
  }

  private signalFor(url: string): Signal | undefined {
    for (const signal of ['traces', 'logs'] as const) {
      if (url === this.options.endpoints[signal]) return signal;
    }
    return undefined;
  }

  private async drain(): Promise<void> {
    // Rescan after a pass so batches enqueued during delivery are not stranded.
    while (!this.stopped) {
      const keys = await this.options.store.listKeys();
      if (keys.length === 0) return;
      for (const key of keys) {
        if (this.stopped) return;
        await this.deliver(key);
      }
    }
  }

  private async deliver(key: string): Promise<void> {
    const stored = await this.options.store.get(key);
    if (stored === null) return;
    const batch = JSON.parse(await new Response(stored.body).text()) as Batch;
    if (
      this.options.clock.now() - batch.recordedAtMs >=
      30 * 24 * 60 * 60 * 1000
    ) {
      await this.options.store.delete(key);
      return;
    }
    try {
      await deliverTelemetry({
        http: this.options.http,
        timers: this.options.timers,
        url: this.options.endpoints[batch.signal],
        body: batch.body,
      });
    } catch (error: unknown) {
      if (!(error instanceof TelemetryBatchRefused)) throw error;
    }
    await this.options.store.delete(key);
  }

  private scheduleRetry(): void {
    if (this.stopped || this.retry !== undefined) return;
    this.retry = this.options.timers.setTimeout(() => {
      this.retry = undefined;
      this.start();
    }, 5000);
  }
}
