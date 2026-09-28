import type {
  RoomClient,
  RoomCommandPayload,
  RoomError,
  RoomEvent,
  RoomState,
} from '@pkgs/room';
export type RoomHarnessClient<
  S extends RoomState = RoomState,
  C extends RoomCommandPayload = RoomCommandPayload,
  E extends RoomEvent = RoomEvent,
> = {
  readonly id: string;
  readonly identity: string;
  readonly clientId: string;
  readonly dispatch: (payload: C) => void;
  readonly snapshot: () => S;
  readonly hash: () => string;
  readonly isSynced: () => boolean;
  readonly isConnected: () => boolean;
  readonly isCrashed: () => boolean;
  readonly room: () => RoomClient<S, C, E, string> | null;
  readonly disconnect: () => Promise<void>;
  readonly connect: () => Promise<void>;
  /** Most recent RoomError from a rejected wire frame (or null). */
  readonly lastRejection: () => RoomError | null;
  /** Inject raw client→server frame (for adversarial / dedup scenarios). */
  readonly injectToServer: (
    raw: unknown,
    opts?: { readonly direct?: boolean }
  ) => void;
  /** Inject raw server→client frame (bypasses net mesh). */
  readonly injectFromServer: (raw: unknown) => void;
};

export type RoomHarnessNode = {
  readonly disconnect: () => Promise<void>;
  readonly reconnect: () => Promise<void>;
  /**
   * Replace the live socket for this client's `(identity, clientId)` without
   * destroying the room client (session take-over).
   */
  readonly takeOver: () => Promise<void>;
  /** Tear down Room + transport; keep local storage for restart. */
  readonly crash: () => Promise<void>;
  /** Recreate Room from persisted (or wiped) local storage. */
  readonly restart: (opts?: {
    readonly wipeStorage?: boolean;
  }) => Promise<void>;
  /** Wipe local storage and reattach if the client was live. */
  readonly clearLocalData: () => Promise<void>;
  readonly now: () => number;
};
