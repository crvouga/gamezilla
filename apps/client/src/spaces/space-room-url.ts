export function apiUrlToRoomWebSocketUrl(
  apiUrl: string,
  topic: string,
  sessionToken: string | null,
  /** Install id when opening the room anonymously (no Bearer). */
  anonId: string | null
): string {
  const base = apiUrl.replace(/\/$/, '');
  const wsBase = base.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
  const u = new URL(`${wsBase}/space/ws`);
  u.searchParams.set('topic', topic);
  if (sessionToken !== null && sessionToken.length > 0) {
    u.searchParams.set('token', sessionToken);
  } else if (anonId !== null && anonId.length > 0) {
    u.searchParams.set('anonId', anonId);
  }
  return u.toString();
}
