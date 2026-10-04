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
  /**
   * When the server last answered this device's queries (epoch ms), or `null`
   * before it ever has. Kept across restarts (the scope checkpoints record
   * it), so a device can tell how long it has gone without confirming what it
   * holds.
   */
  readonly lastSyncedAtMs: number | null;
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
  lastSyncedAtMs: null,
  lastError: null,
  upgradeRequired: false,
};

export type SyncStatusListener = (status: SyncEngineStatus) => void;

export type SyncStatusSubscription = {
  readonly getSnapshot: () => SyncEngineStatus;
  readonly subscribe: (listener: SyncStatusListener) => () => void;
};
