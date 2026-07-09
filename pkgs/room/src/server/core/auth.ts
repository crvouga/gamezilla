/**
 * Pluggable auth for WebSocket upgrade (and optional per-command checks).
 * Implementations live in app code (e.g. sync bearer lookup).
 */
export type RoomAuthFailure = {
  ok: false;
  status: number;
  body: string;
};

export type RoomAuthSuccess<Identity> = {
  ok: true;
  identity: Identity;
};

export type RoomAuthResult<Identity> =
  | RoomAuthSuccess<Identity>
  | RoomAuthFailure;

export interface RoomAuth<Identity> {
  authenticate(request: Request): Promise<RoomAuthResult<Identity>>;
  authorize?(
    identity: Identity,
    topic: string,
    command: unknown
  ): Promise<{ ok: true } | { ok: false; reason: string }>;
}
