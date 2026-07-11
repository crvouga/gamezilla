export type InteractionSource = {
  readonly namespace: string;
  readonly type: string;
  readonly id: string;
};

export function buildInteractionId(
  source: InteractionSource,
  userId: string
): string {
  return `${source.namespace}:${source.type}:${source.id}:${userId}`;
}

export function parseInteractionId(id: string): {
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
