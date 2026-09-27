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
  /**
   * The product no longer accepts this app's version (`upgrade_required`):
   * nothing syncs until the app is updated. Local data is kept. Clears on the
   * next successful sync.
   */
  readonly upgradeRequired: boolean;
};

export const INITIAL_SYNC_STATUS: SyncEngineStatus = {
  connection: 'disconnected',
  online: true,
  hasSynced: false,
  hasEverSynced: false,
  lastError: null,
  upgradeRequired: false,
};

export type SyncStatusListener = (status: SyncEngineStatus) => void;

export type SyncStatusSubscription = {
  readonly getSnapshot: () => SyncEngineStatus;
  readonly subscribe: (listener: SyncStatusListener) => () => void;
};
