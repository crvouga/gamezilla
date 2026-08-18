import { SPACE_ROOM_MODULE_NAME } from '../../shared/space-room-module-name';

export type SpaceRoomWebSocketUrlArgs = {
  apiUrl: string;
  topic: string;
  sessionToken: string | null;
  /**
   * Install id: sent as `anonId` for anonymous connections, or alongside
   * `token` so the Worker can bind bearer JWTs to deviceId.
   */
  installId: string | null;
  /** Per-tab client id forwarded to the DO as `x-actor-client-id`. */
  clientId: string | null;
};

export function apiUrlToRoomWebSocketUrl(
  args: SpaceRoomWebSocketUrlArgs
): string {
  const { apiUrl, topic, sessionToken, installId, clientId } = args;
  const base = apiUrl.replace(/\/$/, '');
  const wsBase = base.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
  const u = new URL(`${wsBase}/api/room`);
  u.searchParams.set('topic', topic);
  u.searchParams.set('module', SPACE_ROOM_MODULE_NAME);
  if (sessionToken !== null && sessionToken.length > 0) {
    u.searchParams.set('token', sessionToken);
    if (installId !== null && installId.length > 0) {
      u.searchParams.set('anonId', installId);
    }
  } else if (installId !== null && installId.length > 0) {
    u.searchParams.set('anonId', installId);
  }
  if (clientId !== null && clientId.length > 0) {
    u.searchParams.set('clientId', clientId);
  }
  return u.toString();
}
