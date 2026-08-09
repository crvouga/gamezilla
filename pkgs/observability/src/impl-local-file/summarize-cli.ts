// @io-wall-ok
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { wallIo } from '@pkgs/io';
import type { ExportedSpanRecord } from '../shared/types';
import { DEFAULT_FILE_SINK_OPTIONS } from './file-sink';

function filesInDayDir(dayDir: string): string[] {
  return readdirSync(dayDir)
    .filter((file) => file.endsWith('.ndjson'))
    .map((file) => join(dayDir, file));
}

function filesInServiceDir(serviceDir: string): string[] {
  return readdirSync(serviceDir).flatMap((day) =>
    filesInDayDir(join(serviceDir, day))
  );
}

function listNdjsonFiles(rootDir: string): string[] {
  try {
    return readdirSync(rootDir).flatMap((service) =>
      filesInServiceDir(join(rootDir, service))
    );
  } catch {
    return [];
  }
}

function parseLine(line: string): ExportedSpanRecord | undefined {
  if (line.trim().length === 0) return undefined;
  try {
    const parsed: unknown = JSON.parse(line);
    if (parsed !== null && typeof parsed === 'object') {
      return parsed as ExportedSpanRecord;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function parseLines(path: string): ExportedSpanRecord[] {
  const text = readFileSync(path, 'utf8');
  return text
    .split('\n')
    .map(parseLine)
    .filter((r): r is ExportedSpanRecord => r !== undefined);
}

function loadAllRecords(rootDir: string): ExportedSpanRecord[] {
  return listNdjsonFiles(rootDir).flatMap(parseLines);
}

function printWaterfall(records: ExportedSpanRecord[], traceId: string): void {
  const filtered = records
    .filter((r) => r.traceId === traceId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  if (filtered.length === 0) {
    process.stdout.write(`No spans for traceId ${traceId}\n`);
    return;
  }
  for (const span of filtered) {
    process.stdout.write(
      `${span.timestamp} ${span.serviceName.padEnd(20)} ${span.name.padEnd(24)} ${span.durationMs.toFixed(1).padStart(8)}ms ${span.status}\n`
    );
  }
}

function printSlowest(records: ExportedSpanRecord[], limit: number): void {
  const byTrace = new Map<string, { totalMs: number; count: number }>();
  for (const r of records) {
    const prev = byTrace.get(r.traceId) ?? { totalMs: 0, count: 0 };
    byTrace.set(r.traceId, {
      totalMs: prev.totalMs + r.durationMs,
      count: prev.count + 1,
    });
  }
  const ranked = [...byTrace.entries()]
    .sort((a, b) => b[1].totalMs - a[1].totalMs)
    .slice(0, limit);
  process.stdout.write(`Top ${limit} traces by total span duration:\n`);
  for (const [traceId, stats] of ranked) {
    process.stdout.write(
      `  ${traceId}  ${stats.totalMs.toFixed(1)}ms  (${stats.count} spans)\n`
    );
  }
}

type SummarizeArgs = {
  traceId?: string;
  sinceHours?: number;
  limit: number;
  rootDir: string;
};

function applySummarizeFlag(
  args: SummarizeArgs,
  flag: string,
  value: string | undefined
): SummarizeArgs {
  if (flag === '--trace-id' && value !== undefined) {
    return { ...args, traceId: value };
  }
  if (flag === '--since' && value !== undefined) {
    const sinceHours = value.endsWith('h')
      ? Number(value.slice(0, -1))
      : Number(value);
    return { ...args, sinceHours };
  }
  if (flag === '--limit' && value !== undefined) {
    return { ...args, limit: Number(value) };
  }
  if (flag === '--root' && value !== undefined) {
    return { ...args, rootDir: value };
  }
  return args;
}

function parseSummarizeArgs(argv: string[]): SummarizeArgs {
  let args: SummarizeArgs = {
    limit: 10,
    rootDir: DEFAULT_FILE_SINK_OPTIONS.rootDir,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === undefined || !flag.startsWith('--')) continue;
    const value = argv[i + 1];
    args = applySummarizeFlag(args, flag, value);
    if (value !== undefined && flag !== '--trace-id') i += 1;
    if (flag === '--trace-id') i += 1;
  }
  return args;
}

function filterSince(
  records: ExportedSpanRecord[],
  sinceHours: number | undefined,
  now: () => number
): ExportedSpanRecord[] {
  if (sinceHours === undefined || !Number.isFinite(sinceHours)) return records;
  const cutoff = now() - sinceHours * 60 * 60 * 1000;
  return records.filter((r) => Date.parse(r.timestamp) >= cutoff);
}

function main(): void {
  const io = wallIo();
  const args = parseSummarizeArgs(process.argv);
  const records = filterSince(
    loadAllRecords(args.rootDir),
    args.sinceHours,
    io.clock.now
  );
  if (args.traceId !== undefined) {
    printWaterfall(records, args.traceId);
    return;
  }
  printSlowest(records, args.limit);
}

main();
