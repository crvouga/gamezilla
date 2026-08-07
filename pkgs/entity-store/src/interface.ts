export type EntityStoreRow = {
  readonly id: string;
  readonly namespace: string;
  readonly type: string;
  readonly externalId: string;
  readonly ownerId: string | null;
  readonly data: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type EntityStoreUpsertArgs = {
  readonly namespace: string;
  readonly type: string;
  readonly externalId: string;
  readonly ownerId?: string | null;
  readonly data: Record<string, unknown>;
};

export type EntityStoreKey = {
  readonly namespace: string;
  readonly type: string;
  readonly externalId: string;
};

/**
 * App-agnostic third-party JSON mirror. Backend-only — never synced to clients.
 */
export interface EntityStore {
  upsert(args: EntityStoreUpsertArgs): Promise<void>;
  get(key: EntityStoreKey): Promise<EntityStoreRow | null>;
  delete(key: EntityStoreKey): Promise<void>;
}
