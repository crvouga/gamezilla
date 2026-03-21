import { assert } from '../assert';

export type PatchInput = {
  entityId: string;
  entityType: string;
  attributes: Record<string, unknown>;
};

export type Patch = PatchInput & {
  patchId: string;
  parentId: string | null;
  createdAt: string;
  recordedAt: string;
  createdBy: string;
  sessionId: string;
};

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
    ('createdBy' in patch ? patch.createdBy : patch.attributes['patch/createdBy']) ?? '';
  const sessionId =
    'sessionId' in patch ? patch.sessionId : patch.attributes['patch/sessionId'];
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

export type Attribute = string & { __brand: 'attribute' };

/** Clojure-style namespaced key; no whitespace allowed. */
const ATTRIBUTE_REGEX =
  /^(?!.*\s)[a-zA-Z_][a-zA-Z0-9_.]*\/[a-zA-Z_][a-zA-Z0-9_.]*$/;
/**
 * Sanitizes an attribute name to ensure it follows Clojure-style namespaced key conventions.
 * Valid: Clojure-style namespaced keys (e.g. "todo/title", "patch/syncedAt").
 * @param attribute - The attribute to sanitize.
 * @returns The sanitized attribute.
 */
export function assertAttribute(
  attribute: unknown
): asserts attribute is string {
  assert(
    typeof attribute === 'string',
    'Invalid attribute name — must be a string'
  );
  assert(
    ATTRIBUTE_REGEX.test(attribute),
    'Invalid attribute name — must be a Clojure-style namespaced key',
    {
      attribute,
      expected:
        "Clojure-style namespaced key (e.g. 'todo/title', 'patch/syncedAt')",
    }
  );
}
assertAttribute('todo/title');
assertAttribute('my.namespace/attr');
assertAttribute('todo.title/sub');

export function assertAttributes(
  attributes: Record<string, unknown>
): asserts attributes is Record<string, unknown> {
  for (const key of Object.keys(attributes)) {
    assertAttribute(key);
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
  on?: 'patches' | 'entities';
};

export type PatchesDbResult = {
  query: PatchesDbQuery;
  entities: Entity[];
  patches: Patch[];
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
};

export interface PatchesDb {
  write(patches: PatchInput[]): Promise<Patch[]>;
  read(queries: PatchesDbQuery[]): Promise<PatchesDbResult[]>;
  update(
    updates: { patchId: string; attributes: Record<string, unknown> }[]
  ): Promise<void>;
}
