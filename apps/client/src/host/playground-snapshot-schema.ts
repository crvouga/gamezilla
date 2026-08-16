/**
 * Zod schemas for playground ObjectStore snapshots (AlaSQL JSON dumps).
 */

import { z } from 'zod';

export const playgroundSnapshotInfoSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  createdAtMs: z.number().finite(),
});

export const playgroundSnapshotManifestSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  label: z.string().min(1),
  createdAtMs: z.number().finite(),
  clockMs: z.number().finite(),
  clockPaused: z.boolean(),
  clientIds: z.array(z.string()),
  roomTopics: z.array(z.string()),
  partitions: z.array(z.string()),
  skewByAddress: z.record(z.string(), z.number()),
  downAddresses: z.array(z.string()),
  evictedAddresses: z.array(z.string()),
  keys: z.object({
    serverSql: z.string().min(1),
    clientSql: z.record(z.string(), z.string()),
  }),
});

export const playgroundSnapshotIndexSchema = z.object({
  snapshots: z.array(playgroundSnapshotInfoSchema),
});

/** AlaSQL {@link SqlClientImplAlaSql.exportDatabaseBytes} payload. */
export const playgroundAlaSqlDumpSchema = z.object({
  v: z.literal(1),
  kind: z.literal('alasql'),
  userVersion: z.number().int(),
  indexes: z.array(
    z.tuple([
      z.string(),
      z.object({
        table: z.string(),
        columns: z.array(z.string()),
        unique: z.boolean(),
      }),
    ])
  ),
  tables: z.record(z.string(), z.unknown()),
});

/** Namespaced client KV dump (`dumpNamespacedKvWeb`). */
export const playgroundClientKvDumpSchema = z.record(z.string(), z.string());

export type PlaygroundSnapshotIndex = z.infer<
  typeof playgroundSnapshotIndexSchema
>;
export type PlaygroundAlaSqlDump = z.infer<typeof playgroundAlaSqlDumpSchema>;

export function parseJsonWithSchema<T>(
  text: string,
  schema: z.ZodType<T>
): T | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return null;
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function parseJsonBytesWithSchema<T>(
  bytes: Uint8Array,
  schema: z.ZodType<T>
): T | null {
  return parseJsonWithSchema(new TextDecoder().decode(bytes), schema);
}
