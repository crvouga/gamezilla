export type SyncConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'syncing';

export type SyncEngineStatus = {
  readonly connection: SyncConnectionState;
  readonly online: boolean;
  readonly hasSynced: boolean;
  /** Latches true after the first successful sync; never resets on reconnect. */
  readonly hasEverSynced: boolean;
  readonly lastError: string | null;
};

export const INITIAL_SYNC_STATUS: SyncEngineStatus = {
  connection: 'disconnected',
  online: true,
  hasSynced: false,
  hasEverSynced: false,
  lastError: null,
};

export type SyncStatusListener = (status: SyncEngineStatus) => void;

export type SyncStatusSubscription = {
  readonly getSnapshot: () => SyncEngineStatus;
  readonly subscribe: (listener: SyncStatusListener) => () => void;
};
