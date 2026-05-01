import { Assert, assert } from '@gamezilla/lib/assert';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';

export type AttributeKey = `${string}/${string}`;

export type PatchInput = {
  entityId: string;
  entityType: string;
  attributes: Record<AttributeKey, unknown>;
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

export type Patch = PatchInput & {
  patchId: string;
  parentId: string | null;
  createdAt: string;
  recordedAt: string;
  createdBy: string;
  sessionId: string;
};

export function assertPatch(a: Assert, p: unknown): asserts p is Patch {
  assertPatchInput(a, p);
  a.field(p, 'patchId', 'patch.patchId must be string');
  a.field(p, 'parentId', 'patch.parentId must be string or null');
  a.field(p, 'createdAt', 'patch.createdAt must be string');
}

/** Attribute keys for patch metadata. Excluded from entity snapshots by implementations. */
export const PATCH_META_KEYS: readonly string[] = [
  'patch/createdBy',
  'patch/sessionId',
  'patch/syncedAt',
] as const;

/**
 * For legacy migration only: maps current metadata attr keys to old metadata column keys.
 * Used when migrating from DBs that stored metadata in a separate column.
 */
export const PATCH_META_LEGACY_KEY_MAP: Record<string, string> = {
  'patch/createdBy': 'createdBy',
  'patch/sessionId': 'sessionId',
  'patch/syncedAt': 'syncedAt',
};

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
  const createdBy =
    ('createdBy' in patch
      ? patch.createdBy
      : patch.attributes['patch/createdBy']) ?? '';
  const sessionId =
    'sessionId' in patch
      ? patch.sessionId
      : patch.attributes['patch/sessionId'];
  const syncedAt = patch.attributes['patch/syncedAt'] ?? null;

  return {
    ...patch.attributes,
    'patch/createdBy': String(createdBy),
    'patch/sessionId':
      sessionId !== null && sessionId !== undefined ? String(sessionId) : '',
    'patch/syncedAt': syncedAt,
  };
}

/**
 * Extracts Patch top-level fields from stored attributes.
 * Implementations should use this instead of interpreting metadata keys.
 */
export function getPatchTopLevelFromAttributes(
  attrs: Record<string, unknown>
): Pick<Patch, 'createdBy' | 'sessionId'> {
  const createdBy = attrs['patch/createdBy'];
  const sessionId = attrs['patch/sessionId'];
  return {
    createdBy: String(createdBy ?? ''),
    sessionId:
      sessionId !== null && sessionId !== undefined ? String(sessionId) : '',
  };
}

