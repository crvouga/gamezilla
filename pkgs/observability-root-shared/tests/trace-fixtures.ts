import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';
import { NdjsonTraceStore } from '@pkgs/observability-root-shared/ndjson';

/** A span as a collector file stores it; `atMs` is its start in epoch ms. */
export type FixtureSpan = {
  readonly atMs: number;
  readonly attributes?: Readonly<Record<string, string | number>>;
  readonly durationMs?: number;
  readonly events?: readonly {
    readonly attributes?: Readonly<Record<string, string>>;
    readonly name: string;
  }[];
  readonly name: string;
  readonly parent?: string;
  readonly spanId?: string;
  readonly status?: 'error' | 'ok';
  readonly statusMessage?: string;
  /** Sixteen hex digits make the trace id; shorter numbers are padded. */
  readonly trace: number;
};

export function traceIdOf(trace: number): string {
  return trace.toString(16).padStart(32, '0');
}

let spanCounter = 0;

function line(span: FixtureSpan): string {
  spanCounter += 1;
  return JSON.stringify({
    timestamp: new Date(span.atMs).toISOString(),
    traceId: traceIdOf(span.trace),
    spanId: span.spanId ?? spanCounter.toString(16).padStart(16, '0'),
    ...(span.parent === undefined ? {} : { parentSpanId: span.parent }),
    name: span.name,
    durationMs: span.durationMs ?? 5,
    status: span.status ?? 'ok',
    ...(span.statusMessage === undefined
      ? {}
      : { statusMessage: span.statusMessage }),
    attributes: span.attributes ?? {},
    events: (span.events ?? []).map((event) => ({
      name: event.name,
      timestamp: new Date(span.atMs).toISOString(),
      attributes: event.attributes ?? {},
    })),
  });
}

export function objectStoreOf(text: string): ObjectStore {
  const bytes = new TextEncoder().encode(text);
  return {
    async get() {
      return {
        body: new Blob([bytes]).stream(),
        contentType: 'application/x-ndjson',
        size: bytes.byteLength,
      };
    },
    async put() {},
    async head() {
      return true;
    },
    async delete() {},
    async deleteMany() {},
    async getUri() {
      return null;
    },
    async listKeys() {
      return ['spans.ndjson'];
    },
    withPrefix() {
      return this;
    },
  };
}

export function storeOf(spans: readonly FixtureSpan[]): NdjsonTraceStore {
  return new NdjsonTraceStore(
    objectStoreOf(spans.map(line).join('\n')),
    'fixture'
  );
}
