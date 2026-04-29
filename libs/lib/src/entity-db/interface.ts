import { assert } from '../assert';

/** Hard caps — Tiger Style: no magic numbers at call sites. */
export const ENTITY_DB_LIMITS = {
  MAX_NAMESPACE_LEN: 256,
  MAX_TYPE_LEN: 256,
  MAX_ID_LEN: 256,
  MAX_IDENTIFIER_LEN: 63,
  MAX_JSON_BYTES: 1_000_000,
  MAX_ROWS_FOR_PK_QUERY: 1,
} as const;

export type EntityKey = { namespace: string; type: string; id: string };

export type Entity<T> = EntityKey & {
  data: T;
  metadata: Record<string, unknown>;
  lastModifiedAt: Date;
};

export type CompareVersions<T> = (incoming: T, existing: T) => -1 | 0 | 1;

export type UpsertArgs<T> = EntityKey & {
  data: T;
  metadata?: Record<string, unknown>;
};

export interface EntityDb<T> {
  upsert(args: UpsertArgs<T>): Promise<{ applied: boolean }>;
  get(key: EntityKey): Promise<Entity<T> | null>;
  delete(key: EntityKey): Promise<void>;
}

function assertNoNulByte(s: string, field: string): void {
  assert.ok(
    !s.includes('\u0000'),
    'entity-db: NUL byte in key field',
    { field }
  );
}

function assertKeyPart(
  value: unknown,
  field: keyof EntityKey,
  maxLen: number
): asserts value is string {
  assert.nonEmptyString(
    value,
    `entity-db: ${field} must be non-empty string`,
    { field }
  );
  assert.ok(
    value.length <= maxLen,
    `entity-db: ${field} exceeds max length`,
    { field, len: value.length, maxLen }
  );
  assertNoNulByte(value, field);
}

export function assertEntityKey(key: EntityKey): void {
  assert.record(key, 'entity-db: key must be a plain object', { key });
  assertKeyPart(key.namespace, 'namespace', ENTITY_DB_LIMITS.MAX_NAMESPACE_LEN);
  assertKeyPart(key.type, 'type', ENTITY_DB_LIMITS.MAX_TYPE_LEN);
  assertKeyPart(key.id, 'id', ENTITY_DB_LIMITS.MAX_ID_LEN);
}

function jsonUtf8ByteLength(value: unknown): number {
  const s = JSON.stringify(value);
  assert.ok(
    s !== undefined,
    'entity-db: value must JSON-serialize (undefined forbidden)',
    { value }
  );
  return new TextEncoder().encode(s).length;
}

export function assertUpsertArgs<T>(args: UpsertArgs<T>): void {
  assertEntityKey(args);
  assert.ok(
    args.data !== undefined,
    'entity-db: upsert data must not be undefined (null is allowed)',
    { namespace: args.namespace, type: args.type, id: args.id }
  );
  const meta = args.metadata ?? {};
  assert.record(meta, 'entity-db: metadata must be a plain object when provided', {
    namespace: args.namespace,
    type: args.type,
    id: args.id,
  });
  const bytes =
    jsonUtf8ByteLength(args.data) + jsonUtf8ByteLength(meta);
  assert.ok(
    bytes <= ENTITY_DB_LIMITS.MAX_JSON_BYTES,
    'entity-db: data + metadata JSON exceeds max byte size',
    {
      namespace: args.namespace,
      type: args.type,
      id: args.id,
      bytes,
      max: ENTITY_DB_LIMITS.MAX_JSON_BYTES,
    }
  );
}

export function assertCompareVersionsResult(
  cmp: number,
  context?: Record<string, unknown>
): asserts cmp is -1 | 0 | 1 {
  assert.ok(
    cmp === -1 || cmp === 0 || cmp === 1,
    'entity-db: compareVersions must return exactly -1, 0, or 1',
    { cmp, ...context }
  );
}
