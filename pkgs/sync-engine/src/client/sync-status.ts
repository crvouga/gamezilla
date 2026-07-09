export type SyncConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'syncing';

export type SyncEngineStatus = {
  readonly connection: SyncConnectionState;
  readonly online: boolean;
  readonly hasSynced: boolean;
  readonly lastError: string | null;
};

export const INITIAL_SYNC_STATUS: SyncEngineStatus = {
  connection: 'disconnected',
  online: true,
  hasSynced: false,
  lastError: null,
};

export type SyncStatusListener = (status: SyncEngineStatus) => void;

export type SyncStatusSubscription = {
  readonly getSnapshot: () => SyncEngineStatus;
  readonly subscribe: (listener: SyncStatusListener) => () => void;
};
