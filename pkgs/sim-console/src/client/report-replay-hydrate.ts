/**
 * Fetch DST sqlite dumps as sqlite-mem SQLM (converted on the Bun report server).
 */

import type { HttpFetch } from '@pkgs/http-client';
import type { SystemCheckpoint } from '../shared/system-checkpoint';
import type { ReportApiClient } from './api-client';
import type { FlatFrame } from './frames';

export function frameIsHydratable(frame: FlatFrame | null): boolean {
  if (frame == null) return false;
  return (frame.databases ?? []).some((d) => d.byteLength > 0);
}

export async function checkpointFromReportFrame(args: {
  readonly frame: FlatFrame;
  readonly api: ReportApiClient;
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly fetch: HttpFetch;
}): Promise<SystemCheckpoint> {
  const clientSql: Record<string, Uint8Array> = {};
  let serverSql: Uint8Array | undefined;
  for (const dump of args.frame.databases ?? []) {
    if (dump.byteLength === 0) continue;
    const sqlm = await fetchSqlmDump({
      api: args.api,
      bucketId: args.bucketId,
      runId: args.runId,
      testId: args.testId,
      file: dump.file,
      atMs: args.frame.capturedAtMs,
      fetch: args.fetch,
    });
    if (dump.nodeId === 'api') {
      serverSql = sqlm;
      continue;
    }
    clientSql[clientIdFromNode(dump.nodeId)] = sqlm;
  }
  if (serverSql === undefined) {
    throw new Error('report frame has no API sqlite dump');
  }
  return mergeCheckpointMeta(args.frame, serverSql, clientSql);
}

async function fetchSqlmDump(args: {
  readonly api: ReportApiClient;
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly file: string;
  readonly atMs: number;
  readonly fetch: HttpFetch;
}): Promise<Uint8Array> {
  const base = args.api.testFrameUrl(
    args.bucketId,
    args.runId,
    args.testId,
    args.file
  );
  const url = `${base}?format=sqlm&at=${String(args.atMs)}`;
  const res = await args.fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch sqlm dump (${res.status})`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

function clientIdFromNode(nodeId: string): string {
  return nodeId.startsWith('client:') ? nodeId.slice('client:'.length) : nodeId;
}

function mergeCheckpointMeta(
  frame: FlatFrame,
  serverSql: Uint8Array,
  clientSql: Record<string, Uint8Array>
): SystemCheckpoint {
  const meta = frame.checkpoint;
  const clientIds =
    meta?.clientIds ??
    Object.keys(clientSql).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return {
    label: frame.step.title,
    capturedAtMs: frame.capturedAtMs,
    clockMs: meta?.clockMs ?? frame.capturedAtMs,
    clockPaused: meta?.clockPaused ?? true,
    localSchemaVersion: 0,
    clientIds,
    roomTopics: meta?.roomTopics ?? [],
    partitions: meta?.partitions ?? [],
    skewByAddress: meta?.skewByAddress ?? {},
    downAddresses: meta?.downAddresses ?? [],
    evictedAddresses: meta?.evictedAddresses ?? [],
    sqlFormat: 'sqlm',
    serverSql,
    clientSql,
    clientKv: {},
    rooms: {},
  };
}
