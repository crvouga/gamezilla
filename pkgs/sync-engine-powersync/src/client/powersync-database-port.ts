export type PowerSyncExecuteResult = {
  readonly rowsAffected?: number;
  readonly lastInsertRowid?: bigint | number | null;
};

export type PowerSyncStreamSubscription = {
  readonly unsubscribe: () => void;
  readonly waitForFirstSync: (abort?: AbortSignal) => Promise<void>;
};

export type PowerSyncStreamHandle = {
  subscribe(options?: {
    readonly priority?: number;
    readonly ttl?: number;
  }): Promise<PowerSyncStreamSubscription>;
};

export type PowerSyncDatabasePort = {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  disconnectAndClear(): Promise<void>;
  waitForFirstSync(): Promise<void>;
  getAll<T>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<PowerSyncExecuteResult>;
  writeTransaction<T>(
    fn: (tx: PowerSyncDatabasePort) => Promise<T>
  ): Promise<T>;
  registerListener(listener: { statusChanged?: () => void }): () => void;
  readonly currentStatus: {
    readonly connected: boolean;
    readonly connecting: boolean;
    readonly hasSynced: boolean;
    readonly dataFlowStatus: {
      readonly downloading: boolean;
      readonly uploading: boolean;
    };
  };
  readonly syncStream?: (
    streamName: string,
    parameters: Readonly<Record<string, string | number>>
  ) => PowerSyncStreamHandle;
};

export type PowerSyncCrudOp = {
  readonly op: 'PUT' | 'PATCH' | 'DELETE';
  readonly table: string;
  readonly id: string;
  readonly opData?: Record<string, unknown>;
};

export type PowerSyncCrudTransaction = {
  readonly crud: readonly PowerSyncCrudOp[];
  complete(): Promise<void>;
};

export type PowerSyncConnectorPort = {
  fetchCredentials(): Promise<{
    endpoint: string;
    token: string;
    expiresAt?: Date;
  }>;
  uploadData(database: {
    getNextCrudTransaction(): Promise<PowerSyncCrudTransaction | null>;
  }): Promise<void>;
};