export type Entity = {
  entityId: string;
  entityType: string;
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

/** Clojure-style namespaced key; no whitespace allowed. */
const ATTRIBUTE_REGEX =
  /^(?!.*\s)[a-zA-Z_][a-zA-Z0-9_.]*\/[a-zA-Z_][a-zA-Z0-9_.]*$/;

/** Returns true if the key is a valid namespaced attribute. Use when reading stored data that may be stale. */
export function isValidAttribute(key: unknown): key is string {
  return typeof key === 'string' && ATTRIBUTE_REGEX.test(key);
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

/** Asserts entityType is sufficient for global uniqueness (with entityId): non-empty, no null bytes, no trim loss. */
export function assertEntityType(
  t: unknown,
  a: Assert = assert
): asserts t is string {
  a.string(t, 'entityType must be string');
  a.ok(t.length > 0, 'entityType must be non-empty');
  a.ok(t.length <= ID_MAX_LEN, 'entityType must not exceed 1024 chars');
  a.ok(!t.includes('\0'), 'entityType must not contain null byte');
  a.ok(t === t.trim(), 'entityType must not have leading/trailing whitespace');
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
 * Valid: Clojure-style namespaced keys (e.g. "todo/title", "patch/syncedAt").
 * @param attribute - The attribute to sanitize.
 * @returns The sanitized attribute.
 */
export function assertAttribute(
  attribute: unknown,
  a: Assert = assert
): asserts attribute is string {
  a.string(attribute, 'Invalid attribute name — must be a string');
  a.ok(
    ATTRIBUTE_REGEX.test(attribute),
    'Invalid attribute name — must be a Clojure-style namespaced key'
  );
}
assertAttribute('todo/title');
assertAttribute('my.namespace/attr');
assertAttribute('todo.title/sub');

export function assertAttributes(
  attributes: Record<string, unknown>,
  a: Assert = assert
): asserts attributes is Record<string, unknown> {
  for (const key of Object.keys(attributes)) {
    assertAttribute(key, a);
  }
}

export type PatchesDbQueryWhereClause =
  | {
      type: '=';
      attribute: string;
      value: unknown;
    }
  | {
      type: '!=';
      attribute: string;
      value: unknown;
    }
  | {
      type: 'in';
      attribute: string;
      values: unknown[];
    }
  | {
      type: 'not_in';
      attribute: string;
      values: unknown[];
    }
  | {
      type: 'gt';
      attribute: string;
      value: unknown;
    }
  | {
      type: 'gte';
      attribute: string;
      value: unknown;
    }
  | {
      type: 'lt';
      attribute: string;
      value: unknown;
    }
  | {
      type: 'lte';
      attribute: string;
      value: unknown;
    }
  | {
      type: 'contains';
      attribute: string;
      value: string;
    }
  | {
      type: 'exists';
      attribute: string;
    }
  | {
      type: 'not_exists';
      attribute: string;
    }
  | {
      type: 'or';
      clauses: PatchesDbQueryWhereClause[];
    }
  | {
      type: 'and';
      clauses: PatchesDbQueryWhereClause[];
    }
  | {
      type: 'not';
      clause: PatchesDbQueryWhereClause;
    };

export type Direction = 'asc' | 'desc';

export function assertDirection(
  direction: unknown,
  a: Assert = assert
): asserts direction is Direction {
  a.enum<Direction>(direction, ['asc', 'desc'], 'Invalid direction');
}

export type PatchesDbQueryOrderBy = {
  attribute: string;
  direction: 'asc' | 'desc';
};

export type PatchesDbQuery = {
  entityType?: string;
  entityId?: string | string[];
  where?: PatchesDbQueryWhereClause;
  orderBy?: PatchesDbQueryOrderBy[];
  limit?: number;
  offset?: number;
  after?: string;
  knownPatches?: Patch[];
  /** Lightweight alternative to knownPatches for wire protocol — just patch IDs. */
  knownPatchIds?: string[];
  on?: 'patches' | 'entities';
};

export function assertQuery(
  a: Assert,
  q: unknown
): asserts q is PatchesDbQuery {
  a.record(q, 'Each query must be an object');
  const query = q as Record<string, unknown>;
  if (query['entityType'] !== undefined) {
    a.string(query['entityType'], 'query.entityType must be string');
  }
  if (query['knownPatchIds'] !== undefined) {
    a.array(query['knownPatchIds'], 'query.knownPatchIds must be array');
  }
}

/** Strips knownPatches/knownPatchIds from a query for wire responses. */
export function stripKnownPatchesFromQuery(
  query: PatchesDbQuery
): PatchesDbQuery {
  const { knownPatches, knownPatchIds, ...rest } = query;
  return rest;
}

export type PatchesDbResult = {
  query: PatchesDbQuery;
  entities: Entity[];
  patches: Patch[];
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
};

/** Unsubscribe from a hook registration. */
export type Unsubscribe = () => void;

/**
 * Authenticated caller identifier. Only `principalId` is required by the
 * library; consuming apps extend via intersection to carry their own claims
 * (e.g. `accountId`, group memberships) into their visibility policies.
 */
export type PatchesDbAuthContext = {
  readonly principalId: string;
  readonly [claim: string]: unknown;
};

/**
 * System / simulation / migration — bypasses any hook-based ABAC checks.
 * `reason` is a free-form string so apps can tag privileged contexts
 * (e.g. `'stripe-webhook'`) without modifying the library.
 */
export type PatchesDbSystemContext = {
  principalId: null;
  reason: string;
};

export type PatchesDbContext = PatchesDbAuthContext | PatchesDbSystemContext;

/** Default for local-first client DB, tests, and in-process sim — no ABAC filtering. */
export const OPEN_PATCHES_DB_CONTEXT: PatchesDbSystemContext = {
  principalId: null,
  reason: 'sim',
};

/** Server-side privileged operations (auth claim, session resolution bootstrap). */
export const PATCHES_DB_SYSTEM_CONTEXT: PatchesDbSystemContext = {
  principalId: null,
  reason: 'system',
};

export function isPatchesDbSystemContext(
  ctx: PatchesDbContext
): ctx is PatchesDbSystemContext {
  return ctx.principalId === null;
}

export function isPatchesDbAuthContext(
  ctx: PatchesDbContext
): ctx is PatchesDbAuthContext {
  return ctx.principalId !== null;
}

/** AND-combines an optional existing where-clause with an additional clause. */
export function andWhereClause(
  existing: PatchesDbQueryWhereClause | undefined,
  clause: PatchesDbQueryWhereClause
): PatchesDbQueryWhereClause {
  if (existing === undefined) return clause;
  return { type: 'and', clauses: [existing, clause] };
}

/**
 * Read predicate that is always true for snapshot/patch JSON attribute queries.
 * (Every stored patch has `patch/createdBy` after normalization.)
 */
export const READ_WHERE_ALWAYS_TRUE: PatchesDbQueryWhereClause = {
  type: 'or',
  clauses: [
    { type: 'exists', attribute: 'patch/createdBy' },
    { type: 'not_exists', attribute: 'patch/createdBy' },
  ],
};

/** Deny all rows for this query without breaking SQL (limit 0). */
export function denyAllReadsQuery(query: PatchesDbQuery): PatchesDbQuery {
  const out: PatchesDbQuery = { ...query, limit: 0 };
  delete (out as { offset?: number }).offset;
  return out;
}

export type PatchesDbCompactionResult = {
  removedPatchIds: string[];
  compactionPatchId: string | null;
};

export type PatchesDbCompaction = {
  compactEntity(
    key: { entityId: string; entityType: string },
    options: { keepLatest: number },
    ctx: PatchesDbContext
  ): Promise<PatchesDbCompactionResult>;

  compactAll(
    options: { keepLatest?: number; entityType?: string },
    ctx: PatchesDbContext
  ): Promise<{ entitiesCompacted: number }>;
};

export type PatchesDbHooks = {
  beforeRead(
    fn: (
      query: PatchesDbQuery,
      ctx: PatchesDbContext
    ) => PatchesDbQuery | Promise<PatchesDbQuery>
  ): Unsubscribe;

  beforeWrite(
    fn: (
      patches: PatchInput[],
      ctx: PatchesDbContext,
      tx: SqlClient
    ) => PatchInput[] | Promise<PatchInput[]>
  ): Unsubscribe;

  afterWrite(
    fn: (
      written: Patch[],
      ctx: PatchesDbContext,
      tx: SqlClient
    ) => void | Promise<void>
  ): Unsubscribe;
};

/** Query side of {@link PatchesDb}; contract varies by implementation (local read vs sync merge-then-read). */
export type PatchesDbRead = {
  read(
    queries: PatchesDbQuery[],
    ctx?: PatchesDbContext
  ): Promise<PatchesDbResult[]>;
};

/** Write side of {@link PatchesDb}; contract varies by implementation (local persist vs sync + invalidation). */
export type PatchesDbWrite = {
  write(patches: PatchInput[], ctx?: PatchesDbContext): Promise<Patch[]>;
};

/** Update side of {@link PatchesDb}; contract varies by implementation (local persist vs sync + invalidation). */
export type PatchesDbUpdate = {
  update(
    updates: { patchId: string; attributes: Record<string, unknown> }[],
    ctx?: PatchesDbContext
  ): Promise<void>;
};

export type PatchesDb = PatchesDbRead &
  PatchesDbWrite &
  PatchesDbUpdate & {
    readonly hooks: PatchesDbHooks;
    readonly compaction: PatchesDbCompaction;
  };

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
  compactionPolicy?: import('./policy/compaction-policy').PatchDbCompactionPolicyResolver;
};

function patchInputId(p: PatchInput): string | undefined {
  const r = p as Record<string, unknown>;
  return typeof r['patchId'] === 'string' ? r['patchId'] : undefined;
}

function patchInputParentId(p: PatchInput): string | undefined {
  const r = p as Record<string, unknown>;
  return typeof r['parentId'] === 'string' ? r['parentId'] : undefined;
}

function topologicalSortPatchesImpl(patches: PatchInput[]): PatchInput[] {
  const batchIds = new Set<string>();
  for (const p of patches) {
    const id = patchInputId(p);
    if (id !== undefined) batchIds.add(id);
  }

  const hasIntraBatchDeps = patches.some((p) => {
    const pid = patchInputParentId(p);
    return pid !== undefined && batchIds.has(pid);
  });
  if (!hasIntraBatchDeps) return patches;

  const byId = new Map<string, PatchInput>();
  for (const p of patches) {
    const id = patchInputId(p);
    if (id !== undefined) byId.set(id, p);
  }

  const sorted: PatchInput[] = [];
  const visited = new Set<string>();

  function visit(p: PatchInput): void {
    const id = patchInputId(p);
    if (id !== undefined && visited.has(id)) return;
    if (id !== undefined) visited.add(id);

    const pid = patchInputParentId(p);
    if (pid !== undefined && byId.has(pid) && !visited.has(pid)) {
      visit(byId.get(pid)!);
    }
    sorted.push(p);
  }

  for (const p of patches) visit(p);
  return sorted;
}

/**
 * Topologically sorts patches so that a patch's parent (if also in the batch)
 * is always inserted before its child. Prevents FK violations when the wire
 * order is arbitrary.
 *
 * Invariant: output is a permutation of input — same length, same elements,
 * only the order changes. Patches without intra-batch parent references keep
 * their relative order (stable for the common case of no dependencies).
 */
export const topologicalSortPatches = assert.fn(
  {
    fn: topologicalSortPatchesImpl,

    pre(patches: PatchInput[]) {
      assert.array(patches, 'topologicalSortPatches: input must be an array');
      assert.ok(
        patches.length > 0,
        'topologicalSortPatches: input must not be empty',
        { length: patches.length }
      );
    },

    post(sorted: PatchInput[]) {
      assert.array(sorted, 'topologicalSortPatches: output must be an array');
      assert.ok(
        sorted.length > 0,
        'topologicalSortPatches: output must not be empty',
        { length: sorted.length }
      );
      const batchIds = new Set<string>();
      for (const p of sorted) {
        const id = patchInputId(p);
        if (id !== undefined) batchIds.add(id);
      }
      const emitted = new Set<string>();
      for (let i = 0; i < sorted.length; i++) {
        const p = sorted[i];
        assert.defined(p, 'topologicalSortPatches: element must be defined', {
          i,
        });
        const pid = patchInputParentId(p);
        assert.ok(
          pid === undefined || !batchIds.has(pid) || emitted.has(pid),
          'topologicalSortPatches: parent must precede child in output',
          { i, pid }
        );
        const id = patchInputId(p);
        if (id !== undefined) emitted.add(id);
      }
    },
  },
  'topologicalSortPatches'
);
