import type { Assert } from '@gamezilla/lib/assert';
import { assert } from '@gamezilla/lib/assert';
import type { Keyword } from '@gamezilla/lib/keyword';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import {
  isClojureNamespacedKey,
  isClojureNamespacePrefix,
} from './attribute-key';
import type { PatchDbContext } from './context';
import type { PatchDbCompactionPolicyResolver } from './policy/compaction-policy';
import { PatchMetaAttr } from './metadata/patch-metadata';

/**
 * Branded namespaced key for queries and {@link AttributeTag} APIs.
 * Patch / entity attribute maps are `Record<string, unknown>` (runtime-validated via {@link assertAttribute}).
 */
export type AttributeKey = Keyword;

/**
 * Dot-separated kebab namespace for {@link PatchInput.entityType} / {@link PatchDbQuery.entityType}
 * (same grammar as an attribute key’s namespace prefix; no `/`).
 */
export type PatchEntityType = Keyword;

export type PatchInput = {
  entityId: string;
  /** Dot-kebab namespace segments only (e.g. `todo`, `todo-list`, `chess.puzzle`). */
  entityType: PatchEntityType;
  /** Keys validated at write time by {@link assertPatchInput} / {@link assertAttribute}. */
  attributes: Record<string, unknown>;
  /** When set, storage uses this id instead of generating one (e.g. synced patches). */
  patchId?: string;
  /**
   * With `patchId`: client parent for synced patches; impl re-anchors to chain
   * leaf when that parent is missing on server (see `resolveWriteParentId`).
   */
  parentId?: string | null;
  createdAt?: string;
  recordedAt?: string;
  createdBy?: string;
  sessionId?: string;
};

export type Patch = PatchInput & {
  patchId: string;
  parentId: string | null;
  createdAt: string;
  recordedAt: string;
  createdBy: string;
  sessionId: string;
};

/** Per-patch rejection from {@link PatchDb.write} (e.g. ABAC). */
export type PatchRejectionReason = {
  patchId: string;
  /** Machine-readable, e.g. `forbidden`, `unknown_entity_type`. */
  code: string;
  /** Human-readable; keep short for `patch/sync-rejected-reason` storage. */
  reason: string;
  /**
   * Echo of the rejected patch input when the producer attaches it (e.g. wire
   * `/patches/write` for debugging). Omitted in some in-process paths.
   */
  patch?: PatchInput;
};

export type WritePatchesResult = {
  accepted: Patch[];
  rejected: PatchRejectionReason[];
};

export function assertPatchInput(
  a: Assert,
  p: unknown
): asserts p is PatchInput {
  a.record(p, 'Each patch must be an object');
  a.field(p, 'entityId', 'patch.entityId must be string');
  a.field(p, 'entityType', 'patch.entityType must be string');
  assertEntityKey(p['entityId'], p['entityType'], a);
  if (p['patchId'] !== undefined) {
    assertPatchId(p['patchId'], a);
  }
  if (p['parentId'] !== undefined && p['parentId'] !== null) {
    assertPatchId(p['parentId'], a);
  }
  if (p['createdAt'] !== undefined) {
    a.string(p['createdAt'], 'patch.createdAt must be string');
  }
  if (p['recordedAt'] !== undefined) {
    a.string(p['recordedAt'], 'patch.recordedAt must be string');
  }
  a.record(p['attributes'], 'patch.attributes must be object');
  for (const key of Object.keys(p['attributes'] as Record<string, unknown>)) {
    assertAttribute(key, a);
  }
}

/** Wire `/patches/write` requires stable `patchId` on every patch for partial reject. */
export function assertWirePatchInput(
  a: Assert,
  p: unknown
): asserts p is PatchInput & { patchId: string } {
  assertPatchInput(a, p);
  a.field(p, 'patchId', 'wire patch.patchId is required');
  assertPatchId(p['patchId'], a);
}

export function assertPatch(a: Assert, p: unknown): asserts p is Patch {
  assertPatchInput(a, p);
  a.field(p, 'patchId', 'patch.patchId must be string');
  a.field(p, 'parentId', 'patch.parentId must be string or null');
  a.field(p, 'createdAt', 'patch.createdAt must be string');
}

export {
  isSyncRejectedPatchAttributes,
  PatchMetaAttr,
  PATCH_CREATED_BY_ID,
  PATCH_META_KEYS,
  PATCH_REJECTED,
  PATCH_SESSION_ID,
  PATCH_SYNC_REJECTED_AT,
  PATCH_SYNC_REJECTED_REASON,
  PATCH_SYNCED_AT,
} from './metadata/patch-metadata';

type PatchInputWithOptionalMeta = PatchInput &
  Partial<Record<'createdBy' | 'sessionId', unknown>>;

