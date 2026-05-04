export function apiUrlToRoomWebSocketUrl(apiUrl: string, topic: string): string {
  const base = apiUrl.replace(/\/$/, '');
  const wsBase = base.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
  return `${wsBase}/room/ws?topic=${encodeURIComponent(topic)}`;
}
