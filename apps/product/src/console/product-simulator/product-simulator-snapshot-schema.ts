/**
 * Zod schemas for product-simulator ObjectStore snapshots.
 * Server/client SQL blobs are opaque `mixed-pgmm-sqlm` JSON envelopes
 * (mockingbird-postgres PGMM + mockingbird-sqlite SQLM).
 */

import { z } from 'zod';

export const productSimulatorSnapshotInfoSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  createdAtMs: z.number().finite(),
  compatible: z.boolean().optional(),
  incompatibleReason: z.string().optional(),
  totalBytes: z.number().finite().nonnegative().optional(),
});

const productSimulatorSnapshotManifestLegacyShared = {
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
export const productSimulatorSnapshotManifestV1Schema = z.object({
  version: z.literal(1),
  ...productSimulatorSnapshotManifestLegacyShared,
});

export const productSimulatorSnapshotManifestV2Schema = z.object({
  version: z.literal(2),
  localSchemaVersion: z.number().int(),
  ...productSimulatorSnapshotManifestLegacyShared,
});

/** Current: records the API fleet shape alongside the client set. */
export const productSimulatorSnapshotManifestV3Schema = z.object({
  version: z.literal(3),
  localSchemaVersion: z.number().int(),
  ...productSimulatorSnapshotManifestLegacyShared,
  serverIds: z.array(z.string()),
});

export const productSimulatorSnapshotManifestSchema = z.union([
  productSimulatorSnapshotManifestV3Schema,
  productSimulatorSnapshotManifestV2Schema,
  productSimulatorSnapshotManifestV1Schema,
]);

export const productSimulatorSnapshotIndexSchema = z.object({
  snapshots: z.array(productSimulatorSnapshotInfoSchema),
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

export const productSimulatorMockingbirdSqliteDumpSchema = z.object({
  v: z.literal(1),
  kind: z.literal('mockingbird-sqlite'),
  userVersion: z.number().int(),
  sqlmB64: z
    .string()
    .min(1)
    .refine((b64) => b64HasMagic(b64, hasSqlmMagic)),
});

export const productSimulatorMockingbirdPostgresDumpSchema = z.object({
  v: z.literal(1),
  kind: z.literal('mockingbird-postgres'),
  pgmmB64: z
    .string()
    .min(1)
    .refine((b64) => b64HasMagic(b64, hasPgmmMagic)),
});

/** Namespaced client KV dump (`dumpNamespacedKvWeb`). */
export const productSimulatorClientKvDumpSchema = z.record(
  z.string(),
  z.string()
);

export type ProductSimulatorSnapshotIndex = z.infer<
  typeof productSimulatorSnapshotIndexSchema
>;
export type ProductSimulatorMockingbirdSqliteDump = z.infer<
  typeof productSimulatorMockingbirdSqliteDumpSchema
>;
export type ProductSimulatorMockingbirdPostgresDump = z.infer<
  typeof productSimulatorMockingbirdPostgresDumpSchema
>;
export type ProductSimulatorSnapshotManifestParsed = z.infer<
  typeof productSimulatorSnapshotManifestSchema
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
