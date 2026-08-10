import { createLogger } from '@pkgs/logger/logger';
import type { CreateId } from '@pkgs/uuid';
import { BaseObservability } from '../port/base-observability';
import { InMemorySpanContextStorage } from '../port/in-memory-context-storage';
import type { Observability, SpanContextStorage } from '../port/observability';
import { DEFAULT_COLLECTOR_URL } from '../shared/backend';
import type { ExportedSpanRecord, HttpFetchFn } from '../shared/types';

export type LocalFileObservabilityOptions = {
  readonly serviceName: string;
  readonly now: () => number;
  readonly createId: CreateId;
  readonly collectorUrl?: string;
  readonly fetchFn?: HttpFetchFn;
  readonly storage?: SpanContextStorage;
};

function exportSpanViaHttp(
  record: ExportedSpanRecord,
  collectorUrl: string,
  fetchFn: HttpFetchFn,
  log: ReturnType<typeof createLogger>
): void {
  const url = `${collectorUrl.replace(/\/$/, '')}/v1/spans`;
  void fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  }).catch((error: unknown) => {
    log.error('span export failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

export function createLocalFileObservability(
  options: LocalFileObservabilityOptions
): Observability {
  const collectorUrl = options.collectorUrl ?? DEFAULT_COLLECTOR_URL;
  const fetchFn = options.fetchFn ?? fetch;
  const storage = options.storage ?? new InMemorySpanContextStorage();
  const log = createLogger({
    name: 'observability-local-file',
    now: options.now,
  });

  return new BaseObservability({
    serviceName: options.serviceName,
    backend: 'local-file',
    storage,
    now: options.now,
    createId: options.createId,
    exporter: (record) => exportSpanViaHttp(record, collectorUrl, fetchFn, log),
  });
}

export function createLocalFileObservabilityWithExporter(args: {
  readonly serviceName: string;
  readonly now: () => number;
  readonly createId: CreateId;
  readonly exporter: (record: ExportedSpanRecord) => void;
  readonly storage?: InMemorySpanContextStorage;
}): Observability {
  return new BaseObservability({
    serviceName: args.serviceName,
    backend: 'local-file',
    storage: args.storage ?? new InMemorySpanContextStorage(),
    now: args.now,
    createId: args.createId,
    exporter: args.exporter,
  });
}
