/** Same-origin channel so web OPFS recovery can ask live tabs to drop handles. */
export const OPFS_WIPE_CHANNEL = 'gamezilla-opfs-wipe';

export type OpfsWipePrepareMessage = {
  readonly type: 'prepare-wipe';
  readonly requestId: string;
};

export type OpfsWipeReadyMessage = {
  readonly type: 'wipe-ready';
  readonly requestId: string;
};

export type OpfsWipeDoneMessage = {
  readonly type: 'wipe-done';
};

export type OpfsWipeMessage =
  | OpfsWipePrepareMessage
  | OpfsWipeReadyMessage
  | OpfsWipeDoneMessage;
