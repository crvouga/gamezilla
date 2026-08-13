import type { ObjectStore } from '@pkgs/object-store/interface';
import {
  readObjectBytes,
  readUtf8,
  writeUtf8,
} from '@pkgs/object-store/helpers';
import type { ExportedSpanRecord } from '../shared/types';

export type FileSinkOptions = {
  readonly store: ObjectStore;
  readonly maxFileBytes: number;
  readonly maxFiles: number;
  readonly maxTotalBytes: number;
  readonly maxAgeMs: number;
  readonly now: () => number;
};

export const DEFAULT_FILE_SINK_LIMITS: Omit<FileSinkOptions, 'now' | 'store'> =
  {
    maxFileBytes: 5 * 1024 * 1024,
    maxFiles: 50,
    maxTotalBytes: 100 * 1024 * 1024,
    maxAgeMs: 72 * 60 * 60 * 1000,
  };

/** @deprecated Use {@link DEFAULT_FILE_SINK_LIMITS} + an injected ObjectStore. */
export const DEFAULT_FILE_SINK_OPTIONS = DEFAULT_FILE_SINK_LIMITS;

type ActiveFile = {
  readonly key: string;
  bytes: number;
};

function hourKey(serviceName: string, now: Date): string {
  const day = now.toISOString().slice(0, 10);
  const hour = now.getUTCHours().toString().padStart(2, '0');
  return `${serviceName}/${day}/${hour}.ndjson`;
}

export class ObservabilityFileSink {
  private readonly options: FileSinkOptions;
  private ingestCount = 0;
  private activeByService = new Map<string, ActiveFile>();
  /** In-memory append buffers keyed by object key (flushed on each write). */
  private buffers = new Map<string, string>();

  constructor(options: FileSinkOptions) {
    this.options = options;
  }

  async write(record: ExportedSpanRecord): Promise<void> {
    const line = `${JSON.stringify(record)}\n`;
    const bytes = Buffer.byteLength(line, 'utf8');
    const nowMs = this.options.now();
    const now = new Date(nowMs);
    const service = record.serviceName;
    let active = this.activeByService.get(service);
    const targetKey = hourKey(service, now);

    if (active === undefined || active.key !== targetKey) {
      active = { key: targetKey, bytes: await this.existingSize(targetKey) };
      this.activeByService.set(service, active);
    }

    if (active.bytes + bytes > this.options.maxFileBytes) {
      const rotated = `${targetKey}.${String(nowMs)}.ndjson`;
      active = { key: rotated, bytes: 0 };
      this.activeByService.set(service, active);
    }

    const prev = this.buffers.get(active.key) ?? (await this.readExisting(active.key));
    const next = `${prev}${line}`;
    this.buffers.set(active.key, next);
    await writeUtf8(this.options.store, active.key, next, 'application/x-ndjson');
    active.bytes += bytes;

    this.ingestCount += 1;
    if (this.ingestCount % 500 === 0) {
      await this.cleanup(service);
    }
  }

  private async existingSize(key: string): Promise<number> {
    const bytes = await readObjectBytes(this.options.store, key);
    return bytes?.byteLength ?? 0;
  }

  private async readExisting(key: string): Promise<string> {
    return (await readUtf8(this.options.store, key)) ?? '';
  }

  private async listServiceKeys(serviceName: string): Promise<string[]> {
    const prefix = `${serviceName}/`;
    return [...(await this.options.store.listKeys(prefix))];
  }

  async cleanup(serviceName?: string): Promise<void> {
    const services =
      serviceName !== undefined ? [serviceName] : await this.listServices();
    const now = this.options.now();
    for (const service of services) {
      const keys = await this.listServiceKeys(service);
      const files: { key: string; size: number }[] = [];
      for (const key of keys) {
        const bytes = await readObjectBytes(this.options.store, key);
        files.push({ key, size: bytes?.byteLength ?? 0 });
      }
      // Newest keys last (lexicographic hour keys sort oldest-first for ISO dates).
      files.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

      let totalBytes = files.reduce((sum, f) => sum + f.size, 0);
      let remaining = files.length;

      for (const file of files) {
        const tooMany = remaining > this.options.maxFiles;
        const tooLarge = totalBytes > this.options.maxTotalBytes;
        // Age heuristic: rotated keys embed millis; hour keys use ISO day/hour.
        const tooOld = this.keyLooksOlderThan(file.key, now);
        if (!tooOld && !tooMany && !tooLarge) break;
        await this.options.store.delete(file.key);
        this.buffers.delete(file.key);
        totalBytes -= file.size;
        remaining -= 1;
      }
    }
  }

  private keyLooksOlderThan(key: string, nowMs: number): boolean {
    // service/YYYY-MM-DD/HH.ndjson or …/HH.<ms>.ndjson
    const parts = key.split('/');
    const day = parts[1];
    if (typeof day !== 'string' || day.length < 10) return false;
    const dayMs = Date.parse(`${day.slice(0, 10)}T00:00:00.000Z`);
    if (!Number.isFinite(dayMs)) return false;
    return nowMs - dayMs > this.options.maxAgeMs;
  }

  private async listServices(): Promise<string[]> {
    const keys = await this.options.store.listKeys();
    const services = new Set<string>();
    for (const key of keys) {
      const service = key.split('/')[0];
      if (service) services.add(service);
    }
    return [...services].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }
}
