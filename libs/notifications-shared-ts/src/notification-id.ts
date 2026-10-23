export type NotificationSource = {
  readonly namespace: string;
  readonly type: string;
  readonly id: string;
};

export function buildNotificationId(
  source: NotificationSource,
  userId: string
): string {
  return `${source.namespace}:${source.type}:${source.id}:${userId}`;
}

/** The test id of the inbox's default card for one source. */
export function notificationCardTestId(source: NotificationSource): string {
  return `notification-card-${source.namespace}-${source.type}-${source.id}`;
}

/** Its part that opens the notification when the card also carries actions. */
export function notificationCardOpenTestId(source: NotificationSource): string {
  return `${notificationCardTestId(source)}-open`;
}

export function parseNotificationId(id: string): {
  namespace: string;
  type: string;
  sourceId: string;
  userId: string;
} | null {
  const parts = id.split(':');
  if (parts.length < 4) return null;
  const userId = parts[parts.length - 1] ?? '';
  const sourceId = parts[parts.length - 2] ?? '';
  const type = parts[parts.length - 3] ?? '';
  const namespace = parts.slice(0, parts.length - 3).join(':');
  if (namespace.length === 0 || type.length === 0 || sourceId.length === 0) {
    return null;
  }
  return { namespace, type, sourceId, userId };
}