/**
 * Normalizes patch input into attributes for storage.
 * Merges optional top-level createdBy/sessionId into attributes.
 * Implementations should use this instead of interpreting metadata keys.
 */
export function normalizePatchAttributesForStorage(
  patch: PatchInputWithOptionalMeta
): Record<string, unknown> {
  const attrs = patch.attributes as Record<string, unknown>;
  const createdBy =
    ('createdBy' in patch
      ? patch.createdBy
      : attrs[PatchMetaAttr.createdById.key]) ?? '';
  const sessionId =
    'sessionId' in patch
      ? patch.sessionId
      : patch.attributes[PatchMetaAttr.sessionId.key];
  const syncedAt = patch.attributes[PatchMetaAttr.syncedAt.key] ?? null;

  return {
    ...patch.attributes,
    ...PatchMetaAttr.createdById(String(createdBy)),
    ...PatchMetaAttr.sessionId(
      sessionId !== null && sessionId !== undefined ? String(sessionId) : ''
    ),
    ...PatchMetaAttr.syncedAt(syncedAt),
  };
}

/**
 * Extracts Patch top-level fields from stored attributes.
 * Implementations should use this instead of interpreting metadata keys.
 */
export function getPatchTopLevelFromAttributes(
  attrs: Record<string, unknown>
): Pick<Patch, 'createdBy' | 'sessionId'> {
  const createdBy = attrs[PatchMetaAttr.createdById.key];
  const sessionId = attrs[PatchMetaAttr.sessionId.key];
  return {
    createdBy: String(createdBy ?? ''),
    sessionId:
      sessionId !== null && sessionId !== undefined ? String(sessionId) : '',
  };
}

export type Entity = {
  entityId: string;
  entityType: PatchEntityType;
  attributes: Record<string, unknown>;
};

export function assertEntity(
  e: unknown,
  a: Assert = assert
): asserts e is Entity {
  a.record(e, 'Each entity must be an object');
  a.field(e, 'entityId', 'entity.entityId must be string');
  a.field(e, 'entityType', 'entity.entityType must be string');
  assertEntityKey(e['entityId'], e['entityType'], a);
}

export type Attribute = string & { __brand: 'attribute' };

/** Returns true if the key is a valid namespaced attribute. Use when reading stored data that may be stale. */
export function isValidAttribute(key: unknown): key is string {
  return isClojureNamespacedKey(key);
}

const ID_MAX_LEN = 1024;

/** Asserts patchId is sufficient for global uniqueness: non-empty, no null bytes, no trim loss, min length. */
export function assertPatchId(
  id: unknown,
  a: Assert = assert
): asserts id is string {
  a.string(id, 'patchId must be string');
  a.ok(id.length > 0, 'patchId must be non-empty');
  a.ok(id.length <= ID_MAX_LEN, 'patchId must not exceed 1024 chars');
  a.ok(!id.includes('\0'), 'patchId must not contain null byte');
  a.ok(id === id.trim(), 'patchId must not have leading/trailing whitespace');
  a.ok(
    id.length >= 8,
    'patchId must be at least 8 chars for global uniqueness',
    { id }
  );
}

/** Asserts entityId is sufficient for global uniqueness (with entityType): non-empty, no null bytes, no trim loss. */
export function assertEntityId(
  id: unknown,
  a: Assert = assert
): asserts id is string {
  a.string(id, 'entityId must be string');
  a.ok(id.length > 0, 'entityId must be non-empty');
  a.ok(id.length <= ID_MAX_LEN, 'entityId must not exceed 1024 chars');
  a.ok(!id.includes('\0'), 'entityId must not contain null byte');
  a.ok(id === id.trim(), 'entityId must not have leading/trailing whitespace');
}

/** Asserts entityType is sufficient for global uniqueness (with entityId): non-empty, no null bytes, no trim loss, dot-kebab namespace. */
export function assertEntityType(
  t: unknown,
  a: Assert = assert
): asserts t is PatchEntityType {
  a.string(t, 'entityType must be string');
  a.ok(t.length > 0, 'entityType must be non-empty');
  a.ok(t.length <= ID_MAX_LEN, 'entityType must not exceed 1024 chars');
  a.ok(!t.includes('\0'), 'entityType must not contain null byte');
  a.ok(t === t.trim(), 'entityType must not have leading/trailing whitespace');
  a.ok(
    isClojureNamespacePrefix(t),
    'entityType must be a dot-separated kebab namespace (e.g. todo, todo-list, chess.puzzle)'
  );
}

/** Asserts entity key (entityId + entityType) is sufficient for global uniqueness. */
export function assertEntityKey(
  entityId: unknown,
  entityType: unknown,
  a?: Assert
): asserts entityId is string {
  assertEntityId(entityId, a);
  assertEntityType(entityType, a);
}
/**
 * Sanitizes an attribute name to ensure it follows Clojure-style namespaced key conventions.
 * Valid: Clojure-style kebab-case namespaced keys (e.g. "todo/title", "patch/synced-at").
 * @param attribute - The attribute to sanitize.
 * @returns The sanitized attribute.
 */
