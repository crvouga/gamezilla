import { z } from 'zod';
import type { SqlDumpValue } from '@pkgs/sql-client/sql-data-snapshot/types';
import {
  SIM_SYSTEM_SNAPSHOT_VERSION,
  type SimSystemSnapshot,
} from './sim-system-snapshot';

const sqlDumpValueSchema: z.ZodType<SqlDumpValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number(),
    z.string(),
    z.array(sqlDumpValueSchema),
    z.record(z.string(), sqlDumpValueSchema),
  ])
);

const sqlTableDumpSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(sqlDumpValueSchema)),
});

const sqlDataDumpSchema = z.object({
  version: z.literal(1),
  tables: z.record(z.string(), sqlTableDumpSchema),
});

const roomDumpSchema = z.object({
  entries: z.array(z.unknown()),
  dedup: z.record(z.string(), z.unknown()),
});

export const simSystemSnapshotSchema = z.object({
  version: z.literal(SIM_SYSTEM_SNAPSHOT_VERSION),
  localSchemaVersion: z.number().int().nonnegative(),
  clockMs: z.number(),
  clockPaused: z.boolean(),
  clientIds: z.array(z.string()),
  roomTopics: z.array(z.string()),
  partitions: z.array(z.string()),
  skewByAddress: z.record(z.string(), z.number()),
  downAddresses: z.array(z.string()),
  evictedAddresses: z.array(z.string()),
  server: sqlDataDumpSchema,
  clients: z.record(
    z.string(),
    z.object({
      tables: sqlDataDumpSchema,
      kv: z.record(z.string(), z.string()),
    })
  ),
  rooms: z.record(z.string(), roomDumpSchema),
});

export type ParsedSimSystemSnapshot = SimSystemSnapshot;

export function parseSimSystemSnapshotJson(text: string): SimSystemSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error('parseSimSystemSnapshotJson: invalid JSON');
  }
  const result = simSystemSnapshotSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `parseSimSystemSnapshotJson: ${result.error.issues.map((i) => i.message).join('; ')}`
    );
  }
  return result.data;
}
