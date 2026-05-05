export function apiUrlToRoomWebSocketUrl(
  apiUrl: string,
  topic: string,
  sessionToken: string | null
): string {
  const base = apiUrl.replace(/\/$/, '');
  const wsBase = base.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
  const u = new URL(`${wsBase}/space/ws`);
  u.searchParams.set('topic', topic);
  if (sessionToken !== null && sessionToken.length > 0) {
    u.searchParams.set('token', sessionToken);
  }
  return u.toString();
}
