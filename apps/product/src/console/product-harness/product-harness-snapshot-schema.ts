/**
 * Zod schemas for product-harness ObjectStore snapshots.
 * Server/client SQL blobs are opaque `mixed-pgmm-sqlm` JSON envelopes
 * (mockingbird-postgres PGMM + mockingbird-sqlite SQLM).
 */

import { z } from 'zod';

export const productHarnessSnapshotInfoSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  createdAtMs: z.number().finite(),
  compatible: z.boolean().optional(),
  incompatibleReason: z.string().optional(),
  totalBytes: z.number().finite().nonnegative().optional(),
});

const productHarnessSnapshotManifestLegacyShared = {
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
  /** Optional for legacy sticky snaps; load path defaults by blob magic. */
  sqlFormat: z.enum(['mixed-pgmm-sqlm', 'sqlm', 'sqlite3-image']).optional(),
  keys: z.object({
    serverSql: z.string().min(1),
    clientSql: z.record(z.string(), z.string()),
  }),
} as const;

/** Legacy manifests (pre dynamic-topology). Treated as incompatible at load. */
export const productHarnessSnapshotManifestV1Schema = z.object({
  version: z.literal(1),
  ...productHarnessSnapshotManifestLegacyShared,
});

export const productHarnessSnapshotManifestV2Schema = z.object({
  version: z.literal(2),
  localSchemaVersion: z.number().int(),
  ...productHarnessSnapshotManifestLegacyShared,
});

/** Current: records the API fleet shape alongside the client set. */
export const productHarnessSnapshotManifestV3Schema = z.object({
  version: z.literal(3),
  localSchemaVersion: z.number().int(),
  ...productHarnessSnapshotManifestLegacyShared,
  serverIds: z.array(z.string()),
});

export const productHarnessSnapshotManifestSchema = z.union([
  productHarnessSnapshotManifestV3Schema,
  productHarnessSnapshotManifestV2Schema,
  productHarnessSnapshotManifestV1Schema,
]);

export const productHarnessSnapshotIndexSchema = z.object({
  snapshots: z.array(productHarnessSnapshotInfoSchema),
});

/** mockingbird-sqlite exportDatabaseBytes payload (SQLM envelope). */
function hasSqlmMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x53 &&
    bytes[1] === 0x51 &&
    bytes[2] === 0x4c &&
    bytes[3] === 0x4d
  );
}

/** mockingbird-postgres exportDatabaseBytes payload (PGMM envelope). */
function hasPgmmMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x47 &&
    bytes[2] === 0x4d &&
    bytes[3] === 0x4d
  );
}

function b64HasMagic(
  b64: string,
  hasMagic: (bytes: Uint8Array) => boolean
): boolean {
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return hasMagic(bytes);
  } catch {
    return false;
  }
}

export const productHarnessMockingbirdSqliteDumpSchema = z.object({
  v: z.literal(1),
  kind: z.literal('mockingbird-sqlite'),
  userVersion: z.number().int(),
  sqlmB64: z
    .string()
    .min(1)
    .refine((b64) => b64HasMagic(b64, hasSqlmMagic)),
});

export const productHarnessMockingbirdPostgresDumpSchema = z.object({
  v: z.literal(1),
  kind: z.literal('mockingbird-postgres'),
  pgmmB64: z
    .string()
    .min(1)
    .refine((b64) => b64HasMagic(b64, hasPgmmMagic)),
});

/** Namespaced client KV dump (`dumpNamespacedKvWeb`). */
export const productHarnessClientKvDumpSchema = z.record(
  z.string(),
  z.string()
);

export type ProductHarnessSnapshotIndex = z.infer<
  typeof productHarnessSnapshotIndexSchema
>;
export type ProductHarnessMockingbirdSqliteDump = z.infer<
  typeof productHarnessMockingbirdSqliteDumpSchema
>;
export type ProductHarnessMockingbirdPostgresDump = z.infer<
  typeof productHarnessMockingbirdPostgresDumpSchema
>;
export type ProductHarnessSnapshotManifestParsed = z.infer<
  typeof productHarnessSnapshotManifestSchema
>;

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
