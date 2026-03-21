import { assert } from '../assert';

export type PatchInput = {
  entityId: string;
  entityType: string;
  attributes: Record<string, unknown>;
  /** Merged into attributes on write with patch/ prefix (e.g. patch/createdBy, patch/sessionId, patch/syncedAt) */
  meta?: Record<string, unknown>;
};

export type Patch = PatchInput & {
  patchId: string;
  parentId: string | null;
  createdAt: string;
  recordedAt: string;
  createdBy: string;
  sessionId: string;
};

export type Entity = {
  entityId: string;
  entityType: string;
  attributes: Record<string, unknown>;
};

/** Clojure-style namespaced key; no whitespace allowed. */
const ATTRIBUTE_REGEX =
  /^(?!.*\s)[a-zA-Z_][a-zA-Z0-9_.]*\/[a-zA-Z_][a-zA-Z0-9_.]*$/;
/**
 * Sanitizes an attribute name to ensure it follows Clojure-style namespaced key conventions.
 * Valid: Clojure-style namespaced keys (e.g. "todo/title", "patch/syncedAt").
 * @param attribute - The attribute to sanitize.
 * @returns The sanitized attribute.
 */
export function assertAttribute(attribute: unknown): string {
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
  return attribute;
}
assertAttribute('todo/title');
assertAttribute('my.namespace/attr');

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
