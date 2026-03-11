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
  entityType: string;
  entityId?: string | string[];
  where?: PatchesDbQueryWhereClause;
  orderBy?: PatchesDbQueryOrderBy[];
  limit?: number;
  offset?: number;
  after?: string;
};

export type PatchesDbResult<T> = {
  data: T[];
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
};

export interface PatchesDb {
  write(patches: PatchInput[]): Promise<Patch[]>;
  readPatches(
    queries: PatchesDbQuery[],
    knownPatches?: Patch[][]
  ): Promise<PatchesDbResult<Patch>[]>;
  readEntities(query: PatchesDbQuery): Promise<PatchesDbResult<Entity>>;
}

export interface SyncStatePatchesDb extends PatchesDb {
  getUnsyncedPatches(): Promise<Patch[]>;
  markPatchesSynced(patchIds: string[]): Promise<void>;
}
