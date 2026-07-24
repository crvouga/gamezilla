/** Minimal surface of the PowerSync SDK database used by the app adapter. */
export type PowerSyncSdkQueryParam =
  | string
  | number
  | boolean
  | null
  | undefined
  | bigint
  | Uint8Array;

export type PowerSyncSdkWatchedQuery = {
  readonly state: {
    readonly isLoading: boolean;
    readonly data: unknown;
  };
  registerListener(listener: {
    onData?: (data: unknown) => void;
    onStateChange?: (state: { isLoading: boolean; data: unknown }) => void;
  }): () => void;
  close(): Promise<void>;
};

export type PowerSyncSdkDatabase = {
  init(): Promise<void>;
  connect(connector: unknown): Promise<void>;
  disconnect(): Promise<void>;
  disconnectAndClear(): Promise<void>;
  waitForFirstSync(): Promise<void>;
  getAll<T>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(
    sql: string,
    params?: unknown[]
  ): Promise<{
    rowsAffected?: number;
    lastInsertRowid?: bigint | number | null;
  }>;
  writeTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T>;
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
  syncStream?(
    streamName: string,
    parameters: Readonly<Record<string, string | number>>
  ): {
    subscribe(options?: {
      readonly priority?: number;
      readonly ttl?: number;
    }): Promise<{
      unsubscribe: () => void;
      waitForFirstSync: (abort?: AbortSignal) => Promise<void>;
    }>;
  };
  query(options: {
    sql: string;
    parameters?: readonly PowerSyncSdkQueryParam[];
  }): {
    watch(): PowerSyncSdkWatchedQuery;
    differentialWatch(): PowerSyncSdkWatchedQuery;
  };
};