export function assertAttribute(
  attribute: unknown,
  a: Assert = assert
): asserts attribute is string {
  a.string(attribute, 'Invalid attribute name — must be a string');
  a.ok(
    isClojureNamespacedKey(attribute),
    'Invalid attribute name — must be a Clojure-style namespaced key'
  );
}

/**
 * Validates and returns the PatchDB namespaced key for SQL builders.
 */
export function patchDbAttributeKey(
  attribute: string | null | undefined
): string {
  assert.ok(
    attribute !== null && attribute !== undefined && attribute !== '',
    'query clause attribute is required'
  );
  assertAttribute(attribute);
  return attribute;
}

export function assertAttributes(
  attributes: Record<string, unknown>,
  a: Assert = assert
): asserts attributes is Record<string, unknown> {
  for (const key of Object.keys(attributes)) {
    assertAttribute(key, a);
  }
}

export type PatchDbQueryWhereClause =
  | {
      type: '=';
      attribute: AttributeKey;
      value: unknown;
    }
  | {
      type: '!=';
      attribute: AttributeKey;
      value: unknown;
    }
  | {
      type: 'in';
      attribute: AttributeKey;
      values: unknown[];
    }
  | {
      type: 'not_in';
      attribute: AttributeKey;
      values: unknown[];
    }
  | {
      type: 'gt';
      attribute: AttributeKey;
      value: unknown;
    }
  | {
      type: 'gte';
      attribute: AttributeKey;
      value: unknown;
    }
  | {
      type: 'lt';
      attribute: AttributeKey;
      value: unknown;
    }
  | {
      type: 'lte';
      attribute: AttributeKey;
      value: unknown;
    }
  | {
      type: 'contains';
      attribute: AttributeKey;
      value: string;
    }
  | {
      type: 'exists';
      attribute: AttributeKey;
    }
  | {
      type: 'not_exists';
      attribute: AttributeKey;
    }
  | {
      type: 'or';
      clauses: PatchDbQueryWhereClause[];
    }
  | {
      type: 'and';
      clauses: PatchDbQueryWhereClause[];
    }
  | {
      type: 'not';
      clause: PatchDbQueryWhereClause;
    };

export type Direction = 'asc' | 'desc';

export function assertDirection(
  direction: unknown,
  a: Assert = assert
): asserts direction is Direction {
  a.enum<Direction>(direction, ['asc', 'desc'], 'Invalid direction');
}

export type PatchDbQueryOrderBy = {
  attribute: AttributeKey;
  direction: 'asc' | 'desc';
};

export type PatchDbQuery = {
  /** When set: same grammar as {@link PatchEntityType}. */
  entityType?: PatchEntityType;
  entityId?: string | string[] | null;
  where?: PatchDbQueryWhereClause;
  orderBy?: PatchDbQueryOrderBy[];
  limit?: number;
  offset?: number;
  after?: string;
  knownPatches?: Patch[];
  /** Lightweight alternative to knownPatches for wire protocol — just patch IDs. */
  knownPatchIds?: string[];
  on?: 'patches' | 'entities';
};

export function assertQuery(a: Assert, q: unknown): asserts q is PatchDbQuery {
  a.record(q, 'Each query must be an object');
  const query = q as Record<string, unknown>;
  if (query['entityType'] !== undefined && query['entityType'] !== null) {
    assertEntityType(query['entityType'], a);
  }
  if (query['knownPatchIds'] !== undefined) {
    a.array(query['knownPatchIds'], 'query.knownPatchIds must be array');
  }
}

/** Strips knownPatches/knownPatchIds from a query for wire responses. */
export function stripKnownPatchesFromQuery(query: PatchDbQuery): PatchDbQuery {
  const {
    knownPatches: _knownPatches,
    knownPatchIds: _knownPatchIds,
    ...rest
  } = query;
  return rest;
}

export type PatchDbResult = {
  query: PatchDbQuery;
  entities: Entity[];
  patches: Patch[];
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
};

/** Unsubscribe from a hook registration. */
export type Unsubscribe = () => void;

export {
  isPatchDbAuthContext,
  isPatchDbClientContext,
  isPatchDbSystemContext,
  OPEN_PATCHES_DB_CONTEXT,
  PATCHES_DB_SYSTEM_CONTEXT,
} from './context';
export type {
  PatchDbAuthContext,
  PatchDbClientContext,
  PatchDbContext,
  PatchDbSystemContext,
} from './context';

