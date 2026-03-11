export type PatchInput = {
  entityId: string;
  entityType: string;
  attributes: Record<string, unknown>;
  /** Dynamic metadata (e.g. createdBy, sessionId, syncedAt) stored in metadata column */
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

/** Source for where clause attribute lookup. Default is 'attributes'. */
export type PatchesDbQueryWhereSource = 'attributes' | 'metadata';

export type PatchesDbQueryWhereClause =
  | {
      type: '=';
      attribute: string;
      value: unknown;
      source?: PatchesDbQueryWhereSource;
    }
  | {
      type: '!=';
      attribute: string;
      value: unknown;
      source?: PatchesDbQueryWhereSource;
    }
  | {
      type: 'in';
      attribute: string;
      values: unknown[];
      source?: PatchesDbQueryWhereSource;
    }
  | {
      type: 'not_in';
      attribute: string;
      values: unknown[];
      source?: PatchesDbQueryWhereSource;
    }
  | {
      type: 'gt';
      attribute: string;
      value: unknown;
      source?: PatchesDbQueryWhereSource;
    }
  | {
      type: 'gte';
      attribute: string;
      value: unknown;
      source?: PatchesDbQueryWhereSource;
    }
  | {
      type: 'lt';
      attribute: string;
      value: unknown;
      source?: PatchesDbQueryWhereSource;
    }
  | {
      type: 'lte';
      attribute: string;
      value: unknown;
      source?: PatchesDbQueryWhereSource;
    }
  | {
      type: 'contains';
      attribute: string;
      value: string;
      source?: PatchesDbQueryWhereSource;
    }
  | {
      type: 'exists';
      attribute: string;
      source?: PatchesDbQueryWhereSource;
    }
  | {
      type: 'not_exists';
      attribute: string;
      source?: PatchesDbQueryWhereSource;
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
  readEntities(queries: PatchesDbQuery[]): Promise<PatchesDbResult[]>;
  updateMetadata(
    updates: { patchId: string; metadata: Record<string, unknown> }[]
  ): Promise<void>;
}
