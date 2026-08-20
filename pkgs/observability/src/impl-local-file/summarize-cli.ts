// @io-wall-ok

import { join } from 'node:path';
import { wallClock } from '@pkgs/clock';
import { readUtf8 } from '@pkgs/object-store/helpers';
import { createNodeFsObjectStore } from '@pkgs/object-store/impl-node-fs';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { wallNodeFs } from '@pkgs/object-store/wall-node-fs';
import type { ExportedSpanRecord } from '../shared/types';

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

async function loadAllRecords(
  store: ObjectStore
): Promise<ExportedSpanRecord[]> {
  const keys = await store.listKeys();
  const ndjsonKeys = keys.filter((k) => k.endsWith('.ndjson'));
  const out: ExportedSpanRecord[] = [];
  for (const key of ndjsonKeys) {
    const text = await readUtf8(store, key);
    if (text === null) continue;
    for (const line of text.split('\n')) {
      const record = parseLine(line);
      if (record !== undefined) out.push(record);
    }
  }
  return out;
}

function compareCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function printWaterfall(records: ExportedSpanRecord[], traceId: string): void {
  const filtered = records
    .filter((r) => r.traceId === traceId)
    .sort((a, b) => compareCodeUnit(a.timestamp, b.timestamp));
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
    rootDir: join(process.cwd(), '.observability'),
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

async function main(): Promise<void> {
  const args = parseSummarizeArgs(process.argv);
  const store = createNodeFsObjectStore({
    rootDir: args.rootDir,
    fs: wallNodeFs(),
    layout: 'tree',
  });
  const records = filterSince(
    await loadAllRecords(store),
    args.sinceHours,
    wallClock.now
  );
  if (args.traceId !== undefined) {
    printWaterfall(records, args.traceId);
    return;
  }
  printSlowest(records, args.limit);
}

void main();