/** AND-combines an optional existing where-clause with an additional clause. */
export function andWhereClause(
  existing: PatchDbQueryWhereClause | undefined,
  clause: PatchDbQueryWhereClause
): PatchDbQueryWhereClause {
  if (existing === undefined) return clause;
  return { type: 'and', clauses: [existing, clause] };
}

/**
 * Read predicate that is always true for snapshot/patch JSON attribute queries.
 * (Every stored patch has `patch/created-by-id` after normalization.)
 */
export const READ_WHERE_ALWAYS_TRUE: PatchDbQueryWhereClause = {
  type: 'or',
  clauses: [
    { type: 'exists', attribute: PatchMetaAttr.createdById.key },
    { type: 'not_exists', attribute: PatchMetaAttr.createdById.key },
  ],
};

/**
 * Read predicate that is always false. Use from a visibility policy's `read`
 * to deny a context (e.g. unauthenticated clients on a private entity type) while keeping
 * a single read function instead of a separate client-only branch.
 */
export const READ_WHERE_NEVER_TRUE: PatchDbQueryWhereClause = {
  type: 'and',
  clauses: [
    { type: 'exists', attribute: PatchMetaAttr.createdById.key },
    { type: 'not_exists', attribute: PatchMetaAttr.createdById.key },
  ],
};

/** Deny all rows for this query without breaking SQL (limit 0). */
export function denyAllReadsQuery(query: PatchDbQuery): PatchDbQuery {
  const out: PatchDbQuery = { ...query, limit: 0 };
  delete (out as { offset?: number }).offset;
  return out;
}

export type PatchDbCompactionResult = {
  removedPatchIds: string[];
  compactionPatchId: string | null;
};

export type PatchDbCompaction = {
  compactEntity(
    key: { entityId: string; entityType: string },
    options: { keepLatest: number },
    ctx: PatchDbContext
  ): Promise<PatchDbCompactionResult>;

  compactAll(
    options: { keepLatest?: number; entityType?: string },
    ctx: PatchDbContext
  ): Promise<{ entitiesCompacted: number }>;
};

/** Return value for {@link PatchDbHooks.beforeWrite} — partition or pass-through array. */
export type PatchDbBeforeWriteHookResult =
  | PatchInput[]
  | { accepted: PatchInput[]; rejected: PatchRejectionReason[] };

export type PatchDbHooks = {
  beforeRead(
    fn: (
      query: PatchDbQuery,
      ctx: PatchDbContext
    ) => PatchDbQuery | Promise<PatchDbQuery>
  ): Unsubscribe;

  beforeWrite(
    fn: (
      patches: PatchInput[],
      ctx: PatchDbContext,
      tx: SqlClient
    ) => PatchDbBeforeWriteHookResult | Promise<PatchDbBeforeWriteHookResult>
  ): Unsubscribe;

  afterWrite(
    fn: (
      written: Patch[],
      ctx: PatchDbContext,
      tx: SqlClient
    ) => void | Promise<void>
  ): Unsubscribe;
};

/** Query side of {@link PatchDb}; contract varies by implementation (local read vs sync merge-then-read). */
export type PatchDbRead = {
  read(queries: PatchDbQuery[], ctx?: PatchDbContext): Promise<PatchDbResult[]>;
};

/** Write side of {@link PatchDb}; contract varies by implementation (local persist vs sync + invalidation). */
export type PatchDbWrite = {
  write(
    patches: PatchInput[],
    ctx?: PatchDbContext
  ): Promise<WritePatchesResult>;
};

/** Update side of {@link PatchDb}; contract varies by implementation (local persist vs sync + invalidation). */
export type PatchDbUpdate = {
  update(
    updates: { patchId: string; attributes: Record<string, unknown> }[],
    ctx?: PatchDbContext
  ): Promise<void>;
};

export type PatchDb = PatchDbRead &
  PatchDbWrite &
  PatchDbUpdate & {
    readonly hooks: PatchDbHooks;
    readonly compaction: PatchDbCompaction;
  };

/** Concrete {@link PatchDb} or resolver (e.g. request-scoped via AsyncLocalStorage). */
export type PatchDbResolvable = PatchDb | (() => PatchDb);

/** Shared options for SQLite / Postgres patch-db implementations. */
export type PatchDbEngineOptions = {
  /** When true, compacts chains after writes when length exceeds keepLatest + slack. */
  autoCompactOnWrite?: boolean;
  /** Extra headroom before auto-compaction runs. Default 2. */
  compactionSlack?: number;
  /**
   * Resolves the compaction policy for a given entity type. When omitted,
   * every entity uses {@link DEFAULT_PATCH_DB_COMPACTION_POLICY} (`keepLatest: 2`).
   * Apps typically pass {@link PatchDbCompactionPolicyRegistry.resolve}.
   */
  compactionPolicy?: PatchDbCompactionPolicyResolver;
};
