import { SPACE_ROOM_MODULE_NAME } from '../../shared/space-room-module-name';

export function apiUrlToRoomWebSocketUrl(
  apiUrl: string,
  topic: string,
  sessionToken: string | null,
  /**
   * Install id: sent as `anonId` for anonymous connections, or alongside
   * `token` so the Worker can bind bearer JWTs to {@link deviceId}.
   */
  installId: string | null
): string {
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
  return u.toString();
}
