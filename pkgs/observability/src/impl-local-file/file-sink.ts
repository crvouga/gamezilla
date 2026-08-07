import {
  appendFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import type { ExportedSpanRecord } from '../shared/types';

export type FileSinkOptions = {
  readonly rootDir: string;
  readonly maxFileBytes: number;
  readonly maxFiles: number;
  readonly maxTotalBytes: number;
  readonly maxAgeMs: number;
};

export const DEFAULT_FILE_SINK_OPTIONS: FileSinkOptions = {
  rootDir: join(process.cwd(), '.observability'),
  maxFileBytes: 5 * 1024 * 1024,
  maxFiles: 50,
  maxTotalBytes: 100 * 1024 * 1024,
  maxAgeMs: 72 * 60 * 60 * 1000,
};

type ActiveFile = {
  readonly path: string;
  bytes: number;
};

function hourPath(rootDir: string, serviceName: string, now: Date): string {
  const day = now.toISOString().slice(0, 10);
  const hour = now.getUTCHours().toString().padStart(2, '0');
  return join(rootDir, serviceName, day, `${hour}.ndjson`);
}

export class ObservabilityFileSink {
  private readonly options: FileSinkOptions;
  private ingestCount = 0;
  private activeByService = new Map<string, ActiveFile>();

  constructor(options: Partial<FileSinkOptions> = {}) {
    this.options = { ...DEFAULT_FILE_SINK_OPTIONS, ...options };
  }

  write(record: ExportedSpanRecord): void {
    const line = `${JSON.stringify(record)}\n`;
    const bytes = Buffer.byteLength(line, 'utf8');
    const now = new Date();
    const service = record.serviceName;
    let active = this.activeByService.get(service);
    const targetPath = hourPath(this.options.rootDir, service, now);

    if (active === undefined || active.path !== targetPath) {
      active = { path: targetPath, bytes: 0 };
      this.activeByService.set(service, active);
    }

    if (active.bytes + bytes > this.options.maxFileBytes) {
      const rotated = `${targetPath}.${Date.now()}.ndjson`;
      active = { path: rotated, bytes: 0 };
      this.activeByService.set(service, active);
    }

    mkdirSync(dirname(active.path), { recursive: true });
    appendFileSync(active.path, line, 'utf8');
    active.bytes += bytes;

    this.ingestCount += 1;
    if (this.ingestCount % 500 === 0) {
      this.cleanup(service);
    }
  }

  private listServiceFiles(serviceName: string): string[] {
    const serviceDir = join(this.options.rootDir, serviceName);
    const files: string[] = [];
    try {
      for (const day of readdirSync(serviceDir)) {
        const dayDir = join(serviceDir, day);
        for (const file of readdirSync(dayDir)) {
          files.push(join(dayDir, file));
        }
      }
    } catch {
      return [];
    }
    return files;
  }

  cleanup(serviceName?: string): void {
    const services =
      serviceName !== undefined ? [serviceName] : this.listServices();
    const now = Date.now();
    for (const service of services) {
      const files = this.listServiceFiles(service)
        .map((path) => ({ path, stat: statSync(path) }))
        .sort((a, b) => a.stat.mtimeMs - b.stat.mtimeMs);

      let totalBytes = files.reduce((sum, f) => sum + f.stat.size, 0);

      for (const file of files) {
        const tooOld = now - file.stat.mtimeMs > this.options.maxAgeMs;
        const tooMany = files.length > this.options.maxFiles;
        const tooLarge = totalBytes > this.options.maxTotalBytes;
        if (!tooOld && !tooMany && !tooLarge) break;
        try {
          unlinkSync(file.path);
          totalBytes -= file.stat.size;
        } catch {
          /* ignore */
        }
      }
    }
  }

  private listServices(): string[] {
    try {
      return readdirSync(this.options.rootDir);
    } catch {
      return [];
    }
  }
}
