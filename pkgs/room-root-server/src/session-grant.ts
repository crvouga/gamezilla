import { ROOM_ERROR_TYPE, type RoomError } from '@pkgs/room-root-shared/types';

/** A gateway may bound the lifetime of an admitted room connection. */
export function sessionGrantValid(
  grants: readonly string[],
  nowMs: number
): boolean {
  for (const grant of grants) {
    if (!grant.startsWith('session-until:')) continue;
    const expiresAt = Number(grant.slice('session-until:'.length));
    if (!Number.isFinite(expiresAt) || expiresAt <= nowMs) return false;
  }
  return true;
}

export function sessionDenial(
  denied: RoomError | null,
  grants: readonly string[],
  nowMs: number
): RoomError | null {
  if (denied !== null || sessionGrantValid(grants, nowMs)) return denied;
  return { type: ROOM_ERROR_TYPE.unauthorized, reason: 'session expired' };
}
